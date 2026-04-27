/**
 * ========================================
 * DASHBOARD.JS - Logic cho Warehouse Dashboard
 * ========================================
 */

/**
 * Alpine.js component cho statistics
 */
function dashboardData() {
  return {
    stats: {
      totalReceived: 0,
      incomingBatches: 0,
      currentInventory: 0,
      availableProducts: 0,
    },
    loading: true,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireWarehouse();
      if (!isAuthorized) return;

      // Load stats
      await this.loadStats();

      // Update welcome name
      this.updateWelcomeName();
    },

    async loadStats() {
      this.loading = true;

      try {
        // Load incoming batches
        const incomingResult = await API.getWarehouseIncomingBatches();
        if (incomingResult.success) {
          this.stats.incomingBatches = incomingResult.data.count || 0;
        }

        // Load inventory
        const inventoryResult = await API.getWarehouseMyInventory();
        if (inventoryResult.success) {
          const inventory = inventoryResult.data.data || [];
          this.stats.totalReceived = inventory.length;
          this.stats.currentInventory = inventory.length;

          // Calculate total available products
          this.stats.availableProducts = inventory.reduce((sum, item) => {
            return sum + (parseInt(item.available_products) || 0);
          }, 0);
        }
      } catch (error) {
        console.error("Load stats error:", error);
        Utils.toast.error("Lỗi khi tải thống kê");
      } finally {
        this.loading = false;
      }
    },

    updateWelcomeName() {
      const user = Auth.getCurrentUser();
      if (user && user.name) {
        const welcomeEl = document.getElementById("welcomeName");
        if (welcomeEl) {
          welcomeEl.textContent = user.name;
        }
      }
    },
  };
}

/**
 * Alpine.js component cho incoming batches
 */
function incomingBatchesData() {
  return {
    batches: [],
    loading: true,

    async init() {
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
