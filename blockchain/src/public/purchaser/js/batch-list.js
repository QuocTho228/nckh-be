/**
 * ========================================
 * BATCH-LIST.JS - Logic Danh Sách Lô Đã Duyệt
 * ========================================
 */

function batchList() {
  return {
    batches: [],
    loading: true,
    searchQuery: "",

    /**
     * Filtered batches
     */
    get filteredBatches() {
      let filtered = this.batches;

      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (batch) =>
            batch.batch_name?.toLowerCase().includes(query) ||
            batch.sscc?.toLowerCase().includes(query) ||
            batch.farmer_name?.toLowerCase().includes(query) ||
            batch.product_name?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },

    /**
     * Initialize
     */
    async init() {
      // Check auth
      const isAuthorized = await Auth.requirePurchaser();
      if (!isAuthorized) return;

      // Load batches
      await this.loadBatches();

      // Update navbar
      Auth.updateNavbar();
    },

    /**
     * Load approved batches
     */
    async loadBatches() {
      this.loading = true;

      try {
        const result = await API.get("/api/purchaser/approved-batches");

        if (result.success) {
          this.batches = result.data.data || [];

          // Sort by approval date (newest first)
          this.batches.sort((a, b) => {
            const dateA = new Date(a.approved_on);
            const dateB = new Date(b.approved_on);
            return dateB - dateA;
          });

          console.log("Loaded batches:", this.batches.length);
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

    /**
     * Quick view batch details
     */
    async quickPurchase(batch) {
      // Redirect to purchase form
      window.location.href = `/purchaser/ghi-nhan-mua.html?id=${batch.batch_id}`;
    },
  };
}

/**
 * Initialize auth
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
