/**
 * ========================================
 * CONFIRM-RECEIPT.JS - Form xác nhận nhận hàng
 * FIXED VERSION
 * ========================================
 */

function confirmReceiptData() {
  return {
    batchId: null,
    batchInfo: null,
    transportHistory: [],
    loadingBatch: true,
    submitting: false,

    checklist: {
      quantityMatch: false,
      qualityGood: false,
      packagingIntact: false,
      documentsComplete: false,
    },

    notes: "",

    get allChecklistPassed() {
      return (
        this.checklist.quantityMatch &&
        this.checklist.qualityGood &&
        this.checklist.packagingIntact &&
        this.checklist.documentsComplete
      );
    },

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireWarehouse();
      if (!isAuthorized) return;

      // Get batchId from URL
      const urlParams = new URLSearchParams(window.location.search);
      this.batchId = urlParams.get("batchId");

      if (!this.batchId) {
        Utils.toast.error("Không tìm thấy thông tin lô hàng");
        setTimeout(() => {
          window.location.href = "/warehouse/lo-dang-den.html";
        }, 1500);
        return;
      }

      // Load batch info
      await this.loadBatchInfo();
    },

    async loadBatchInfo() {
      this.loadingBatch = true;

      try {
        console.log("[DEBUG] Loading batch info for batchId:", this.batchId);

        const result = await API.getWarehouseBatchTransportInfo(this.batchId);

        // ✅ DEBUG: Xem chi tiết response structure
        console.log("[DEBUG] API result:", result);
        console.log("[DEBUG] result.success:", result.success);
        console.log("[DEBUG] result.data:", result.data);

        // ✅ FIX: Kiểm tra cả 2 trường hợp response structure
        let batchData = null;
        let transportData = [];

        if (result.success) {
          // Trường hợp 1: Backend trả { success: true, data: { batch, transportHistory } }
          if (result.data && result.data.batch) {
            batchData = result.data.batch;
            transportData = result.data.transportHistory || [];
          }
          // Trường hợp 2: Backend trả { success: true, batch, transportHistory } (less likely)
          else if (result.batch) {
            batchData = result.batch;
            transportData = result.transportHistory || [];
          }
        }

        console.log("[DEBUG] Extracted batchData:", batchData);
        console.log("[DEBUG] Extracted transportData:", transportData);

        if (batchData) {
          this.batchInfo = batchData;
          this.transportHistory = transportData;

          console.log("[DEBUG] Batch info set:", this.batchInfo);

          // Check if batch is eligible for warehouse confirmation
          if (this.batchInfo.current_stage !== "QualityInspected") {
            Utils.toast.error("Lô hàng chưa được kiểm nghiệm");
            setTimeout(() => {
              window.location.href = "/warehouse/lo-dang-den.html";
            }, 1500);
            return;
          }

          if (this.batchInfo.transport_status !== "Delivered") {
            Utils.toast.error("Lô hàng chưa được giao");
            setTimeout(() => {
              window.location.href = "/warehouse/lo-dang-den.html";
            }, 1500);
            return;
          }
        } else {
          console.error("[DEBUG] No batch data found in response");
          Utils.toast.error("Không tìm thấy thông tin lô hàng");
          setTimeout(() => {
            window.location.href = "/warehouse/lo-dang-den.html";
          }, 1500);
        }
      } catch (error) {
        console.error("[ERROR] Load batch info error:", error);
        Utils.toast.error("Lỗi khi tải thông tin lô hàng");
      } finally {
        this.loadingBatch = false;
      }
    },

    async submitConfirmation() {
      // Validate checklist
      if (!this.allChecklistPassed) {
        Utils.toast.error("Vui lòng hoàn thành tất cả các mục kiểm tra");
        return;
      }

      // Confirm
      const confirmed = await Utils.confirm(
        "Xác nhận nhận hàng",
        `Bạn xác nhận đã nhận lô hàng <strong>${this.batchInfo.batch_name}</strong> vào kho?`,
        "Xác nhận",
      );

      if (!confirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        // Submit confirmation
        const result = await API.confirmWarehouseReceipt(this.batchId);

        if (result.success) {
          Utils.toast.success("Đã xác nhận nhận hàng vào kho");

          // Show success info
          await Swal.fire({
            title: "Thành công!",
            html: `
              <div class="text-left">
                <p><strong>Lô hàng:</strong> ${this.batchInfo.batch_name}</p>
                <p><strong>Mã lô:</strong> ${this.batchId}</p>
                <p><strong>Trạng thái:</strong> Đã nhập kho</p>
                ${result.data?.confirmedAt ? `<p><strong>Thời gian:</strong> ${Utils.formatDateTime(result.data.confirmedAt)}</p>` : ""}
              </div>
            `,
            icon: "success",
            confirmButtonText: "Về danh sách",
          });

          // Redirect to inventory
          window.location.href = "/warehouse/ton-kho.html";
        } else {
          // Check for specific error messages
          if (result.error && result.error.includes("đã xác nhận")) {
            Utils.toast.warning(result.error);
            setTimeout(() => {
              window.location.href = "/warehouse/ton-kho.html";
            }, 2000);
          } else {
            Utils.toast.error(result.error || "Lỗi khi xác nhận nhận hàng");
          }
        }
      } catch (error) {
        console.error("[ERROR] Submit confirmation error:", error);
        Utils.toast.error("Lỗi khi xác nhận nhận hàng");
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
