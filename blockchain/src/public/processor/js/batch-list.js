/**
 * ========================================
 * BATCH-LIST.JS - Logic Danh Sách Lô Cần Sơ Chế
 * ========================================
 */

function batchList() {
  return {
    batches: [],
    loading: true,
    searchQuery: "",

    /**
     * Filtered batches by search query
     */
    get filteredBatches() {
      if (!this.searchQuery.trim()) {
        return this.batches;
      }

      const query = this.searchQuery.toLowerCase();
      return this.batches.filter(
        (batch) =>
          batch.batch_name?.toLowerCase().includes(query) ||
          batch.sscc?.toLowerCase().includes(query) ||
          batch.farmer_name?.toLowerCase().includes(query) ||
          batch.product_name?.toLowerCase().includes(query),
      );
    },

    /**
     * Initialize
     */
    async init() {
      const isAuthorized = await Auth.requireProcessor();
      if (!isAuthorized) return;

      await this.loadBatches();
      Auth.updateNavbar();
    },

    /**
     * Load batches
     */
    async loadBatches() {
      this.loading = true;

      try {
        const result = await API.get("/api/processor/pending-batches");

        if (result.success) {
          this.batches = result.data.data || [];

          // Sort by delivered date (mới nhất lên đầu)
          this.batches.sort((a, b) => {
            const dateA = new Date(a.delivered_at || a.created_at);
            const dateB = new Date(b.delivered_at || b.created_at);
            return dateB - dateA;
          });

          console.log(`✅ Loaded ${this.batches.length} pending batches`);
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách");
        }
      } catch (error) {
        console.error("Load batches error:", error);
        Utils.toast.error("Lỗi khi tải danh sách: " + error.message);
      } finally {
        this.loading = false;
      }
    },
  };
}

/**
 * Initialize auth
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
