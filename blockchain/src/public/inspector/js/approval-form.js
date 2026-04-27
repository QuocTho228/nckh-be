/**
 * ========================================
 * APPROVAL-FORM.JS - Logic Phê Duyệt Lô Hàng
 * ========================================
 */

function approvalForm() {
  return {
    loading: true,
    error: null,
    batchId: null,
    batchData: null,
    submitting: false,

    /**
     * Initialize
     */
    async init() {
      const isAuthorized = await Auth.requireInspector();
      if (!isAuthorized) return;

      // Get batch ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      this.batchId = urlParams.get("id");

      if (!this.batchId) {
        this.error = "Không tìm thấy ID lô hàng";
        this.loading = false;
        return;
      }

      await this.loadBatchData();
      Auth.updateNavbar();
    },

    /**
     * Load batch data
     */
    async loadBatchData() {
      this.loading = true;
      this.error = null;

      try {
        const result = await API.get(
          `/api/inspector/batch/${this.batchId}/full-info`
        );

        if (!result.success) {
          throw new Error(result.error || "Lỗi khi tải thông tin lô hàng");
        }

        this.batchData = result.data.data;
        console.log("Batch data loaded:", this.batchData);

        if (!this.batchData.batch) {
          throw new Error("Không tìm thấy lô hàng");
        }
      } catch (error) {
        console.error("Load batch data error:", error);
        this.error = error.message || "Lỗi khi tải thông tin lô hàng";
      } finally {
        this.loading = false;
      }
    },

    /**
     * View image in modal
     */
    viewImage(url) {
      Swal.fire({
        imageUrl: url,
        imageAlt: "Ảnh",
        showCloseButton: true,
        showConfirmButton: false,
        width: 800,
      });
    },

    /**
     * Approve batch
     */
    async approveBatch() {
      const confirmed = await Swal.fire({
        title: "Xác nhận phê duyệt",
        html: `
          <p class="mb-4">Bạn có chắc muốn phê duyệt lô hàng này?</p>
          <div class="bg-gray-50 rounded-lg p-4 text-left">
            <p class="text-sm text-gray-600 mb-2">Thông tin lô hàng:</p>
            <p class="font-semibold">${this.batchData.batch.batch_name}</p>
            <p class="text-sm text-gray-600">SSCC: ${
              this.batchData.batch.sscc
            }</p>
            <p class="text-sm text-gray-600">Nông dân: ${
              this.batchData.batch.farmer_name || "N/A"
            }</p>
          </div>
          <p class="mt-4 text-sm text-gray-500">
            <i class="fas fa-info-circle mr-1"></i>
            Sau khi phê duyệt, lô hàng sẽ được ghi lên blockchain và không thể hoàn tác.
          </p>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Xác nhận phê duyệt",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#028040",
        cancelButtonColor: "#6b7280",
      });

      if (!confirmed.isConfirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        const result = await API.post(
          `/api/inspector/approve-batch/${this.batchId}`
        );

        Utils.loading.hide();

        if (result.success) {
          await Swal.fire({
            icon: "success",
            title: "Phê duyệt thành công!",
            html: `
              <p class="mb-2">Lô hàng <strong>${
                this.batchData.batch.batch_name
              }</strong> đã được phê duyệt.</p>
              <p class="text-sm text-gray-600 mb-3">Transaction Hash:</p>
              <p class="text-xs font-mono bg-gray-100 p-2 rounded break-all">${
                result.data.transactionHash || "N/A"
              }</p>
            `,
            confirmButtonColor: "#028040",
            confirmButtonText: "OK",
          });

          // Redirect to list
          window.location.href = "/inspector/danh-sach-lo.html?filter=approved";
        } else {
          Utils.toast.error(result.error || "Lỗi khi phê duyệt");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Approve error:", error);
        Utils.toast.error("Lỗi khi phê duyệt: " + error.message);
      } finally {
        this.submitting = false;
      }
    },

    /**
     * Reject batch
     */
    async rejectBatch() {
      const { value: reason } = await Swal.fire({
        title: "Từ chối lô hàng",
        html: `
          <div class="text-left mb-4">
            <p class="text-sm text-gray-600 mb-2">Lô hàng:</p>
            <p class="font-semibold">${this.batchData.batch.batch_name}</p>
            <p class="text-sm text-gray-600">SSCC: ${this.batchData.batch.sscc}</p>
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
        cancelButtonColor: "#6b7280",
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

      this.submitting = true;
      Utils.loading.show();

      try {
        const result = await API.post(
          `/api/inspector/reject-batch/${this.batchId}`,
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
              <p class="mb-2">Lô hàng <strong>${
                this.batchData.batch.batch_name
              }</strong> đã bị từ chối.</p>
              <p class="text-sm text-gray-600 mb-2">Lý do:</p>
              <p class="text-sm bg-red-50 p-3 rounded">${reason.trim()}</p>
            `,
            confirmButtonColor: "#ef4444",
            confirmButtonText: "OK",
          });

          // Redirect to list
          window.location.href = "/inspector/danh-sach-lo.html?filter=rejected";
        } else {
          Utils.toast.error(result.error || "Lỗi khi từ chối");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Reject error:", error);
        Utils.toast.error("Lỗi khi từ chối: " + error.message);
      } finally {
        this.submitting = false;
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
