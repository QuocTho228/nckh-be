/**
 * ========================================
 * DASHBOARD.JS - Logic cho Distributor Dashboard (FIXED TIMEZONE)
 * ========================================
 */

/**
 * Alpine.js component cho statistics
 */
function dashboardData() {
  return {
    stats: {
      totalSold: 0,
      availableProducts: 0,
      soldToday: 0,
      soldThisWeek: 0,
    },
    loading: true,

    async init() {
      const isAuthorized = await Auth.requireDistributor();
      if (!isAuthorized) return;

      await this.loadStats();
      this.updateWelcomeName();
    },

    async loadStats() {
      this.loading = true;

      try {
        // Load sales history
        const salesResult = await API.getDistributorSalesHistory();
        console.log("Sales result:", salesResult);

        if (salesResult.success) {
          let sales = [];

          if (Array.isArray(salesResult.data)) {
            sales = salesResult.data;
          } else if (salesResult.data && typeof salesResult.data === "object") {
            sales =
              salesResult.data.sales ||
              salesResult.data.items ||
              salesResult.data.history ||
              [];
          }

          this.stats.totalSold = sales.length;

          // ✅ FIX: Calculate today's sales theo múi giờ Việt Nam
          const todayVN = Utils.getTodayVietnam();
          this.stats.soldToday = sales.filter((s) => {
            if (!s.sold_date_iso) return false;
            const saleDateVN = Utils.getVietnamDate(s.sold_date_iso);
            return saleDateVN === todayVN;
          }).length;

          // ✅ FIX: Calculate this week's sales
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          this.stats.soldThisWeek = sales.filter((s) => {
            if (!s.sold_date_iso) return false;
            const saleDate = new Date(s.sold_date_iso);
            return saleDate >= weekAgo;
          }).length;
        }

        // Load available products
        const productsResult = await API.getDistributorAvailableProducts();
        console.log("Products result:", productsResult);

        if (productsResult.success) {
          if (typeof productsResult.count === "number") {
            this.stats.availableProducts = productsResult.count;
          } else if (Array.isArray(productsResult.data)) {
            this.stats.availableProducts = productsResult.data.length;
          } else if (
            productsResult.data &&
            typeof productsResult.data === "object"
          ) {
            const products =
              productsResult.data.products || productsResult.data.items || [];
            this.stats.availableProducts = products.length;
          }
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
 * Alpine.js component cho recent sales
 */
function recentSalesData() {
  return {
    sales: [],
    loading: true,

    async init() {
      await this.loadSales();
    },

    async loadSales() {
      this.loading = true;

      try {
        const result = await API.getDistributorSalesHistory();
        console.log("Recent sales result:", result);

        if (result.success) {
          let salesData = [];

          if (Array.isArray(result.data)) {
            salesData = result.data;
          } else if (result.data && typeof result.data === "object") {
            salesData =
              result.data.sales ||
              result.data.items ||
              result.data.history ||
              [];
          }

          if (Array.isArray(salesData)) {
            this.sales = salesData;

            // Sort by sold date (newest first)
            this.sales.sort((a, b) => {
              if (!a.sold_date_iso || !b.sold_date_iso) return 0;
              const dateA = new Date(a.sold_date_iso);
              const dateB = new Date(b.sold_date_iso);
              return dateB - dateA;
            });
          } else {
            console.warn("Sales data is not an array:", salesData);
            this.sales = [];
          }
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải lịch sử bán hàng");
          this.sales = [];
        }
      } catch (error) {
        console.error("Load sales error:", error);
        Utils.toast.error("Lỗi khi tải lịch sử bán hàng");
        this.sales = [];
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
