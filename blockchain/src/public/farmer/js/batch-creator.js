/**
 * ========================================
 * BATCH-CREATOR.JS - Logic Tạo Lô Hàng
 * ========================================
 */

function batchCreator() {
  return {
    currentStep: 1,
    submitting: false,

    // Master data
    products: [],
    trees: [],
    loadingTrees: true,

    // Search
    treeSearchQuery: "",

    // Form data
    formData: {
      name: "",
      productId: "",
      quantity: "",
      farmPlotNumber: "",
      startDate: "",
      endDate: "",
      harvestNotes: "",
      treeIds: [],
      productImages: [],
      certificateImage: null,
    },

    // Computed: Filtered active trees
    get filteredActiveTrees() {
      let filtered = this.trees.filter((t) => t.is_active);

      if (this.treeSearchQuery.trim()) {
        const query = this.treeSearchQuery.toLowerCase();
        filtered = filtered.filter(
          (tree) =>
            tree.tree_qr_code?.toLowerCase().includes(query) ||
            tree.tree_type?.toLowerCase().includes(query) ||
            tree.variety?.toLowerCase().includes(query)
        );
      }

      return filtered;
    },

    /**
     * Initialize
     */
    async init() {
      const isAuthorized = await Auth.requireFarmer();
      if (!isAuthorized) return;

      await this.loadMasterData();
      Auth.updateNavbar();

      // Set default dates
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      this.formData.startDate = yesterday.toISOString().split("T")[0];
      this.formData.endDate = today.toISOString().split("T")[0];
    },

    /**
     * Load master data
     */
    async loadMasterData() {
      try {
        // Load products
        const productsResult = await API.getProducts();
        if (productsResult.success) {
          this.products = productsResult.data;
        }

        // Load trees
        this.loadingTrees = true;
        const treesResult = await API.getMyTrees();
        if (treesResult.success) {
          this.trees = treesResult.data.data || [];
        }
      } catch (error) {
        console.error("Load master data error:", error);
        Utils.toast.error("Lỗi khi tải dữ liệu");
      } finally {
        this.loadingTrees = false;
      }
    },

    /**
     * Toggle tree selection
     */
    toggleTree(treeId) {
      const index = this.formData.treeIds.indexOf(treeId);
      if (index > -1) {
        this.formData.treeIds.splice(index, 1);
      } else {
        this.formData.treeIds.push(treeId);
      }
    },

    /**
     * Get product name by ID
     */
    getProductName(productId) {
      const product = this.products.find((p) => p.product_id == productId);
      return product ? product.product_name : "N/A";
    },

    /**
     * Get tree QR code by ID
     */
    getTreeQRCode(treeId) {
      const tree = this.trees.find((t) => t.tree_id == treeId);
      return tree ? tree.tree_qr_code : "N/A";
    },

    /**
     * Handle product images
     */
    async handleProductImages(event) {
      const files = Array.from(event.target.files);

      // Validate
      const validation = Utils.validateFiles(files);
      if (!validation.valid) {
        Utils.toast.error(validation.error);
        event.target.value = "";
        return;
      }

      this.formData.productImages = files;

      // Preview
      const container = document.getElementById("productImagesPreview");
      container.innerHTML = "";

      for (let file of files) {
        const preview = await Utils.previewImage(file);
        const div = document.createElement("div");
        div.className = "relative";
        div.innerHTML = `
          <img src="${preview}" class="w-full h-24 object-cover rounded-lg">
          <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition rounded-lg">
            <i class="fas fa-eye text-white"></i>
          </div>
        `;
        container.appendChild(div);
      }
    },

    /**
     * Handle certificate image
     */
    async handleCertificateImage(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Validate
      const validation = Utils.validateFile(file);
      if (!validation.valid) {
        Utils.toast.error(validation.error);
        event.target.value = "";
        return;
      }

      this.formData.certificateImage = file;

      // Preview
      const preview = await Utils.previewImage(file);
      const container = document.getElementById("certificateImagePreview");
      container.innerHTML = `
        <img src="${preview}" class="w-48 h-48 object-cover rounded-lg">
      `;
    },

    /**
     * Validate step
     */
    validateStep(step) {
      if (step === 1) {
        if (
          !this.formData.name ||
          !this.formData.productId ||
          !this.formData.quantity ||
          !this.formData.farmPlotNumber ||
          !this.formData.startDate ||
          !this.formData.endDate
        ) {
          Utils.toast.error("Vui lòng điền đầy đủ thông tin");
          return false;
        }

        if (parseFloat(this.formData.quantity) <= 0) {
          Utils.toast.error("Số lượng phải lớn hơn 0");
          return false;
        }

        const startDate = new Date(this.formData.startDate);
        const endDate = new Date(this.formData.endDate);
        if (startDate > endDate) {
          Utils.toast.error("Ngày bắt đầu không được sau ngày kết thúc");
          return false;
        }

        return true;
      }

      if (step === 2) {
        if (this.formData.treeIds.length === 0) {
          Utils.toast.error("Vui lòng chọn ít nhất 1 cây");
          return false;
        }
        return true;
      }

      if (step === 3) {
        if (this.formData.productImages.length === 0) {
          Utils.toast.error("Vui lòng tải lên ảnh sản phẩm");
          return false;
        }
        return true;
      }

      return true;
    },

    /**
     * Next step
     */
    nextStep() {
      if (!this.validateStep(this.currentStep)) {
        return;
      }

      if (this.currentStep < 4) {
        this.currentStep++;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },

    /**
     * Previous step
     */
    prevStep() {
      if (this.currentStep > 1) {
        this.currentStep--;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },

    /**
     * Submit batch
     */
    async submitBatch() {
      if (!this.validateStep(4)) return;

      const confirmed = await Utils.confirm(
        "Xác nhận tạo lô hàng",
        "Bạn có chắc muốn tạo lô hàng này?",
        "Tạo lô hàng"
      );

      if (!confirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        // Create FormData
        const formData = new FormData();
        formData.append("name", this.formData.name);
        formData.append("quantity", this.formData.quantity);
        formData.append("farmPlotNumber", this.formData.farmPlotNumber);
        formData.append("productId", this.formData.productId);
        formData.append("startDate", this.formData.startDate);
        formData.append("endDate", this.formData.endDate);
        formData.append("treeIds", JSON.stringify(this.formData.treeIds));
        formData.append("harvestNotes", this.formData.harvestNotes || "");

        // Append product images
        for (let i = 0; i < this.formData.productImages.length; i++) {
          formData.append("productImages", this.formData.productImages[i]);
        }

        // Append certificate image
        if (this.formData.certificateImage) {
          formData.append("certificateImage", this.formData.certificateImage);
        }

        // Submit
        const result = await API.createBatch(formData);

        Utils.loading.hide();

        if (result.success) {
          await Swal.fire({
            icon: "success",
            title: "Tạo lô hàng thành công!",
            html: `
              <p class="mb-2">Lô hàng <strong>${this.formData.name}</strong> đã được tạo.</p>
              <p class="text-sm text-gray-600">SSCC: <strong>${result.data.data.sscc}</strong></p>
              <p class="text-sm text-yellow-600 mt-3">
                <i class="fas fa-clock mr-1"></i>
                Lô hàng đang chờ phê duyệt
              </p>
            `,
            confirmButtonColor: "#028040",
            confirmButtonText: "Xem lô hàng",
          });

          // Redirect to batch detail
          window.location.href = `/farmer/chi-tiet-lo.html?id=${result.data.data.batchId}`;
        } else {
          Utils.toast.error(result.error || "Lỗi khi tạo lô hàng");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Submit batch error:", error);
        Utils.toast.error("Lỗi khi tạo lô hàng: " + error.message);
      } finally {
        this.submitting = false;
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
