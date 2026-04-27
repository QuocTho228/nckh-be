/**
 * ========================================
 * DASHBOARD.JS - Logic cho Purchaser Dashboard
 * ========================================
 */

/**
 * Component hiển thị thống kê
 */
function statsData() {
  return {
    stats: {
      availableBatches: 0,
      totalPurchases: 0,
      totalQuantity: 0,
      totalAmount: 0,
    },
    loading: true,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requirePurchaser();
      if (!isAuthorized) return;

      // Load stats
      await this.loadStats();
    },

    async loadStats() {
      this.loading = true;

      try {
        const result = await API.get("/api/purchaser/stats");

        if (result.success) {
          this.stats = {
            availableBatches: result.data.data.availableBatches || 0,
            totalPurchases: result.data.data.totalPurchases || 0,
            totalQuantity: result.data.data.totalQuantity || 0,
            totalAmount: result.data.data.totalAmount || 0,
          };
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải thống kê");
        }
      } catch (error) {
        console.error("Load stats error:", error);
        Utils.toast.error("Lỗi khi tải thống kê");
      } finally {
        this.loading = false;
      }
    },
  };
}

/**
 * Component hiển thị giao dịch gần nhất
 */
function recentPurchases() {
  return {
    purchases: [],
    loading: true,

    async init() {
      await this.loadPurchases();
    },

    async loadPurchases() {
      this.loading = true;

      try {
        const result = await API.get("/api/purchaser/stats");

        if (result.success) {
          this.purchases = result.data.data.recentPurchases || [];
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách");
        }
      } catch (error) {
        console.error("Load purchases error:", error);
        Utils.toast.error("Lỗi khi tải danh sách");
      } finally {
        this.loading = false;
      }
    },
  };
}

/**
 * Component dashboard chính
 */
function purchaserDashboard() {
  return {
    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requirePurchaser();
      if (!isAuthorized) return;

      // Update navbar
      Auth.updateNavbar();

      // Update welcome name
      this.updateWelcomeName();
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
 * Initialize auth khi page load
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
