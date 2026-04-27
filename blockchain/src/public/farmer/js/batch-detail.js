/**
 * ========================================
 * BATCH-DETAIL.JS - Logic Chi Tiết Lô Hàng
 * ========================================
 */

function batchDetail() {
  return {
    loading: true,
    error: null,
    batchId: null,

    // Data
    batch: null,
    sourceTrees: [],
    images: [],
    loadingTrees: true,

    // Timeline
    timeline: [],

    /**
     * Initialize
     */
    async init() {
      const isAuthorized = await Auth.requireFarmer();
      if (!isAuthorized) return;

      // Get batch ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      this.batchId = urlParams.get("id");

      if (!this.batchId) {
        this.error = "Không tìm thấy ID lô hàng";
        this.loading = false;
        return;
      }

      await this.loadBatchDetail();
      Auth.updateNavbar();
    },

    /**
     * Load batch detail
     */
    async loadBatchDetail() {
      this.loading = true;
      this.error = null;

      try {
        // Get batch info from my-batches
        const result = await API.getMyBatches();

        // ✅ DEBUG: Kiểm tra response
        console.log("API Response:", result);
        console.log("Looking for batch_id:", this.batchId);

        if (!result.success) {
          throw new Error(result.error || "Lỗi khi tải thông tin lô hàng");
        }

        const batches = result.data.data || result.data || [];
        console.log("Total batches:", batches.length);
        console.log("Batches:", batches);

        // ✅ FIX: So sánh cả số và string
        this.batch = batches.find(
          (b) =>
            b.batch_id == this.batchId || b.batch_id === parseInt(this.batchId)
        );

        console.log("Found batch:", this.batch);

        if (!this.batch) {
          this.error = `Không tìm thấy lô hàng với ID ${this.batchId}`;
          return; // ✅ Return ngay, không chạy tiếp
        }

        // Load related data
        await Promise.all([this.loadSourceTrees(), this.loadImages()]);

        // Generate timeline
        this.generateTimeline();
      } catch (error) {
        console.error("Load batch detail error:", error);
        this.error = error.message || "Lỗi khi tải thông tin lô hàng";
      } finally {
        this.loading = false; // ✅ Luôn set loading = false cuối cùng
      }
    },

    /**
     * Load source trees
     */
    async loadSourceTrees() {
      this.loadingTrees = true;

      try {
        // Get tree-batch links from blockchain logger
        const result = await API.get(
          `/api/blockchain/batch/${this.batchId}/events`
        );

        // ✅ Kiểm tra kỹ hơn
        console.log("Blockchain events result:", result);

        if (result && result.success && result.data) {
          const events = Array.isArray(result.data)
            ? result.data
            : result.data.data || [];
          console.log("Events count:", events.length);

          // Find TreeLinkedToBatch events
          const treeLinks = events.filter(
            (e) => e.event_name === "TreeLinkedToBatch"
          );

          console.log("TreeLinkedToBatch events:", treeLinks.length);

          if (treeLinks.length > 0) {
            // ✅ FIX: Parse event_data an toàn
            const treeIds = treeLinks
              .map((link) => {
                try {
                  // Check if already object or string
                  let eventData = link.event_data;

                  if (typeof eventData === "string") {
                    eventData = JSON.parse(eventData);
                  } else if (
                    typeof eventData !== "object" ||
                    eventData === null
                  ) {
                    console.error("Invalid event_data type:", typeof eventData);
                    return null;
                  }

                  return eventData.treeId;
                } catch (e) {
                  console.error("Parse event data error:", e, link);
                  return null;
                }
              })
              .filter((id) => id !== null);

            console.log("Tree IDs:", treeIds);

            if (treeIds.length > 0) {
              // Load tree details
              const treesResult = await API.getMyTrees();
              if (treesResult && treesResult.success && treesResult.data) {
                const allTrees = treesResult.data.data || [];
                this.sourceTrees = allTrees.filter((t) =>
                  treeIds.includes(t.tree_id.toString())
                );
                console.log("Source trees loaded:", this.sourceTrees.length);
              }
            }
          }
        } else {
          console.warn("No blockchain events data");
        }
      } catch (error) {
        console.error("Load source trees error:", error);
        // ✅ Không critical, chỉ log
        this.sourceTrees = [];
      } finally {
        this.loadingTrees = false;
      }
    },

    /**
     * Load images
     */
    async loadImages() {
      try {
        const result = await API.get(`/api/batch/${this.batchId}/images`);

        // ✅ DEBUG
        console.log("🖼️ Images API response:", result);
        console.log("Images data:", result.data);

        // ✅ FIX: Check multiple possible structures
        let images = [];

        if (result && result.success) {
          // Try different possible structures
          if (result.data?.data?.images) {
            images = result.data.data.images;
          } else if (result.data?.images) {
            images = result.data.images;
          } else if (Array.isArray(result.data)) {
            images = result.data;
          }
        }

        this.images = Array.isArray(images) ? images : [];
        console.log("✅ Final images:", this.images);
      } catch (error) {
        console.error("Load images error:", error);
        this.images = [];
      }
    },

    /**
     * Generate timeline based on batch status
     */
    generateTimeline() {
      this.timeline = [
        {
          title: "Tạo lô hàng",
          description: "Lô hàng được tạo và chờ phê duyệt",
          icon: "fas fa-plus",
          completed: true,
          date: this.batch.created_at || this.batch.production_date_iso,
        },
        {
          title: "Phê duyệt",
          description:
            this.batch.status === "Approved"
              ? "Lô hàng đã được phê duyệt"
              : this.batch.status === "Rejected"
              ? "Lô hàng bị từ chối"
              : "Đang chờ phê duyệt",
          icon:
            this.batch.status === "Approved"
              ? "fas fa-check"
              : this.batch.status === "Rejected"
              ? "fas fa-times"
              : "fas fa-clock",
          completed: this.batch.status !== "PendingApproval",
          date: this.batch.approved_on || null,
        },
        {
          title: "Thu mua",
          description:
            this.batch.current_stage === "Purchased" ||
            this.isStageAfter("Purchased")
              ? "Lô hàng đã được thu mua"
              : "Chờ thu mua",
          icon: "fas fa-shopping-cart",
          completed:
            this.batch.current_stage === "Purchased" ||
            this.isStageAfter("Purchased"),
          date: null,
        },
        {
          title: "Vận chuyển",
          description:
            this.batch.transport_status === "Delivered"
              ? "Đã vận chuyển đến nơi"
              : this.batch.transport_status === "InTransit"
              ? "Đang vận chuyển"
              : "Chờ vận chuyển",
          icon: "fas fa-truck",
          completed: this.batch.transport_status === "Delivered",
          date: null,
        },
        {
          title: "Sơ chế",
          description:
            this.batch.current_stage === "Processed" ||
            this.isStageAfter("Processed")
              ? "Đã hoàn thành sơ chế"
              : "Chờ sơ chế",
          icon: "fas fa-industry",
          completed:
            this.batch.current_stage === "Processed" ||
            this.isStageAfter("Processed"),
          date: null,
        },
        {
          title: "Kiểm nghiệm",
          description:
            this.batch.current_stage === "QualityInspected" ||
            this.isStageAfter("QualityInspected")
              ? "Đã kiểm nghiệm chất lượng"
              : "Chờ kiểm nghiệm",
          icon: "fas fa-microscope",
          completed:
            this.batch.current_stage === "QualityInspected" ||
            this.isStageAfter("QualityInspected"),
          date: null,
        },
        {
          title: "Nhập kho",
          description:
            this.batch.current_stage === "Warehoused"
              ? "Đã nhập kho"
              : "Chờ nhập kho",
          icon: "fas fa-warehouse",
          completed: this.batch.current_stage === "Warehoused",
          date: null,
        },
      ];
    },

    /**
     * Check if current stage is after a specific stage
     */
    isStageAfter(targetStage) {
      const stageOrder = [
        "Created",
        "Purchased",
        "Transported1",
        "Processed",
        "QualityInspected",
        "Transported2",
        "Warehoused",
      ];

      const currentIndex = stageOrder.indexOf(this.batch.current_stage);
      const targetIndex = stageOrder.indexOf(targetStage);

      return currentIndex > targetIndex;
    },

    /**
     * View image in modal
     */
    viewImage(url) {
      Swal.fire({
        imageUrl: url,
        imageAlt: "Ảnh",
        showCloseButton: true,
        showConfirmButton: false,
        width: 800,
      });
    },

    /**
     * View public traceability page
     */
    viewPublicPage() {
      if (!this.batch || !this.batch.sscc) {
        Utils.toast.error("Không tìm thấy SSCC");
        return;
      }

      window.open(`/batch/${this.batch.sscc}`, "_blank");
    },
  };
}

/**
 * Initialize auth
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
