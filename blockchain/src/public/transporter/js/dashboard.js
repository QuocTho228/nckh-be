/**
 * ========================================
 * DASHBOARD.JS - Logic cho Transporter Dashboard
 * ========================================
 */

/**
 * Component hiển thị thống kê
 */
function statsData() {
  return {
    stats: {
      pending: 0,
      inTransit: 0,
      delivered: 0,
      completed: 0,
    },
    loading: true,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireTransporter();
      if (!isAuthorized) return;

      // Load stats
      await this.loadStats();
    },

    async loadStats() {
      this.loading = true;

      try {
        const result = await API.get("/api/transporter/stats");

        if (result.success) {
          this.stats = {
            pending: result.data.data.pending || 0,
            inTransit: result.data.data.inTransit || 0,
            delivered: result.data.data.delivered || 0,
            completed: result.data.data.completed || 0,
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
 * Component hiển thị lịch sử vận chuyển gần nhất
 */
function recentTransports() {
  return {
    transports: [],
    loading: true,

    async init() {
      await this.loadTransports();
    },

    async loadTransports() {
      this.loading = true;

      try {
        const result = await API.get("/api/transporter/my-transports");

        console.log("=== RECENT TRANSPORTS API RESPONSE ===");
        console.log(result);

        if (result.success) {
          // API trả về: result.data.data là array
          const allTransports = result.data.data || [];

          // Lấy 5 transport gần nhất
          this.transports = allTransports.slice(0, 5);

          console.log("Recent transports:", this.transports);
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách");
        }
      } catch (error) {
        console.error("Load transports error:", error);
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
function transporterDashboard() {
  return {
    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireTransporter();
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
