/**
 * ========================================
 * TEST-FORM.JS - Form ghi nhận kiểm nghiệm
 * ========================================
 */

function testFormData() {
  return {
    batchId: null,
    batchInfo: null,
    loadingBatch: true,
    submitting: false,

    formData: {
      passed: "",
      testType: "",
      testMethod: "",
      result: "",
      standard: "",
      notes: "",
    },

    selectedFiles: [],
    previewImages: [],

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireQualityInspector();
      if (!isAuthorized) return;

      // Get batchId from URL
      const urlParams = new URLSearchParams(window.location.search);
      this.batchId = urlParams.get("batchId");

      if (!this.batchId) {
        Utils.toast.error("Không tìm thấy thông tin lô hàng");
        setTimeout(() => {
          window.location.href =
            "/quality-inspector/danh-sach-lo-can-kiem.html";
        }, 1500);
        return;
      }

      // Load batch info
      await this.loadBatchInfo();
    },

    async loadBatchInfo() {
      this.loadingBatch = true;

      try {
        // Get batch processing info
        const result = await API.getQualityInspectorBatchProcessingInfo(
          this.batchId,
        );

        if (result.success && result.data.data) {
          this.batchInfo = result.data.data;
        } else {
          Utils.toast.error("Không tìm thấy thông tin lô hàng");
          setTimeout(() => {
            window.location.href =
              "/quality-inspector/danh-sach-lo-can-kiem.html";
          }, 1500);
        }
      } catch (error) {
        console.error("Load batch info error:", error);
        Utils.toast.error("Lỗi khi tải thông tin lô hàng");
      } finally {
        this.loadingBatch = false;
      }
    },

    async handleFileSelect(event) {
      const files = Array.from(event.target.files);

      // Validate số lượng
      if (files.length + this.selectedFiles.length > CONFIG.FILE.MAX_IMAGES) {
        Utils.toast.error(
          `Chỉ được tải lên tối đa ${CONFIG.FILE.MAX_IMAGES} ảnh`,
        );
        event.target.value = "";
        return;
      }

      // Validate từng file
      for (const file of files) {
        const validation = Utils.validateFile(file);
        if (!validation.valid) {
          Utils.toast.error(validation.error);
          event.target.value = "";
          return;
        }
      }

      // Preview images
      for (const file of files) {
        try {
          const preview = await Utils.previewImage(file);
          this.previewImages.push(preview);
          this.selectedFiles.push(file);
        } catch (error) {
          console.error("Preview error:", error);
        }
      }

      event.target.value = "";
    },

    removeImage(index) {
      this.previewImages.splice(index, 1);
      this.selectedFiles.splice(index, 1);
    },

    async submitTest() {
      // Validate
      if (!this.formData.passed) {
        Utils.toast.error("Vui lòng chọn kết quả kiểm nghiệm");
        return;
      }

      // Confirm
      const confirmed = await Utils.confirm(
        "Xác nhận ghi nhận",
        `Bạn xác nhận lô hàng này ${this.formData.passed === "true" ? "ĐẠT" : "KHÔNG ĐẠT"} chất lượng?`,
        "Xác nhận",
      );

      if (!confirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        // Prepare FormData
        const formData = new FormData();
        formData.append("batchId", this.batchId);
        formData.append("passed", this.formData.passed);

        if (this.formData.testType) {
          formData.append("testType", this.formData.testType);
        }
        if (this.formData.testMethod) {
          formData.append("testMethod", this.formData.testMethod);
        }
        if (this.formData.result) {
          formData.append("result", this.formData.result);
        }
        if (this.formData.standard) {
          formData.append("standard", this.formData.standard);
        }
        if (this.formData.notes) {
          formData.append("notes", this.formData.notes);
        }

        // Append images
        this.selectedFiles.forEach((file) => {
          formData.append("testImages", file);
        });

        // Submit
        const result = await API.recordQualityTest(formData);

        if (result.success) {
          Utils.toast.success(
            result.data.message || "Đã ghi nhận kết quả kiểm nghiệm",
          );

          // Show result info
          await Swal.fire({
            title: "Thành công!",
            html: `
              <div class="text-left">
                <p><strong>Kết quả:</strong> ${this.formData.passed === "true" ? "✓ ĐẠT" : "✗ KHÔNG ĐẠT"}</p>
                <p><strong>Mã test:</strong> ${result.data.data.testId || "N/A"}</p>
                ${result.data.data.imageCount > 0 ? `<p><strong>Số ảnh:</strong> ${result.data.data.imageCount}</p>` : ""}
              </div>
            `,
            icon: "success",
            confirmButtonText: "Về danh sách",
          });

          // Redirect
          window.location.href =
            "/quality-inspector/danh-sach-lo-can-kiem.html";
        } else {
          Utils.toast.error(result.error || "Lỗi khi ghi nhận kiểm nghiệm");
        }
      } catch (error) {
        console.error("Submit test error:", error);
        Utils.toast.error("Lỗi khi ghi nhận kiểm nghiệm");
      } finally {
        this.submitting = false;
        Utils.loading.hide();
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
