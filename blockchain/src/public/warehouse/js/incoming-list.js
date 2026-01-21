/**
 * ========================================
 * INCOMING-LIST.JS - Danh sách lô đang đến kho
 * ========================================
 */

function incomingListData() {
  return {
    batches: [],
    loading: true,

    get qualityPassedCount() {
      return this.batches.filter((b) => b.quality_passed).length;
    },

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireWarehouse();
      if (!isAuthorized) return;

      // Load batches
      await this.loadBatches();
    },

    async loadBatches() {
      this.loading = true;

      try {
        const result = await API.getWarehouseIncomingBatches();

        if (result.success) {
          this.batches = result.data.data || [];

          // Sort by last transport update (newest first)
          this.batches.sort((a, b) => {
            const dateA = new Date(a.last_transport_update || 0);
            const dateB = new Date(b.last_transport_update || 0);
            return dateB - dateA;
          });

          if (this.batches.length === 0) {
            Utils.toast.info("Không có lô hàng nào đang trên đường");
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
