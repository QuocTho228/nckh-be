/**
 * ========================================
 * BATCH-LIST.JS - Fixed Filter Logic
 * ========================================
 */

function batchList() {
  return {
    batches: [],
    loading: true,
    filterStatus: "all", // 'all', 'pending', 'approved', 'rejected'
    searchQuery: "",

    /**
     * Filtered batches by search query
     */
    get filteredBatches() {
      let filtered = this.batches;

      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (batch) =>
            batch.batch_name?.toLowerCase().includes(query) ||
            batch.sscc?.toLowerCase().includes(query) ||
            batch.farmer_name?.toLowerCase().includes(query) ||
            batch.product_name?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },

    /**
     * Initialize
     */
    async init() {
      // Check auth
      const isAuthorized = await Auth.requireInspector();
      if (!isAuthorized) return;

      // Get filter from URL
      const urlParams = new URLSearchParams(window.location.search);
      const filter = urlParams.get("filter");
      if (
        filter &&
        ["all", "pending", "approved", "rejected"].includes(filter)
      ) {
        this.filterStatus = filter;
      }

      // Load batches
      await this.loadBatches();

      // Update navbar
      Auth.updateNavbar();
    },

    /**
     * Load batches based on filter
     */
    async loadBatches() {
      this.loading = true;

      try {
        let result;

        // Chọn API phù hợp với filter
        switch (this.filterStatus) {
          case "pending":
            result = await API.get("/api/inspector/pending-batches");
            break;

          case "approved":
            result = await API.get("/api/inspector/approved-batches");
            break;

          case "rejected":
            result = await API.get("/api/inspector/rejected-batches");
            break;

          case "all":
          default:
            // Lấy tất cả batches
            result = await API.get("/api/inspector/all-batches");
            break;
        }

        if (result.success) {
          this.batches = result.data.data || result.data || [];

          // Sort by date (mới nhất lên đầu)
          this.batches.sort((a, b) => {
            const dateA = new Date(
              a.approved_on || a.created_at || a.production_date_iso
            );
            const dateB = new Date(
              b.approved_on || b.created_at || b.production_date_iso
            );
            return dateB - dateA;
          });

          console.log(
            `✅ Loaded ${this.batches.length} batches (filter: ${this.filterStatus})`
          );
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách");
        }
      } catch (error) {
        console.error("Load batches error:", error);
        Utils.toast.error("Lỗi khi tải danh sách: " + error.message);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Change filter and reload
     */
    async changeFilter(newFilter) {
      if (this.filterStatus === newFilter) return;

      this.filterStatus = newFilter;

      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set("filter", newFilter);
      window.history.pushState({}, "", url);

      // Reload batches
      await this.loadBatches();
    },

    /**
     * Quick approve
     */
    async quickApprove(batchId) {
      const batch = this.batches.find((b) => b.batch_id === batchId);
      const batchName = batch?.batch_name || "lô hàng này";

      const confirmed = await Swal.fire({
        title: "Phê duyệt lô hàng",
        html: `
          <p class="mb-4">Bạn có chắc muốn phê duyệt?</p>
          <div class="bg-gray-50 rounded-lg p-4 text-left">
            <p class="font-semibold">${batchName}</p>
            <p class="text-sm text-gray-600">SSCC: ${batch?.sscc || "N/A"}</p>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Phê duyệt",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#028040",
      });

      if (!confirmed.isConfirmed) return;

      Utils.loading.show();

      try {
        const result = await API.post(
          `/api/inspector/approve-batch/${batchId}`
        );

        Utils.loading.hide();

        if (result.success) {
          await Swal.fire({
            icon: "success",
            title: "Phê duyệt thành công!",
            text: `Lô hàng ${batchName} đã được phê duyệt`,
            confirmButtonColor: "#028040",
          });

          // Reload danh sách
          await this.loadBatches();
        } else {
          Utils.toast.error(result.error || "Lỗi khi phê duyệt");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Approve error:", error);
        Utils.toast.error("Lỗi khi phê duyệt: " + error.message);
      }
    },

    /**
     * Quick reject
     */
    async quickReject(batchId) {
      const batch = this.batches.find((b) => b.batch_id === batchId);
      const batchName = batch?.batch_name || "lô hàng này";

      const { value: reason } = await Swal.fire({
        title: "Từ chối lô hàng",
        html: `
          <div class="text-left mb-4">
            <p class="text-sm text-gray-600 mb-2">Lô hàng:</p>
            <p class="font-semibold">${batchName}</p>
            <p class="text-sm text-gray-600">SSCC: ${batch?.sscc || "N/A"}</p>
          </div>
        `,
        input: "textarea",
        inputLabel: "Lý do từ chối",
        inputPlaceholder: "Nhập lý do từ chối (bắt buộc)...",
        inputAttributes: {
          "aria-label": "Nhập lý do từ chối",
          rows: 4,
        },
        showCancelButton: true,
        confirmButtonText: "Xác nhận từ chối",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#ef4444",
        inputValidator: (value) => {
          if (!value || value.trim() === "") {
            return "Vui lòng nhập lý do từ chối";
          }
          if (value.trim().length < 10) {
            return "Lý do phải có ít nhất 10 ký tự";
          }
        },
      });

      if (!reason) return;

      Utils.loading.show();

      try {
        const result = await API.post(
          `/api/inspector/reject-batch/${batchId}`,
          {
            reason: reason.trim(),
          }
        );

        Utils.loading.hide();

        if (result.success) {
          await Swal.fire({
            icon: "success",
            title: "Đã từ chối lô hàng",
            html: `
              <p class="mb-2">Lô hàng <strong>${batchName}</strong> đã bị từ chối.</p>
              <p class="text-sm text-gray-600 mb-2">Lý do:</p>
              <p class="text-sm bg-red-50 p-3 rounded">${reason.trim()}</p>
            `,
            confirmButtonColor: "#ef4444",
          });

          // Reload danh sách
          await this.loadBatches();
        } else {
          Utils.toast.error(result.error || "Lỗi khi từ chối");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Reject error:", error);
        Utils.toast.error("Lỗi khi từ chối: " + error.message);
      }
    },
  };
}

/**
 * Initialize auth
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
