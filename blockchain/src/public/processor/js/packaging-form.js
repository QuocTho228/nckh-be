/**
 * ========================================
 * PACKAGING-FORM.JS - Logic Đóng Gói Sản Phẩm
 * ========================================
 */

function packagingWithScanner() {
  return {
    loading: true,
    error: null,
    batchId: null,
    batchData: null,
    submitting: false,

    scanMode: "camera",
    html5QrCode: null,
    isScannerRunning: false,
    scannerInitialized: false,
    lastScannedQR: "",
    scannedQRs: new Set(),

    currentProduct: {
      governmentQR: "",
      treeId: "",
      weight: "",
      packageType: "",
    },

    products: [],
    targetQuantity: 2,
    sourceTrees: [],

    // ✅ MỚI: Tracking khối lượng đóng gói
    outputWeight: 0, // Khối lượng đầu ra sau sơ chế
    alreadyPackagedWeight: 0, // Khối lượng đã đóng gói trong các phiên trước
    sessionCount: 0, // Số phiên đóng gói đã thực hiện

    get totalWeight() {
      return this.products.reduce(
        (sum, p) => sum + (parseFloat(p.weight) || 0),
        0,
      );
    },

    // ✅ MỚI: Khối lượng còn lại chưa đóng gói
    get remainingWeight() {
      return Math.max(
        0,
        this.outputWeight - this.alreadyPackagedWeight - this.totalWeight,
      );
    },

    // ✅ MỚI: Phần trăm đã đóng gói
    get packedPercent() {
      if (this.outputWeight <= 0) return 0;
      return Math.min(
        100,
        ((this.alreadyPackagedWeight + this.totalWeight) / this.outputWeight) *
          100,
      ).toFixed(1);
    },

    async init() {
      console.log("init() called");

      const isAuthorized = await Auth.requireProcessor();
      if (!isAuthorized) return;

      const urlParams = new URLSearchParams(window.location.search);
      this.batchId = urlParams.get("id");

      if (!this.batchId) {
        this.error = "Không tìm thấy ID lô hàng";
        this.loading = false;
        return;
      }

      await this.loadBatchData();
      Auth.updateNavbar();

      // Start scanner only once after everything is loaded
      if (
        !this.error &&
        this.batchData &&
        this.scanMode === "camera" &&
        !this.scannerInitialized
      ) {
        console.log("Preparing to start scanner...");
        this.scannerInitialized = true;
        await this.$nextTick();
        await this.$nextTick();
        this.startScanner();
      }
    },

    async loadBatchData() {
      try {
        const result = await API.getBatchProcessingDetails(this.batchId);

        if (!result.success) {
          throw new Error(result.error || "Lỗi khi tải thông tin lô hàng");
        }

        this.batchData = result.data.data;

        if (!this.batchData.batch) {
          throw new Error("Không tìm thấy lô hàng");
        }

        if (this.batchData.batch.current_stage !== "Processed") {
          throw new Error("Lô hàng chưa được sơ chế");
        }

        // ✅ MỚI: Lấy khối lượng đầu ra từ bản ghi sơ chế
        if (this.batchData.processingRecord) {
          this.outputWeight =
            parseFloat(this.batchData.processingRecord.output_weight) || 0;
        } else if (this.batchData.batch.output_weight) {
          this.outputWeight =
            parseFloat(this.batchData.batch.output_weight) || 0;
        }

        // ✅ MỚI: Lấy khối lượng đã đóng gói từ các phiên trước
        await this.loadAlreadyPackaged();

        // Get source trees
        const treesResult = await API.getBatchTrees(this.batchId);
        if (treesResult.success) {
          this.sourceTrees = treesResult.data.data || [];
        }

        if (this.sourceTrees.length === 0) {
          throw new Error("Không tìm thấy cây nguồn gốc cho lô này");
        }

        console.log(
          "Source trees loaded:",
          this.sourceTrees.map((t) => ({
            tree_id: t.tree_id,
            type: typeof t.tree_id,
            qr: t.tree_qr_code,
          })),
        );

        console.log("Batch data loaded:", this.batchData);
        console.log(
          `Output: ${this.outputWeight}kg | Đã đóng gói: ${this.alreadyPackagedWeight}kg | Còn lại: ${this.remainingWeight}kg`,
        );
      } catch (error) {
        console.error("Load batch data error:", error);
        this.error = error.message || "Lỗi khi tải thông tin lô hàng";
      } finally {
        this.loading = false;
      }
    },

    // ✅ MỚI: Tải khối lượng đã đóng gói từ các phiên trước
    async loadAlreadyPackaged() {
      try {
        const result = await API.get(
          `/api/processor/products/by-batch/${this.batchId}`,
        );
        if (result.success) {
          const products = result.data.data || [];
          this.alreadyPackagedWeight = products.reduce(
            (sum, p) => sum + (parseFloat(p.weight) || 0) / 1000,
            0,
          );
          this.sessionCount = products.length > 0 ? 1 : 0; // Đã có ít nhất 1 phiên nếu có sản phẩm
          console.log(
            `Đã đóng gói từ trước: ${this.alreadyPackagedWeight.toFixed(2)}kg (${products.length} sản phẩm)`,
          );
        }
      } catch (err) {
        console.warn("Không tải được dữ liệu đã đóng gói:", err);
        this.alreadyPackagedWeight = 0;
      }
    },

    async switchToCamera() {
      this.scanMode = "camera";
      await this.$nextTick();
      this.startScanner();
    },

    async switchToUpload() {
      this.scanMode = "upload";
      this.stopScanner();
    },

    async startScanner() {
      console.log(
        "startScanner() called, isScannerRunning:",
        this.isScannerRunning,
      );

      if (this.isScannerRunning) {
        console.log("Scanner already running, skipping...");
        return;
      }

      this.stopScanner();
      await this.$nextTick();

      try {
        const readerElement = document.getElementById("qr-reader");
        if (!readerElement) {
          console.error("qr-reader element not found");
          return;
        }

        this.html5QrCode = new Html5Qrcode("qr-reader");

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        };

        await this.html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            this.onScanSuccess(decodedText);
          },
          (errorMessage) => {},
        );

        this.isScannerRunning = true;
        console.log("Scanner started");
      } catch (err) {
        console.error("Scanner error:", err);
        this.isScannerRunning = false;
        Utils.toast.warning(
          "Không thể mở camera. Vui lòng sử dụng chế độ Upload ảnh.",
        );
      }
    },

    stopScanner() {
      if (this.html5QrCode && this.isScannerRunning) {
        this.html5QrCode
          .stop()
          .then(() => {
            this.isScannerRunning = false;
            console.log("Scanner stopped");
          })
          .catch((err) => {
            console.error("Stop error:", err);
            this.isScannerRunning = false;
          });
      }
    },

    async onScanSuccess(decodedText) {
      console.log("Scanned QR:", decodedText);

      // Validate format
      const qrPattern = /^[A-Z]{2,10}\d{4}-\d{8}$/;
      if (!qrPattern.test(decodedText)) {
        Utils.toast.error(
          "Mã QR không hợp lệ! Định dạng đúng: SRCA2024-00000001",
        );
        return;
      }

      // Check if already scanned
      if (this.scannedQRs.has(decodedText)) {
        Utils.toast.error("Mã QR này đã được quét rồi!");
        return;
      }

      // Validate with backend
      try {
        const result = await API.post("/api/government-stamps/validate", {
          qrCode: decodedText,
        });

        if (!result.success) {
          Utils.toast.error(result.error || "Lỗi khi kiểm tra tem");
          return;
        }

        let validationData;
        if (result.data && result.data.data) {
          validationData = result.data.data;
        } else if (result.data) {
          validationData = result.data;
        } else {
          Utils.toast.error("Lỗi: Không nhận được dữ liệu từ server");
          return;
        }

        if (validationData.isValid !== true) {
          const errorMsg = validationData.message || "Tem QR không hợp lệ";
          Utils.toast.error(errorMsg);
          return;
        }

        this.lastScannedQR = decodedText;
        this.currentProduct.governmentQR = decodedText;

        // Play success sound
        const audio = new Audio(
          "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuByvLTgjMGHm7A7+OZRQ0PVKrj771mIQU2jdf",
        );
        audio.play().catch(() => {});

        Utils.toast.success("Tem QR hợp lệ!");
      } catch (error) {
        console.error("Validate error:", error);
        Utils.toast.error("Lỗi khi kiểm tra tem: " + error.message);
      }
    },

    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        const decodedText = await html5QrCode.scanFile(file, true);
        this.onScanSuccess(decodedText);
      } catch (err) {
        Utils.toast.error(
          "Không đọc được mã QR từ ảnh. Vui lòng thử ảnh khác.",
        );
        console.error("Scan file error:", err);
      }

      event.target.value = "";
    },

    addProductWithQR() {
      // Validate
      if (!this.currentProduct.governmentQR) {
        Utils.toast.error("Vui lòng quét mã QR");
        return;
      }
      if (!this.currentProduct.treeId) {
        Utils.toast.error("Vui lòng chọn cây nguồn gốc");
        return;
      }
      if (
        !this.currentProduct.weight ||
        parseFloat(this.currentProduct.weight) <= 0
      ) {
        Utils.toast.error("Vui lòng nhập khối lượng hợp lệ");
        return;
      }
      if (!this.currentProduct.packageType) {
        Utils.toast.error("Vui lòng chọn loại bao bì");
        return;
      }

      // ✅ MỚI: Cảnh báo nếu vượt quá khối lượng còn lại
      const newWeight = parseFloat(this.currentProduct.weight);
      if (
        this.outputWeight > 0 &&
        this.alreadyPackagedWeight + this.totalWeight + newWeight >
          this.outputWeight + 0.01
      ) {
        Utils.toast.warning(
          `Tổng khối lượng sẽ vượt quá đầu ra sơ chế (${this.outputWeight} kg). Kiểm tra lại.`,
        );
      }

      // Add to list
      const treeIdInt = parseInt(this.currentProduct.treeId, 10);
      if (isNaN(treeIdInt) || treeIdInt <= 0) {
        Utils.toast.error("Cây nguồn gốc không hợp lệ, vui lòng chọn lại");
        return;
      }

      // Verify treeId actually belongs to this batch
      const treeExists = this.sourceTrees.some(
        (t) => parseInt(t.tree_id, 10) === treeIdInt,
      );
      if (!treeExists) {
        Utils.toast.error(
          "Cây được chọn không thuộc lô hàng này! Vui lòng chọn lại.",
        );
        return;
      }

      this.products.push({
        governmentQR: this.currentProduct.governmentQR,
        treeId: treeIdInt,
        weight: this.currentProduct.weight,
        packageType: this.currentProduct.packageType,
      });

      // Mark as scanned
      this.scannedQRs.add(this.currentProduct.governmentQR);

      // Reset form
      this.currentProduct = {
        governmentQR: "",
        treeId: "",
        weight: "",
        packageType: "",
      };
      this.lastScannedQR = "";

      // Success feedback
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuByvLTgjMGHm7A7+OZRQ0PVKrj771mIQU2jdf",
      );
      audio.play().catch(() => {});

      Utils.toast.success(`Đã thêm sản phẩm ${this.products.length}`);
    },

    removeProduct(index) {
      const product = this.products[index];
      this.scannedQRs.delete(product.governmentQR);
      this.products.splice(index, 1);
      Utils.toast.info("Đã xóa sản phẩm");
    },

    getTreeName(treeId) {
      const tree = this.sourceTrees.find(
        (t) => parseInt(t.tree_id, 10) === parseInt(treeId, 10),
      );
      return tree ? tree.tree_qr_code : "N/A";
    },

    async submitPackaging() {
      if (this.products.length === 0) {
        Utils.toast.error("Vui lòng thêm ít nhất 1 sản phẩm");
        return;
      }

      // ✅ MỚI: Tính khối lượng còn lại sau phiên này
      const afterThisSession = this.alreadyPackagedWeight + this.totalWeight;
      const stillRemaining = Math.max(0, this.outputWeight - afterThisSession);

      const confirmed = await Swal.fire({
        title: "Xác nhận đóng gói",
        html: `
          <div class="text-left space-y-3">
            <p class="font-semibold">Lô hàng: ${this.batchData.batch.batch_name}</p>
            <div class="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Số lượng sản phẩm:</span>
                <span class="font-semibold">${this.products.length}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Khối lượng phiên này:</span>
                <span class="font-semibold">${this.totalWeight.toFixed(2)} kg</span>
              </div>
              ${
                this.outputWeight > 0
                  ? `
              <div class="border-t pt-2 mt-2">
                <div class="flex justify-between">
                  <span class="text-gray-600">Tổng đầu ra sơ chế:</span>
                  <span class="font-semibold">${this.outputWeight.toFixed(2)} kg</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Đã đóng gói trước:</span>
                  <span class="font-semibold">${this.alreadyPackagedWeight.toFixed(2)} kg</span>
                </div>
                <div class="flex justify-between font-bold ${stillRemaining > 0.01 ? "text-orange-600" : "text-green-600"}">
                  <span>Còn lại sau phiên này:</span>
                  <span>${stillRemaining.toFixed(2)} kg</span>
                </div>
              </div>
              `
                  : ""
              }
            </div>
            ${
              stillRemaining > 0.01
                ? `
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <i class="fas fa-info-circle mr-1"></i>
              Còn <strong>${stillRemaining.toFixed(2)} kg</strong> chưa được đóng gói. 
              Bạn có thể quay lại đóng gói tiếp sau.
            </div>
            `
                : `
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              <i class="fas fa-check-circle mr-1"></i>
              Toàn bộ khối lượng sẽ được đóng gói hoàn tất.
            </div>
            `
            }
            <p class="text-sm text-gray-500 mt-3">
              <i class="fas fa-info-circle mr-1"></i>
              Mỗi sản phẩm sẽ được tạo mã QR riêng trên blockchain.
            </p>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Xác nhận đóng gói",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#028040",
        width: 600,
      });

      if (!confirmed.isConfirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        const result = await API.post("/api/processor/create-products", {
          batchId: parseInt(this.batchId, 10),
          products: this.products.map((p) => ({
            ...p,
            treeId: parseInt(p.treeId, 10), // Đảm bảo luôn là số nguyên
          })),
        });

        console.log(
          "Sending products:",
          JSON.stringify(
            this.products.map((p) => ({
              ...p,
              treeId: parseInt(p.treeId, 10),
            })),
          ),
        );
        console.log(
          "Source trees available:",
          this.sourceTrees.map((t) => t.tree_id),
        );

        Utils.loading.hide();

        if (result.success) {
          const responseData = result.data?.data || result.data || {};
          const products = responseData.products || [];

          // ✅ MỚI: Tính lại khối lượng còn lại sau khi submit thành công
          const newAlreadyPacked = afterThisSession;
          const newRemaining = Math.max(
            0,
            this.outputWeight - newAlreadyPacked,
          );

          const successResult = await Swal.fire({
            icon: "success",
            title: "Đóng gói thành công!",
            html: `
              <div class="text-left space-y-3">
                <p>Đã tạo <strong>${responseData.productCount || products.length || 0}</strong> sản phẩm đơn lẻ.</p>
                ${
                  products.length > 0
                    ? `
                  <div class="bg-gray-50 p-4 rounded-lg max-h-48 overflow-y-auto">
                    <p class="text-sm font-semibold mb-2">Danh sách sản phẩm:</p>
                    ${products
                      .map(
                        (p, i) => `
                      <div class="text-sm py-2 border-b">
                        <div class="font-semibold">Sản phẩm ${i + 1}</div>
                        <div class="text-gray-600 text-xs">QR: ${p.qrCode || p.product_qr_code || "N/A"}</div>
                        <div class="text-gray-600 text-xs">Khối lượng: ${p.weight || "N/A"} kg</div>
                      </div>
                    `,
                      )
                      .join("")}
                  </div>
                `
                    : ""
                }

                ${
                  newRemaining > 0.01
                    ? `
                <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-3">
                  <p class="font-semibold text-orange-800 mb-1">
                    <i class="fas fa-exclamation-triangle mr-1"></i>
                    Còn ${newRemaining.toFixed(2)} kg chưa đóng gói
                  </p>
                  <p class="text-sm text-orange-700">Bạn muốn tiếp tục đóng gói ngay bây giờ?</p>
                </div>
                `
                    : `
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                  <p class="font-semibold text-green-800">
                    <i class="fas fa-check-circle mr-1"></i> Đã đóng gói hoàn tất toàn bộ lô!
                  </p>
                </div>
                `
                }

                <p class="text-xs text-gray-500 mt-2">Transaction Hash:</p>
                <p class="text-xs font-mono bg-gray-100 p-2 rounded break-all">
                  ${responseData.transactionHash || "N/A"}
                </p>
              </div>
            `,
            confirmButtonColor: "#028040",
            // ✅ MỚI: Nút "Đóng gói tiếp" nếu còn khối lượng
            confirmButtonText:
              newRemaining > 0.01 ? "Đóng gói tiếp" : "Hoàn tất",
            showDenyButton: newRemaining > 0.01,
            denyButtonText: "Xem sản phẩm",
            denyButtonColor: "#6b7280",
            showCancelButton: false,
            width: 700,
          });

          if (newRemaining > 0.01 && successResult.isConfirmed) {
            // ✅ Tiếp tục đóng gói: reload lại trang (cập nhật alreadyPackagedWeight)
            window.location.reload();
          } else {
            // Chuyển sang danh sách sản phẩm
            window.location.href = "/processor/danh-sach-san-pham.html";
          }
        } else {
          Utils.toast.error(result.error || "Lỗi khi đóng gói sản phẩm");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Submit error:", error);
        Utils.toast.error("Lỗi khi đóng gói sản phẩm: " + error.message);
      } finally {
        this.submitting = false;
      }
    },
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
