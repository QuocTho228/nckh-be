/**
 * ========================================
 * TRANSPORT-LIST.JS
 * ========================================
 */

function transportList() {
  return {
    batches: [],
    loading: true,
    filterType: "all", // 'all', 'notstarted', 'intransit', 'completed'
    searchQuery: "",

    /**
     * Filtered batches
     */
    get filteredBatches() {
      let filtered = this.batches;

      // CRITICAL FIX: Exclude batches that are delivered AND moved to next stage
      // Keep batches that are delivered but still at Purchased/QualityInspected
      // (waiting for processor/warehouse confirmation)
      filtered = filtered.filter((b) => {
        // Nếu đã delivered nhưng vẫn ở stage Purchased/QualityInspected
        // thì vẫn hiển thị (chờ confirm)
        const needsTransport =
          b.current_stage === "Purchased" ||
          b.current_stage === "QualityInspected";

        const isFullyCompleted =
          b.detailed_transport_status === "Delivered" && !needsTransport;

        // Chỉ loại bỏ những batch đã hoàn toàn xong
        return !isFullyCompleted;
      });

      // Filter by type
      if (this.filterType === "notstarted") {
        // Chưa bắt đầu vận chuyển
        filtered = filtered.filter((b) => {
          const isNotStarted =
            b.detailed_transport_status === "NotStarted" ||
            b.transport_status === "NotTransported";

          console.log(
            `[notstarted] Batch ${b.batch_name}:`,
            `transport_status="${b.transport_status}"`,
            `detailed="${b.detailed_transport_status}"`,
            `isNotStarted=${isNotStarted}`,
          );

          return isNotStarted;
        });
      } else if (this.filterType === "intransit") {
        // Đang vận chuyển
        filtered = filtered.filter((b) => {
          const isInTransit =
            b.transport_status === "InTransit" ||
            b.detailed_transport_status === "InTransit" ||
            b.detailed_transport_status === "Paused";

          console.log(
            `[intransit] Batch ${b.batch_name}:`,
            `transport_status="${b.transport_status}"`,
            `detailed="${b.detailed_transport_status}"`,
            `isInTransit=${isInTransit}`,
          );

          return isInTransit;
        });
      } else if (this.filterType === "completed") {
        // Đã hoàn thành vận chuyển - batch đã giao hàng nhưng chưa được confirm
        // Điều kiện:
        // - detailed_transport_status === "Delivered"
        // - VÀ vẫn ở stage Purchased/QualityInspected (chờ confirm)
        filtered = filtered.filter((b) => {
          const isDelivered = b.detailed_transport_status === "Delivered";
          const needsConfirm =
            b.current_stage === "Purchased" ||
            b.current_stage === "QualityInspected";

          const isCompleted = isDelivered && needsConfirm;

          console.log(
            `[completed] Batch ${b.batch_name}:`,
            `stage="${b.current_stage}"`,
            `detailed="${b.detailed_transport_status}"`,
            `isDelivered=${isDelivered}`,
            `needsConfirm=${needsConfirm}`,
            `isCompleted=${isCompleted}`,
          );

          return isCompleted;
        });
      }

      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (batch) =>
            batch.batch_name?.toLowerCase().includes(query) ||
            batch.sscc?.toLowerCase().includes(query) ||
            batch.farmer_name?.toLowerCase().includes(query) ||
            batch.product_name?.toLowerCase().includes(query),
        );
      }

      return filtered;
    },

    /**
     * Initialize
     */
    async init() {
      // Check auth
      const isAuthorized = await Auth.requireTransporter();
      if (!isAuthorized) return;

      // Get filter from URL
      const urlParams = new URLSearchParams(window.location.search);
      const filter = urlParams.get("filter");
      if (
        filter &&
        ["all", "notstarted", "intransit", "completed"].includes(filter)
      ) {
        this.filterType = filter;
      }

      // Load batches
      await this.loadBatches();

      // Update navbar
      Auth.updateNavbar();
    },

    /**
     * Load batches to transport
     */
    async loadBatches() {
      this.loading = true;

      try {
        const result = await API.get("/api/transporter/batches-to-transport");

        if (result.success) {
          this.batches = result.data.data.all || [];

          // Sort by created date (newest first)
          this.batches.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB - dateA;
          });

          console.log("Loaded batches:", this.batches.length);
          console.log("Transport1:", result.data.data.transport1?.length || 0);
          console.log("Transport2:", result.data.data.transport2?.length || 0);
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách");
        }
      } catch (error) {
        console.error("Load batches error:", error);
        Utils.toast.error("Lỗi khi tải danh sách");
      } finally {
        this.loading = false;
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
