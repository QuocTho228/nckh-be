/**
 * ========================================
 * SALES-HISTORY.JS - Lịch sử bán hàng (FIXED TIMEZONE)
 * ========================================
 */

function salesHistoryData() {
  return {
    sales: [],
    loading: true,
    filterPeriod: "all",
    searchQuery: "",

    get todayCount() {
      // ✅ FIX: So sánh theo múi giờ Việt Nam
      const todayVN = Utils.getTodayVietnam();

      return this.sales.filter((s) => {
        if (!s.sold_date_iso) return false;
        const saleDateVN = Utils.getVietnamDate(s.sold_date_iso);
        return saleDateVN === todayVN;
      }).length;
    },

    get weekCount() {
      // ✅ FIX: Tính theo múi giờ Việt Nam
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      return this.sales.filter((s) => {
        if (!s.sold_date_iso) return false;
        const saleDate = new Date(s.sold_date_iso);
        return saleDate >= weekAgo;
      }).length;
    },

    get monthCount() {
      // ✅ FIX: Tính theo múi giờ Việt Nam
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      return this.sales.filter((s) => {
        if (!s.sold_date_iso) return false;
        const saleDate = new Date(s.sold_date_iso);
        return saleDate >= monthAgo;
      }).length;
    },

    get filteredSales() {
      let filtered = [...this.sales];

      // Filter by period
      if (this.filterPeriod === "today") {
        const todayVN = Utils.getTodayVietnam();
        filtered = filtered.filter((s) => {
          if (!s.sold_date_iso) return false;
          const saleDateVN = Utils.getVietnamDate(s.sold_date_iso);
          return saleDateVN === todayVN;
        });
      } else if (this.filterPeriod === "week") {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((s) => {
          if (!s.sold_date_iso) return false;
          const saleDate = new Date(s.sold_date_iso);
          return saleDate >= weekAgo;
        });
      } else if (this.filterPeriod === "month") {
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((s) => {
          if (!s.sold_date_iso) return false;
          const saleDate = new Date(s.sold_date_iso);
          return saleDate >= monthAgo;
        });
      }

      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter((s) => {
          return (
            (s.product_qr_code &&
              s.product_qr_code.toLowerCase().includes(query)) ||
            (s.batch_name && s.batch_name.toLowerCase().includes(query)) ||
            (s.sscc && s.sscc.toLowerCase().includes(query)) ||
            (s.product_name && s.product_name.toLowerCase().includes(query)) ||
            (s.farmer_name && s.farmer_name.toLowerCase().includes(query)) ||
            (s.notes && s.notes.toLowerCase().includes(query))
          );
        });
      }

      return filtered;
    },

    async init() {
      const isAuthorized = await Auth.requireDistributor();
      if (!isAuthorized) return;
      await this.loadSales();
    },

    async loadSales() {
      this.loading = true;

      try {
        const result = await API.getDistributorSalesHistory();
        console.log("Sales history result:", result);

        if (result.success) {
          let salesData = [];

          if (Array.isArray(result.data)) {
            salesData = result.data;
          } else if (result.data && typeof result.data === "object") {
            salesData =
              result.data.sales ||
              result.data.items ||
              result.data.history ||
              result.data.data ||
              [];
          }

          console.log("Processed sales data:", salesData);

          if (Array.isArray(salesData)) {
            this.sales = salesData;

            // Sort by sold date (newest first)
            this.sales.sort((a, b) => {
              if (!a.sold_date_iso || !b.sold_date_iso) return 0;
              const dateA = new Date(a.sold_date_iso);
              const dateB = new Date(b.sold_date_iso);
              return dateB - dateA;
            });

            console.log("Final sales array:", this.sales);

            if (this.sales.length > 0) {
              Utils.toast.success(`Đã tải ${this.sales.length} giao dịch`);
            }
          } else {
            console.warn("Sales data is not an array:", salesData);
            this.sales = [];
            Utils.toast.warning("Không có dữ liệu bán hàng");
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
