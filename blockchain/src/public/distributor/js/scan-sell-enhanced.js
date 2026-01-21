/**
 * ========================================
 * SCAN-SELL-ENHANCED.JS - Quét QR với Camera & Upload
 * ========================================
 */

function scanSellData() {
  return {
    scanMethod: "manual", // manual, camera, upload
    qrCode: "",
    scannedProduct: null,
    loading: false,
    submitting: false,
    recentScans: [],

    // Camera scanner
    html5QrCode: null,
    cameras: [],
    currentCameraIndex: 0,
    isCameraActive: false,

    // Upload
    uploadPreview: null,

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireDistributor();
      if (!isAuthorized) return;

      // Focus vào input
      this.$nextTick(() => {
        const input = document.querySelector('input[x-model="qrCode"]');
        if (input) input.focus();
      });

      // Load recent scans
      this.loadRecentScans();

      // Get available cameras
      await this.getCameras();
    },

    async getCameras() {
      try {
        const devices = await Html5Qrcode.getCameras();
        this.cameras = devices;
        console.log("Available cameras:", devices);
      } catch (error) {
        console.error("Error getting cameras:", error);
      }
    },

    async startCamera() {
      if (this.isCameraActive) return;

      try {
        // Initialize scanner if not exists
        if (!this.html5QrCode) {
          this.html5QrCode = new Html5Qrcode("qr-reader");
        }

        // Get camera ID
        const cameraId = this.cameras[this.currentCameraIndex]?.id || {
          facingMode: "environment",
        };

        // Start scanning
        await this.html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Success callback
            this.onScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Error callback (can be ignored for continuous scanning)
            // console.log("Scan error:", errorMessage);
          },
        );

        this.isCameraActive = true;
        Utils.toast.success("Camera đã sẵn sàng");
      } catch (error) {
        console.error("Error starting camera:", error);
        Utils.toast.error("Không thể khởi động camera: " + error.message);
      }
    },

    async stopCamera() {
      if (!this.html5QrCode || !this.isCameraActive) return;

      try {
        await this.html5QrCode.stop();
        this.isCameraActive = false;
        Utils.toast.info("Đã dừng camera");
      } catch (error) {
        console.error("Error stopping camera:", error);
      }
    },

    async switchCamera() {
      if (this.cameras.length <= 1) return;

      await this.stopCamera();
      this.currentCameraIndex =
        (this.currentCameraIndex + 1) % this.cameras.length;
      await this.startCamera();
    },

    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        Utils.toast.error("Vui lòng chọn file ảnh");
        return;
      }

      try {
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
          this.uploadPreview = e.target.result;
        };
        reader.readAsDataURL(file);

        // Scan QR from file
        if (!this.html5QrCode) {
          this.html5QrCode = new Html5Qrcode("qr-reader");
        }

        const decodedText = await this.html5QrCode.scanFile(file, true);
        this.onScanSuccess(decodedText);
      } catch (error) {
        console.error("Error scanning file:", error);
        Utils.toast.error("Không tìm thấy mã QR trong ảnh");
      }
    },

    async onScanSuccess(decodedText) {
      console.log("QR Code detected:", decodedText);

      // Stop camera if active
      if (this.isCameraActive) {
        await this.stopCamera();
      }

      // Set QR code and scan
      this.qrCode = decodedText;
      await this.scanProduct();
    },

    async scanProduct() {
      if (!this.qrCode.trim()) {
        Utils.toast.error("Vui lòng nhập mã QR sản phẩm");
        return;
      }

      this.loading = true;

      try {
        const result = await API.getProductFullInfo(this.qrCode.trim());
        console.log("Scan result:", result);

        if (result.success && result.data && result.data.product) {
          this.scannedProduct = result.data.product;

          if (!this.scannedProduct.is_active) {
            Utils.toast.error("Sản phẩm này đã được bán");
            this.resetScan();
            return;
          }

          Utils.toast.success("Đã tìm thấy sản phẩm");

          // Switch to manual tab to show product
          this.scanMethod = "manual";
        } else {
          Utils.toast.error(result.error || "Không tìm thấy sản phẩm");
          this.qrCode = "";
        }
      } catch (error) {
        console.error("Scan product error:", error);
        Utils.toast.error("Lỗi khi tìm sản phẩm");
        this.qrCode = "";
      } finally {
        this.loading = false;
      }
    },

    async confirmSale() {
      if (!this.scannedProduct) return;

      const confirmed = await Utils.confirm(
        "Xác nhận bán hàng",
        `Bạn xác nhận bán sản phẩm <strong>${this.scannedProduct.product_qr_code}</strong>?`,
        "Xác nhận bán",
      );

      if (!confirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        const payload = {
          productQRCode: this.scannedProduct.product_qr_code,
          notes: "Bán qua scan QR",
        };

        console.log("Marking product sold:", payload);

        const result = await API.markProductSold(payload);

        console.log("Mark sold result:", result);

        if (result.success) {
          Utils.toast.success("Đã đánh dấu sản phẩm đã bán");

          this.addToRecentScans(this.scannedProduct.product_qr_code);

          await Swal.fire({
            title: "Bán hàng thành công!",
            html: `
              <div class="text-left">
                <p><strong>Sản phẩm:</strong> ${this.scannedProduct.product_qr_code}</p>
                <p><strong>Lô hàng:</strong> ${this.scannedProduct.batch_name}</p>
                <p><strong>Thời gian:</strong> ${Utils.formatDateTime(new Date().toISOString())}</p>
              </div>
            `,
            icon: "success",
            confirmButtonText: "Bán tiếp",
            showCancelButton: true,
            cancelButtonText: "Xem lịch sử",
          }).then((result) => {
            if (result.isDismissed) {
              window.location.href = "/distributor/lich-su-ban.html";
            }
          });

          this.resetScan();

          this.$nextTick(() => {
            const input = document.querySelector('input[x-model="qrCode"]');
            if (input) input.focus();
          });
        } else {
          Utils.toast.error(result.error || "Lỗi khi đánh dấu sản phẩm");
        }
      } catch (error) {
        console.error("Confirm sale error:", error);
        Utils.toast.error("Lỗi khi xử lý bán hàng");
      } finally {
        this.submitting = false;
        Utils.loading.hide();
      }
    },

    resetScan() {
      this.qrCode = "";
      this.scannedProduct = null;
      this.uploadPreview = null;

      // Clear file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";
    },

    addToRecentScans(qrCode) {
      const scan = {
        qrCode: qrCode,
        timestamp: Utils.formatDateTime(new Date().toISOString()),
      };

      this.recentScans.unshift(scan);

      if (this.recentScans.length > 5) {
        this.recentScans = this.recentScans.slice(0, 5);
      }

      this.saveRecentScans();
    },

    loadRecentScans() {
      try {
        const saved = sessionStorage.getItem("recentScans");
        if (saved) {
          this.recentScans = JSON.parse(saved);
        }
      } catch (error) {
        console.error("Load recent scans error:", error);
      }
    },

    saveRecentScans() {
      try {
        sessionStorage.setItem("recentScans", JSON.stringify(this.recentScans));
      } catch (error) {
        console.error("Save recent scans error:", error);
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

// Cleanup camera when page unloads
window.addEventListener("beforeunload", () => {
  const scanner = window.html5QrCode;
  if (scanner && scanner.isScanning) {
    scanner.stop();
  }
});
