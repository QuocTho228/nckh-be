/**
 * ========================================
 * DASHBOARD.JS - Logic cho Inspector Dashboard
 * ========================================
 */

/**
 * Component hiển thị thống kê
 */
function statsData() {
  return {
    stats: {
      pending: 0,
      approved: 0,
      rejected: 0,
      myApprovals: 0,
    },
    loading: true,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireInspector();
      if (!isAuthorized) return;

      // Load stats
      await this.loadStats();
    },

    async loadStats() {
      this.loading = true;

      try {
        const result = await API.get("/api/inspector/stats");

        if (result.success) {
          this.stats = {
            pending: result.data.data.pending || 0,
            approved: result.data.data.approved || 0,
            rejected: result.data.data.rejected || 0,
            myApprovals: result.data.data.myApprovals || 0,
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
        const result = await API.get("/api/inspector/stats");

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
function inspectorDashboard() {
  return {
    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireInspector();
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
