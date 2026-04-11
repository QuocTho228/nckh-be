/**
 * ========================================
 * PURCHASE-FORM.JS - Logic Ghi Nhận Thu Mua
 * ========================================
 */

function purchaseForm() {
  return {
    loading: true,
    error: null,
    batchId: null,
    batchData: null,
    submitting: false,

    // Form data
    formData: {
      quantityKg: "",
      pricePerKg: "",
      qualityGrade: "",
      notes: "",
      images: [],
    },

    // Computed: Total price
    get totalPrice() {
      const quantity = parseFloat(this.formData.quantityKg) || 0;
      const price = parseFloat(this.formData.pricePerKg) || 0;
      return quantity * price;
    },

    /**
     * Initialize
     */
    async init() {
      const isAuthorized = await Auth.requirePurchaser();
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
        const result = await API.get(
          `/api/purchaser/batch/${this.batchId}/details`,
        );

        if (!result.success) {
          throw new Error(result.error || "Lỗi khi tải thông tin lô hàng");
        }

        this.batchData = result.data.data;
        console.log("Batch data loaded:", this.batchData);

        if (!this.batchData.batch) {
          throw new Error("Không tìm thấy lô hàng");
        }

        // Set default quantity
        this.formData.quantityKg = this.batchData.batch.quantity;
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
    async handleImages(event) {
      const files = Array.from(event.target.files);

      // Validate
      const validation = Utils.validateFiles(files);
      if (!validation.valid) {
        Utils.toast.error(validation.error);
        event.target.value = "";
        return;
      }

      this.formData.images = files;

      // Preview
      const container = document.getElementById("imagePreview");
      container.innerHTML = "";

      for (let file of files) {
        const preview = await Utils.previewImage(file);
        const div = document.createElement("div");
        div.className = "relative";
        div.innerHTML = `
          <img src="${preview}" class="w-full h-20 object-cover rounded-lg">
          <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition rounded-lg">
            <i class="fas fa-eye text-white"></i>
          </div>
        `;
        container.appendChild(div);
      }
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
     * Submit purchase
     */
    async submitPurchase() {
      // Validate
      if (
        !this.formData.quantityKg ||
        parseFloat(this.formData.quantityKg) <= 0
      ) {
        Utils.toast.error("Vui lòng nhập số lượng hợp lệ");
        return;
      }

      if (
        !this.formData.pricePerKg ||
        parseFloat(this.formData.pricePerKg) <= 0
      ) {
        Utils.toast.error("Vui lòng nhập đơn giá hợp lệ");
        return;
      }

      const quantity = parseFloat(this.formData.quantityKg);
      const maxQuantity = parseFloat(this.batchData.batch.quantity);

      if (quantity > maxQuantity) {
        Utils.toast.error(`Số lượng không được vượt quá ${maxQuantity} kg`);
        return;
      }

      // Confirmation
      const confirmed = await Swal.fire({
        title: "Xác nhận thu mua",
        html: `
          <div class="text-left">
            <p class="mb-4">Bạn có chắc muốn ghi nhận thu mua lô hàng này?</p>
            <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Lô hàng:</span>
                <span class="font-semibold">${
                  this.batchData.batch.batch_name
                }</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Số lượng:</span>
                <span class="font-semibold">${quantity} kg</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Đơn giá:</span>
                <span class="font-semibold">${Utils.formatNumber(
                  this.formData.pricePerKg,
                )} VNĐ/kg</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Chất lượng:</span>
                <span class="font-semibold">${this.formData.qualityGrade || "Không xác định"}</span>
              </div>
              <div class="flex justify-between border-t pt-2 mt-2">
                <span class="text-gray-600">Tổng giá trị:</span>
                <span class="font-bold text-green-600">${Utils.formatNumber(
                  this.totalPrice,
                )} VNĐ</span>
              </div>
            </div>
            <p class="mt-4 text-xs text-gray-500">
              <i class="fas fa-info-circle mr-1"></i>
              Sau khi xác nhận, giao dịch sẽ được ghi lên blockchain và không thể hoàn tác.
            </p>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Xác nhận mua",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#028040",
        cancelButtonColor: "#6b7280",
      });

      if (!confirmed.isConfirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        // Create FormData
        const formData = new FormData();
        formData.append("batchId", this.batchId);
        formData.append("totalQuantity", this.formData.quantityKg);
        formData.append("pricePerUnit", this.formData.pricePerKg);

        if (this.formData.qualityGrade) {
          formData.append("qualityGrade", this.formData.qualityGrade);
        }

        if (this.formData.notes) {
          formData.append("notes", this.formData.notes);
        }

        // Append images
        for (let i = 0; i < this.formData.images.length; i++) {
          formData.append("purchaseImages", this.formData.images[i]);
        }

        // Submit
        const result = await API.post(
          "/api/purchaser/record-purchase",
          formData,
        );

        Utils.loading.hide();

        if (result.success) {
          await Swal.fire({
            icon: "success",
            title: "Thu mua thành công!",
            html: `
              <p class="mb-2">Đã ghi nhận thu mua lô hàng <strong>${
                this.batchData.batch.batch_name
              }</strong></p>
              <div class="bg-gray-50 rounded-lg p-4 mt-4 text-sm text-left">
                <p class="text-gray-600 mb-2">Thông tin giao dịch:</p>
                <p><span class="text-gray-600">Mã giao dịch:</span> <strong>#${
                  result.data.data.purchaseId
                }</strong></p>
                <p><span class="text-gray-600">Số lượng:</span> <strong>${quantity} kg</strong></p>
                <p><span class="text-gray-600">Đơn giá:</span> <strong>${Utils.formatNumber(
                  this.formData.pricePerKg,
                )} VNĐ/kg</strong></p>
                <p><span class="text-gray-600">Chất lượng:</span> <strong>${this.formData.qualityGrade || "Không xác định"}</strong></p>
                <p><span class="text-gray-600">Tổng giá trị:</span> <strong class="text-green-600">${Utils.formatNumber(
                  this.totalPrice,
                )} VNĐ</strong></p>
              </div>
              <p class="text-xs text-gray-500 mt-3">
                <i class="fas fa-check-circle mr-1"></i>
                Giao dịch đã được ghi lên blockchain
              </p>
            `,
            confirmButtonColor: "#028040",
            confirmButtonText: "Xem lịch sử",
          });

          // Redirect to history
          window.location.href = "/purchaser/lich-su-mua.html";
        } else {
          Utils.toast.error(result.error || "Lỗi khi ghi nhận mua hàng");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Submit purchase error:", error);
        Utils.toast.error("Lỗi khi ghi nhận mua hàng: " + error.message);
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
