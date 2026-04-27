/**
 * ========================================
 * DASHBOARD.JS - Logic cho Quality Inspector Dashboard
 * ========================================
 */

/**
 * Alpine.js component cho statistics
 */
function dashboardData() {
  return {
    stats: {
      totalTests: 0,
      pendingBatches: 0,
      passedTests: 0,
      failedTests: 0,
      passRate: 0,
    },
    loading: true,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireQualityInspector();
      if (!isAuthorized) return;

      // Load stats
      await this.loadStats();

      // Update welcome name
      this.updateWelcomeName();
    },

    async loadStats() {
      this.loading = true;

      try {
        // Load pending batches
        const pendingResult = await API.getQualityInspectorPendingBatches();
        if (pendingResult.success) {
          this.stats.pendingBatches = pendingResult.data.count || 0;
        }

        // Load my tests
        const testsResult = await API.getQualityInspectorMyTests();
        if (testsResult.success) {
          const tests = testsResult.data.data || [];

          this.stats.totalTests = tests.length;
          this.stats.passedTests = tests.filter((t) => t.passed).length;
          this.stats.failedTests = tests.filter((t) => !t.passed).length;

          // Calculate pass rate
          if (this.stats.totalTests > 0) {
            this.stats.passRate = Math.round(
              (this.stats.passedTests / this.stats.totalTests) * 100,
            );
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
 * Alpine.js component cho recent tests
 */
function recentTestsData() {
  return {
    tests: [],
    loading: true,

    async init() {
      await this.loadRecentTests();
    },

    async loadRecentTests() {
      this.loading = true;

      try {
        const result = await API.getQualityInspectorMyTests();

        if (result.success) {
          this.tests = result.data.data || [];

          // Sort by test date (newest first)
          this.tests.sort((a, b) => {
            const dateA = new Date(a.test_date_iso);
            const dateB = new Date(b.test_date_iso);
            return dateB - dateA;
          });
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách test");
        }
      } catch (error) {
        console.error("Load recent tests error:", error);
        Utils.toast.error("Lỗi khi tải danh sách test");
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
