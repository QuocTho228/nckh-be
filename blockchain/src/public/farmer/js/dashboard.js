/**
 * ========================================
 * DASHBOARD.JS - Logic cho Dashboard
 * ========================================
 */

/**
 * Alpine.js component cho statistics
 */
function dashboardData() {
  return {
    stats: {
      totalTrees: 0,
      pendingBatches: 0,
      approvedBatches: 0,
      rejectedBatches: 0,
    },
    loading: true,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireFarmer();
      if (!isAuthorized) return;

      // Load stats
      await this.loadStats();

      // Update welcome name
      this.updateWelcomeName();
    },

    async loadStats() {
      this.loading = true;

      try {
        // Load trees
        const treesResult = await API.getMyTrees();
        if (treesResult.success) {
          this.stats.totalTrees = treesResult.data.count || 0;
        }

        // Load batches
        const batchesResult = await API.getMyBatches();
        if (batchesResult.success) {
          const batches = batchesResult.data.data || [];

          this.stats.pendingBatches = batches.filter(
            (b) => b.status === CONFIG.BATCH_STATUS.PENDING
          ).length;

          this.stats.approvedBatches = batches.filter(
            (b) => b.status === CONFIG.BATCH_STATUS.APPROVED
          ).length;

          this.stats.rejectedBatches = batches.filter(
            (b) => b.status === CONFIG.BATCH_STATUS.REJECTED
          ).length;
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
 * Alpine.js component cho danh sách batches
 */
function batchesData() {
  return {
    batches: [],
    loading: true,
    filterStatus: "all", // 'all', 'pending', 'approved', 'rejected'

    get filteredBatches() {
      if (this.filterStatus === "all") {
        return this.batches;
      }

      const statusMap = {
        pending: CONFIG.BATCH_STATUS.PENDING,
        approved: CONFIG.BATCH_STATUS.APPROVED,
        rejected: CONFIG.BATCH_STATUS.REJECTED,
      };

      return this.batches.filter(
        (batch) => batch.status === statusMap[this.filterStatus]
      );
    },

    async init() {
      await this.loadBatches();
    },

    async loadBatches() {
      this.loading = true;

      try {
        const result = await API.getMyBatches();

        if (result.success) {
          this.batches = result.data.data || [];

          // Sort by created date (newest first)
          this.batches.sort((a, b) => {
            const dateA = new Date(a.created_at || a.production_date_iso);
            const dateB = new Date(b.created_at || b.production_date_iso);
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
