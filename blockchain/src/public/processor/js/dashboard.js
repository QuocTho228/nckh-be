/**
 * ========================================
 * DASHBOARD.JS - Logic cho Processor Dashboard
 * ========================================
 */

/**
 * Component hiển thị thống kê
 */
function statsData() {
  return {
    stats: {
      pendingBatches: 0,
      totalProcessed: 0,
      totalProducts: 0,
      avgEfficiency: 0,
      needsPackaging: 0,
    },
    loading: true,

    async init() {
      const isAuthorized = await Auth.requireProcessor();
      if (!isAuthorized) return;

      await this.loadStats();
    },

    async loadStats() {
      this.loading = true;

      try {
        const result = await API.get("/api/processor/stats");

        if (result.success) {
          this.stats = {
            pendingBatches: result.data.data.pendingBatches || 0,
            totalProcessed: result.data.data.totalProcessed || 0,
            totalProducts: result.data.data.totalProducts || 0,
            avgEfficiency: parseFloat(result.data.data.avgEfficiency || 0),
            needsPackaging: result.data.data.needsPackaging || 0,
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
 * Component hiển thị lô hàng mới nhất
 */
function latestBatches() {
  return {
    batches: [],
    loading: true,

    async init() {
      await this.loadBatches();
    },

    async loadBatches() {
      this.loading = true;

      try {
        const result = await API.get("/api/processor/stats");

        if (result.success) {
          this.batches = result.data.data.latestPending || [];
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
 * Component dashboard chính
 */
function processorDashboard() {
  return {
    async init() {
      const isAuthorized = await Auth.requireProcessor();
      if (!isAuthorized) return;

      Auth.updateNavbar();
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
