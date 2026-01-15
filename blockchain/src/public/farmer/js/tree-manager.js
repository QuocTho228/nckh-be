/**
 * ========================================
 * TREE-MANAGER.JS - Logic Quản Lý Cây
 * ========================================
 */

/**
 * Alpine.js component cho tree manager
 */
function treeManager() {
  return {
    // Data
    trees: [],
    selectedTrees: [],
    loading: true,
    searchQuery: "",
    filterStatus: "all",

    // Stats
    stats: {
      total: 0,
      active: 0,
      harvested: 0,
    },

    // Modals - PHẢI là false khi khởi tạo
    showAddTreeModal: false,
    showAddCareModal: false,
    showTreeDetailModal: false,
    currentTree: null,

    // Computed: Filtered trees
    get filteredTrees() {
      let filtered = this.trees;

      // Filter by status
      if (this.filterStatus !== "all") {
        filtered = filtered.filter((tree) => {
          if (this.filterStatus === "active") return tree.is_active;
          if (this.filterStatus === "harvested") return !tree.is_active;
          return true;
        });
      }

      // Filter by search
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (tree) =>
            tree.tree_qr_code?.toLowerCase().includes(query) ||
            tree.tree_type?.toLowerCase().includes(query) ||
            tree.variety?.toLowerCase().includes(query) ||
            tree.coordinates?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },

    /**
     * Initialize
     */
    async init() {
      console.log("Tree Manager initializing...");

      // FORCE CLOSE ALL MODALS
      this.showAddTreeModal = false;
      this.showAddCareModal = false;
      this.showTreeDetailModal = false;
      this.currentTree = null;

      // Check auth
      const isAuthorized = await Auth.requireFarmer();
      if (!isAuthorized) return;

      // Load trees
      await this.loadTrees();

      // Update navbar
      Auth.updateNavbar();

      console.log("Tree Manager initialized successfully");
      console.log("Modal states:", {
        addTree: this.showAddTreeModal,
        addCare: this.showAddCareModal,
        treeDetail: this.showTreeDetailModal,
      });

      // SAFETY CHECK: Close any modals that might have been opened
      setTimeout(() => {
        if (this.showTreeDetailModal) {
          console.warn("Modal was opened unexpectedly! Closing...");
          this.closeTreeDetailModal();
        }
      }, 500);
    },

    /**
     * Load trees from API
     */
    async loadTrees() {
      this.loading = true;

      try {
        const result = await API.getMyTrees();

        if (result.success) {
          this.trees = result.data.data || [];
          this.updateStats();
          console.log("Loaded trees:", this.trees.length);
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách cây");
        }
      } catch (error) {
        console.error("Load trees error:", error);
        Utils.toast.error("Lỗi khi tải danh sách cây");
      } finally {
        this.loading = false;
      }
    },

    /**
     * Update statistics
     */
    updateStats() {
      this.stats.total = this.trees.length;
      this.stats.active = this.trees.filter((t) => t.is_active).length;
      this.stats.harvested = this.trees.filter((t) => !t.is_active).length;
    },

    /**
     * Toggle tree selection
     */
    toggleTreeSelection(treeId) {
      const index = this.selectedTrees.indexOf(treeId);
      if (index > -1) {
        this.selectedTrees.splice(index, 1);
      } else {
        this.selectedTrees.push(treeId);
      }
      console.log("Selected trees:", this.selectedTrees);
    },

    /**
     * Clear filters
     */
    clearFilters() {
      this.searchQuery = "";
      this.filterStatus = "all";
    },

    /**
     * Get tree age
     */
    getTreeAge(plantedDate) {
      if (!plantedDate) return "N/A";

      const planted = new Date(plantedDate);
      const now = new Date();
      const diffTime = Math.abs(now - planted);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 30) {
        return `${diffDays} ngày tuổi`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} tháng tuổi`;
      } else {
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        return `${years} năm ${months} tháng`;
      }
    },

    /**
     * Open add tree modal
     */
    openAddTreeModal() {
      console.log("Opening add tree modal...");
      this.showAddTreeModal = true;

      // Sử dụng $nextTick để đợi Alpine render xong
      this.$nextTick(() => {
        // Thêm một chút delay để chắc chắn DOM đã sẵn sàng
        setTimeout(() => {
          const container = document.getElementById("addTreeFormContainer");
          if (!container) {
            console.error("addTreeFormContainer not found after render!");
            this.showAddTreeModal = false;
            Utils.toast.error("Lỗi khi mở form đăng ký cây");
            return;
          }

          if (window.TreeForm) {
            console.log("Rendering add tree form...");
            TreeForm.renderAddTreeForm("addTreeFormContainer", {
              onSuccess: () => {
                this.closeAddTreeModal();
                this.loadTrees();
              },
              onCancel: () => {
                this.closeAddTreeModal();
              },
            });
          } else {
            console.error("TreeForm not found!");
            Utils.toast.error("Lỗi: TreeForm chưa được load");
          }
        }, 100);
      });
    },

    /**
     * Close add tree modal
     */
    closeAddTreeModal() {
      console.log("Closing add tree modal...");
      this.showAddTreeModal = false;

      // Clear form container
      const container = document.getElementById("addTreeFormContainer");
      if (container) {
        container.innerHTML = "";
      }
    },

    /**
     * Open add care modal
     */
    openAddCareModal() {
      if (this.selectedTrees.length === 0) {
        Utils.toast.warning("Vui lòng chọn ít nhất 1 cây");
        return;
      }

      console.log("Opening add care modal for trees:", this.selectedTrees);
      this.showAddCareModal = true;

      // Sử dụng $nextTick để đợi Alpine render xong
      this.$nextTick(() => {
        setTimeout(() => {
          const container = document.getElementById("addCareFormContainer");
          if (!container) {
            console.error("addCareFormContainer not found after render!");
            this.showAddCareModal = false;
            Utils.toast.error("Lỗi khi mở form chăm sóc");
            return;
          }

          if (window.TreeForm) {
            console.log("Rendering add care form...");
            TreeForm.renderAddCareForm("addCareFormContainer", {
              treeIds: this.selectedTrees,
              trees: this.trees.filter((t) =>
                this.selectedTrees.includes(t.tree_id)
              ),
              onSuccess: () => {
                this.closeAddCareModal();
                this.selectedTrees = [];
                this.loadTrees();
              },
              onCancel: () => {
                this.closeAddCareModal();
              },
            });
          } else {
            console.error("TreeForm not found!");
            Utils.toast.error("Lỗi: TreeForm chưa được load");
          }
        }, 100);
      });
    },

    /**
     * Close add care modal
     */
    closeAddCareModal() {
      console.log("Closing add care modal...");
      this.showAddCareModal = false;

      // Clear form container
      const container = document.getElementById("addCareFormContainer");
      if (container) {
        container.innerHTML = "";
      }
    },

    /**
     * Quick add care for single tree
     */
    quickAddCare(tree) {
      if (!tree.is_active) {
        Utils.toast.warning("Cây đã thu hoạch, không thể chăm sóc");
        return;
      }

      console.log("Quick add care for tree:", tree.tree_qr_code);
      this.selectedTrees = [tree.tree_id];
      this.openAddCareModal();
    },

    /**
     * View tree details
     */
    async viewTreeDetails(tree) {
      console.log("Viewing tree details:", tree.tree_qr_code);
      this.currentTree = tree;
      this.showTreeDetailModal = true;

      // Sử dụng $nextTick để đợi Alpine render xong
      this.$nextTick(() => {
        setTimeout(async () => {
          const container = document.getElementById("treeDetailContainer");
          if (!container) {
            console.error("treeDetailContainer not found after render!");
            this.showTreeDetailModal = false;
            Utils.toast.error("Lỗi khi mở chi tiết cây");
            return;
          }

          container.innerHTML = `
          <div class="space-y-6">
            <!-- Tree Info -->
            <div class="bg-gradient-primary rounded-xl p-6 text-white">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-2xl font-bold mb-2">${tree.tree_qr_code}</h3>
                  <p class="opacity-90">${tree.tree_type} - ${tree.variety}</p>
                </div>
                <span class="${
                  tree.is_active
                    ? "bg-white text-green-600"
                    : "bg-gray-200 text-gray-600"
                } px-4 py-2 rounded-full font-semibold">
                  ${tree.is_active ? "Đang hoạt động" : "Đã thu hoạch"}
                </span>
              </div>
              
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p class="opacity-75 mb-1">Ngày trồng</p>
                  <p class="font-semibold">${Utils.formatDate(
                    tree.planted_date_iso
                  )}</p>
                </div>
                <div>
                  <p class="opacity-75 mb-1">Tuổi cây</p>
                  <p class="font-semibold">${this.getTreeAge(
                    tree.planted_date_iso
                  )}</p>
                </div>
                <div>
                  <p class="opacity-75 mb-1">Vị trí</p>
                  <p class="font-semibold truncate" title="${
                    tree.coordinates || "N/A"
                  }">${tree.coordinates || "N/A"}</p>
                </div>
                <div>
                  <p class="opacity-75 mb-1">QR Code</p>
                  <button 
                    onclick="Utils.copyToClipboard('${tree.tree_qr_code}')" 
                    class="font-semibold hover:underline"
                    type="button"
                  >
                    <i class="fas fa-copy mr-1"></i> Sao chép
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Activities -->
            <div>
              <h4 class="text-lg font-bold mb-4 flex items-center gap-2">
                <i class="fas fa-history text-green-600"></i>
                Lịch sử chăm sóc
              </h4>
              
              <div id="treeActivities" class="space-y-4">
                <div class="flex justify-center py-8">
                  <div class="spinner"></div>
                </div>
              </div>
            </div>
          </div>
        `;

          // Load activities
          await this.loadTreeActivities(tree.tree_id);
        }, 100);
      });
    },

    /**
     * Load tree activities
     */
    async loadTreeActivities(treeId) {
      const container = document.getElementById("treeActivities");
      if (!container) return;

      try {
        const result = await API.get(`/api/farmer/trees/${treeId}/activities`);

        const response = result.data;
        if (!response.success) {
          throw new Error(response.error || "Lỗi khi tải dữ liệu");
        }

        const activities = response.data;

        if (!Array.isArray(activities) || activities.length === 0) {
          container.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>Chưa có hoạt động nào</p>
        </div>
      `;
          return;
        }

        container.innerHTML = activities
          .map(
            (act) => `
      <div class="border-l-4 border-green-500 bg-gray-50 rounded-r-lg p-4 mb-4">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h5 class="font-bold text-gray-900">${act.activityName}</h5>
            <p class="text-sm text-gray-600">${Utils.getCategoryName(
              act.category
            )}</p>
          </div>
          <span class="text-sm text-gray-500">${Utils.formatDateTime(
            act.timestamp
          )}</span>
        </div>
        
        ${
          act.description
            ? `<p class="text-gray-700 mb-2">${act.description}</p>`
            : ""
        }
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
          ${
            act.fertilizer
              ? `
            <div>
              <span class="font-semibold">Phân bón:</span> ${act.fertilizer}
            </div>
          `
              : ""
          }
          ${
            act.pesticide
              ? `
            <div>
              <span class="font-semibold">Thuốc trừ sâu:</span> ${act.pesticide}
            </div>
          `
              : ""
          }
          ${
            act.quantity
              ? `
            <div>
              <span class="font-semibold">Số lượng:</span> ${act.quantity} ${
                  act.unit || ""
                }
            </div>
          `
              : ""
          }
          ${
            act.temperature
              ? `
            <div>
              <span class="font-semibold">Nhiệt độ:</span> ${act.temperature}°C
            </div>
          `
              : ""
          }
          ${
            act.humidity
              ? `
            <div>
              <span class="font-semibold">Độ ẩm:</span> ${act.humidity}%
            </div>
          `
              : ""
          }
          ${
            act.weather
              ? `
            <div>
              <span class="font-semibold">Thời tiết:</span> ${act.weather}
            </div>
          `
              : ""
          }
          ${
            act.healthStatus
              ? `
            <div>
              <span class="font-semibold">Tình trạng sức khỏe:</span> ${act.healthStatus}
            </div>
          `
              : ""
          }
        </div>
        
        ${
          act.notes
            ? `<p class="text-gray-700 mb-2"><span class="font-semibold">Ghi chú:</span> ${act.notes}</p>`
            : ""
        }
        
        ${
          act.images && act.images.length > 0
            ? `
          <div class="mt-2">
            <p class="font-semibold text-sm text-gray-600 mb-1">Ảnh minh chứng:</p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              ${act.images
                .map(
                  (img) => `
                <img src="${img}" alt="Ảnh hoạt động" class="w-full h-24 object-cover rounded" />
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }
        
        <div class="mt-2 text-sm text-gray-500">
          <span class="font-semibold">Người thực hiện:</span> ${
            act.participant.name
          } (${act.participant.phone})
        </div>
      </div>
    `
          )
          .join("");
      } catch (error) {
        console.error("Load activities error:", error);
        container.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <i class="fas fa-exclamation-circle text-4xl mb-2"></i>
        <p>Lỗi khi tải lịch sử chăm sóc: ${error.message}</p>
      </div>
    `;
      }
    },

    /**
     * Close tree detail modal
     */
    closeTreeDetailModal() {
      console.log("Closing tree detail modal...");
      this.showTreeDetailModal = false;
      this.currentTree = null;

      // Clear container
      const container = document.getElementById("treeDetailContainer");
      if (container) {
        container.innerHTML = "";
      }
    },
  };
}

/**
 * Initialize auth khi page load
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Initializing Auth...");
  await Auth.init();
});
