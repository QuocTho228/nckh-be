/**
 * ========================================
 * BATCH-LIST.JS - Danh sách lô cần kiểm nghiệm
 * ========================================
 */

function batchListData() {
  return {
    batches: [],
    loading: true,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireQualityInspector();
      if (!isAuthorized) return;

      // Load batches
      await this.loadBatches();
    },

    async loadBatches() {
      this.loading = true;

      try {
        const result = await API.getQualityInspectorPendingBatches();

        if (result.success) {
          this.batches = result.data.data || [];

          // Sort by processing date (newest first)
          this.batches.sort((a, b) => {
            const dateA = new Date(a.processing_date_iso || 0);
            const dateB = new Date(b.processing_date_iso || 0);
            return dateB - dateA;
          });

          if (this.batches.length === 0) {
            Utils.toast.info("Không có lô nào cần kiểm nghiệm");
          }
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách lô hàng");
        }
      } catch (error) {
        console.error("Load batches error:", error);
        Utils.toast.error("Lỗi khi tải danh sách lô hàng");
      } finally {
        this.loading = false;
      }
    },
  };
}

/**
 * Initialize auth khi page load
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
