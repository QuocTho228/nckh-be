/**
 * ========================================
 * PROCESSING-FORM.JS - Logic Form Ghi Nhận Sơ Chế
 * ========================================
 */

function processingForm() {
  return {
    loading: true,
    error: null,
    batchId: null,
    batchData: null,
    submitting: false,

    formData: {
      method: "",
      methodDescription: "",
      inputWeight: "",
      outputWeight: "",
      notes: "",
    },

    imageFiles: [],
    imagePreviews: [],
    efficiency: "",

    /**
     * Initialize
     */
    async init() {
      const isAuthorized = await Auth.requireProcessor();
      if (!isAuthorized) return;

      // Get batch ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      this.batchId = urlParams.get("id");

      if (!this.batchId) {
        this.error = "Không tìm thấy ID lô hàng";
        this.loading = false;
        return;
      }

      await this.loadBatchData();
      Auth.updateNavbar();
    },

    /**
     * Load batch data
     */
    async loadBatchData() {
      this.loading = true;
      this.error = null;

      try {
        const result = await API.getBatchProcessingDetails(this.batchId);

        if (!result.success) {
          throw new Error(result.error || "Lỗi khi tải thông tin lô hàng");
        }

        this.batchData = result.data.data;

        if (!this.batchData.batch) {
          throw new Error("Không tìm thấy lô hàng");
        }

        // Validate stage
        const validStages = ["Purchased", "Transported1"];
        if (!validStages.includes(this.batchData.batch.current_stage)) {
          throw new Error(
            "Lô hàng này không sẵn sàng để sơ chế (Stage: " +
              this.batchData.batch.current_stage +
              ")",
          );
        }

        // Extract purchase data
        if (this.batchData.batch) {
          this.batchData.purchaseQuantity =
            this.batchData.batch.total_quantity || 0;
          this.batchData.purchaseDate =
            this.batchData.batch.purchase_date_iso ||
            this.batchData.batch.created_at;
          this.batchData.qualityGrade =
            this.batchData.batch.quality_grade || "N/A";
        }

        if (
          this.batchData.purchaseImages &&
          Array.isArray(this.batchData.purchaseImages)
        ) {
          this.batchData.purchaseImages = this.batchData.purchaseImages
            .map((img) => (typeof img === "string" ? img : img.image_url || ""))
            .filter((url) => url);
        } else {
          this.batchData.purchaseImages = [];
        }

        console.log("Batch data loaded:", this.batchData);
      } catch (error) {
        console.error("Load batch data error:", error);
        this.error = error.message || "Lỗi khi tải thông tin lô hàng";
      } finally {
        this.loading = false;
      }
    },

    /**
     * Handle image upload
     */
    async handleImageUpload(event) {
      const files = Array.from(event.target.files);

      if (files.length === 0) return;

      const validation = Utils.validateFiles(files);
      if (!validation.valid) {
        Utils.toast.error(validation.error);
        event.target.value = "";
        return;
      }

      if (this.imageFiles.length + files.length > 10) {
        Utils.toast.error("Chỉ được tải lên tối đa 10 ảnh");
        event.target.value = "";
        return;
      }

      this.imageFiles.push(...files);

      for (const file of files) {
        const preview = await Utils.previewImage(file);
        this.imagePreviews.push(preview);
      }

      event.target.value = "";
      Utils.toast.success(`Đã thêm ${files.length} ảnh`);
    },

    /**
     * Remove image
     */
    removeImage(index) {
      this.imageFiles.splice(index, 1);
      this.imagePreviews.splice(index, 1);
    },

    /**
     * Calculate efficiency
     */
    calculateEfficiency() {
      const input = parseFloat(this.formData.inputWeight);
      const output = parseFloat(this.formData.outputWeight);

      if (input > 0 && output > 0) {
        this.efficiency = ((output / input) * 100).toFixed(2);
      } else {
        this.efficiency = "";
      }
    },

    /**
     * View image
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
     * Submit processing
     */
    async submitProcessing() {
      // Validate
      if (!this.formData.method) {
        Utils.toast.error("Vui lòng chọn phương pháp sơ chế");
        return;
      }

      const input = parseFloat(this.formData.inputWeight);
      const output = parseFloat(this.formData.outputWeight);

      if (!input || input <= 0) {
        Utils.toast.error("Vui lòng nhập khối lượng đầu vào hợp lệ");
        return;
      }

      if (!output || output <= 0) {
        Utils.toast.error("Vui lòng nhập khối lượng đầu ra hợp lệ");
        return;
      }

      if (output > input) {
        Utils.toast.error(
          "Khối lượng đầu ra không thể lớn hơn khối lượng đầu vào",
        );
        return;
      }

      // Confirm
      const confirmed = await Swal.fire({
        title: "Xác nhận ghi nhận sơ chế",
        html: `
          <div class="text-left space-y-3">
            <p class="font-semibold">Lô hàng: ${this.batchData.batch.batch_name}</p>
            <div class="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Phương pháp:</span>
                <span class="font-semibold">${this.getMethodName(
                  this.formData.method,
                )}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Khối lượng đầu vào:</span>
                <span class="font-semibold">${input} kg</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Khối lượng đầu ra:</span>
                <span class="font-semibold">${output} kg</span>
              </div>
              <div class="flex justify-between border-t pt-2">
                <span class="text-gray-600">Hiệu suất:</span>
                <span class="font-semibold text-green-600">${this.efficiency}%</span>
              </div>
            </div>
            <p class="text-sm text-gray-500 mt-3">
              <i class="fas fa-info-circle mr-1"></i>
              Thông tin sẽ được ghi lên blockchain và không thể thay đổi.
            </p>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Xác nhận ghi nhận",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#028040",
        width: 600,
      });

      if (!confirmed.isConfirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        const formData = new FormData();
        formData.append("batchId", this.batchId);
        formData.append("method", this.formData.method);
        formData.append(
          "methodDescription",
          this.formData.methodDescription || "",
        );
        formData.append("inputWeight", input);
        formData.append("outputWeight", output);
        formData.append("notes", this.formData.notes || "");

        for (const file of this.imageFiles) {
          formData.append("processingImages", file);
        }

        const result = await API.recordProcessing(formData);

        // ✅ DEBUG: Log full response
        console.log("🔍 Processing API Response:", result);

        Utils.loading.hide();

        if (result.success) {
          // ✅ Handle different response structures
          const responseData = result.data?.data || result.data || {};

          console.log("📦 Response Data:", responseData);

          await Swal.fire({
            icon: "success",
            title: "Ghi nhận sơ chế thành công!",
            html: `
              <div class="text-left space-y-3">
                <p>Lô hàng <strong>${this.batchData.batch.batch_name}</strong> đã được sơ chế.</p>
                <div class="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Processing ID:</span>
                    <span class="font-mono">${responseData.processingId || "N/A"}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Hiệu suất:</span>
                    <span class="font-semibold text-green-600">${responseData.efficiency || this.efficiency + "%"}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Số ảnh:</span>
                    <span>${responseData.imageCount || this.imageFiles.length || 0}</span>
                  </div>
                </div>
                <p class="text-xs text-gray-500 mt-3">Transaction Hash:</p>
                <p class="text-xs font-mono bg-gray-100 p-2 rounded break-all">
                  ${responseData.transactionHash || "N/A"}
                </p>
              </div>
            `,
            confirmButtonColor: "#028040",
            confirmButtonText: "OK",
          });

          // Redirect to packaging page
          window.location.href = `/processor/dong-goi-san-pham.html?id=${this.batchId}`;
        } else {
          Utils.toast.error(result.error || "Lỗi khi ghi nhận sơ chế");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("❌ Submit error:", error);
        Utils.toast.error("Lỗi khi ghi nhận sơ chế: " + error.message);
      } finally {
        this.submitting = false;
      }
    },

    /**
     * Get method name
     */
    getMethodName(methodId) {
      const methods = {
        0: "Rửa (Washing)",
        1: "Cắt (Cutting)",
        2: "Sấy khô (Drying)",
        3: "Đông lạnh (Freezing)",
        4: "Đóng gói (Packaging)",
      };
      return methods[methodId] || "Unknown";
    },
  };
}

/**
 * Initialize auth
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
