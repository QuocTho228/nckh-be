/**
 * ========================================
 * QR-SCANNER.JS - QR Code Scanner Component
 * Quét mã QR hàng loạt để chọn cây
 * ========================================
 */

window.QRScanner = {
  // State
  isScanning: false,
  stream: null,
  scannerModal: null,
  onTreeScanned: null,
  scannedCodes: new Set(),

  /**
   * Initialize QR Scanner
   */
  async init() {
    console.log("QR Scanner initialized");
  },

  /**
   * Open scanner modal
   */
  async openScanner(options = {}) {
    const { onTreeScanned, onClose } = options;
    this.onTreeScanned = onTreeScanned;
    this.scannedCodes.clear();

    // Create modal
    this.scannerModal = document.createElement("div");
    this.scannerModal.className =
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4";
    this.scannerModal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            <i class="fas fa-qrcode text-green-600"></i>
            Quét mã QR
          </h2>
          <button 
            id="closeScannerBtn" 
            type="button"
            class="text-gray-400 hover:text-gray-600 transition"
          >
            <i class="fas fa-times text-2xl"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <!-- Camera View -->
          <div class="relative bg-black rounded-lg overflow-hidden" style="aspect-ratio: 4/3;">
            <video 
              id="qrVideo" 
              class="w-full h-full object-cover"
              autoplay 
              playsinline
            ></video>
            
            <!-- Scanning overlay -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="w-64 h-64 border-4 border-green-500 rounded-lg shadow-lg">
                <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
                <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
                <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
                <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
              </div>
            </div>

            <!-- Status indicator -->
            <div id="scanStatus" class="absolute top-4 left-4 right-4 text-center">
              <div class="bg-white bg-opacity-90 rounded-lg px-4 py-2 inline-block">
                <p class="text-sm font-semibold text-gray-700">
                  <i class="fas fa-camera mr-2"></i>
                  Đưa mã QR vào khung hình
                </p>
              </div>
            </div>
          </div>

          <!-- Scanned trees list -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900">
                <i class="fas fa-check-circle text-green-600 mr-2"></i>
                Đã quét: <span id="scannedCount" class="text-green-600">0</span> cây
              </h3>
              <button 
                id="clearScannedBtn"
                type="button" 
                class="text-sm text-red-600 hover:text-red-700"
              >
                <i class="fas fa-trash mr-1"></i>
                Xóa tất cả
              </button>
            </div>
            
            <div id="scannedList" class="space-y-2 max-h-48 overflow-y-auto">
              <p class="text-gray-500 text-sm text-center py-4">
                Chưa quét cây nào
              </p>
            </div>
          </div>

          <!-- Camera selection -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-video mr-2"></i>
              Chọn camera
            </label>
            <select id="cameraSelect" class="input-gradient">
              <option value="">Đang tải camera...</option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-4 border-t border-gray-200">
            <button 
              id="cancelScanBtn"
              type="button" 
              class="btn-secondary flex-1"
            >
              <i class="fas fa-times mr-2"></i>
              Hủy
            </button>
            <button 
              id="doneScanBtn"
              type="button" 
              class="btn-primary flex-1"
              disabled
            >
              <i class="fas fa-check mr-2"></i>
              Hoàn thành
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.scannerModal);

    // Setup event listeners
    document
      .getElementById("closeScannerBtn")
      .addEventListener("click", () => this.closeScanner(onClose));
    document
      .getElementById("cancelScanBtn")
      .addEventListener("click", () => this.closeScanner(onClose));
    document
      .getElementById("doneScanBtn")
      .addEventListener("click", () => this.finishScanning(onClose));
    document
      .getElementById("clearScannedBtn")
      .addEventListener("click", () => this.clearScanned());
    document
      .getElementById("cameraSelect")
      .addEventListener("change", (e) => this.switchCamera(e.target.value));

    // Start camera
    await this.startCamera();
  },

  /**
   * Start camera and QR scanning
   */
  async startCamera() {
    try {
      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );

      // Populate camera select
      const cameraSelect = document.getElementById("cameraSelect");
      cameraSelect.innerHTML = videoDevices
        .map(
          (device, index) => `
        <option value="${device.deviceId}">
          ${device.label || `Camera ${index + 1}`}
        </option>
      `,
        )
        .join("");

      // Start with back camera if available (mobile)
      const backCamera = videoDevices.find((device) =>
        device.label.toLowerCase().includes("back"),
      );
      const selectedDeviceId = backCamera
        ? backCamera.deviceId
        : videoDevices[0]?.deviceId;

      if (selectedDeviceId) {
        cameraSelect.value = selectedDeviceId;
        await this.switchCamera(selectedDeviceId);
      }
    } catch (error) {
      console.error("Error starting camera:", error);
      Utils.toast.error("Không thể truy cập camera");
    }
  },

  /**
   * Switch camera
   */
  async switchCamera(deviceId) {
    // Stop current stream
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    try {
      // Request camera with specific device
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      const video = document.getElementById("qrVideo");
      video.srcObject = this.stream;

      // Start QR detection
      this.isScanning = true;
      this.detectQRCode(video);
    } catch (error) {
      console.error("Error switching camera:", error);
      Utils.toast.error("Không thể truy cập camera");
    }
  },

  /**
   * Detect QR code from video stream
   */
  async detectQRCode(video) {
    if (!this.isScanning) return;

    try {
      // Use jsQR library for QR detection
      if (window.jsQR && video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          await this.handleQRCode(code.data);
        }
      }
    } catch (error) {
      console.error("QR detection error:", error);
    }

    // Continue scanning
    if (this.isScanning) {
      requestAnimationFrame(() => this.detectQRCode(video));
    }
  },

  /**
   * Handle scanned QR code
   */
  async handleQRCode(qrCode) {
    // Avoid duplicate scans
    if (this.scannedCodes.has(qrCode)) {
      return;
    }

    // Validate QR code format - support multiple formats:
    // Format 1: TREE-XXXXXXXX-XXXXXX (new format)
    // Format 2: PRODUCTNAME-N-YYYYMMDD (legacy format like DURIAN-4-20260119)
    const isValidFormat =
      qrCode.match(/^TREE-\d{8}-[A-Z0-9]{6}$/) || // New format
      qrCode.match(/^[A-Z]+-\d+-\d{8}$/); // Legacy format

    if (!isValidFormat) {
      this.showScanStatus("Mã QR không hợp lệ", "error");
      return;
    }

    try {
      // Verify tree exists and belongs to current user
      const result = await API.get(`/api/farmer/verify-tree-qr/${qrCode}`);

      if (!result.data.success) {
        this.showScanStatus(result.data.error || "Cây không tồn tại", "error");
        return;
      }

      const tree = result.data.data;

      // Check if tree is active
      if (!tree.is_active) {
        this.showScanStatus("Cây đã thu hoạch, không thể chăm sóc", "error");
        return;
      }

      // Add to scanned list
      this.scannedCodes.add(qrCode);
      this.addScannedTree(tree);
      this.showScanStatus(`Đã quét: ${tree.tree_type}`, "success");

      // Callback
      if (this.onTreeScanned) {
        this.onTreeScanned(tree);
      }

      // Vibrate on success (mobile)
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    } catch (error) {
      console.error("Error verifying QR code:", error);
      this.showScanStatus("Lỗi khi kiểm tra mã QR", "error");
    }
  },

  /**
   * Add scanned tree to list
   */
  addScannedTree(tree) {
    const list = document.getElementById("scannedList");
    const count = document.getElementById("scannedCount");
    const doneBtn = document.getElementById("doneScanBtn");

    // Clear empty message
    if (this.scannedCodes.size === 1) {
      list.innerHTML = "";
    }

    // Add tree item
    const item = document.createElement("div");
    item.className =
      "flex items-center justify-between bg-white rounded-lg p-3 border border-green-200";
    item.dataset.treeId = tree.tree_id;
    item.innerHTML = `
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <i class="fas fa-tree text-green-600"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm truncate">${tree.tree_qr_code}</p>
          <p class="text-xs text-gray-600 truncate">${tree.tree_type} - ${tree.variety}</p>
        </div>
      </div>
      <button 
        type="button"
        class="text-red-500 hover:text-red-700 ml-2"
        onclick="QRScanner.removeScannedTree('${tree.tree_qr_code}')"
      >
        <i class="fas fa-times"></i>
      </button>
    `;

    list.appendChild(item);

    // Update count
    count.textContent = this.scannedCodes.size;

    // Enable done button
    doneBtn.disabled = false;
  },

  /**
   * Remove scanned tree
   */
  removeScannedTree(qrCode) {
    this.scannedCodes.delete(qrCode);

    const list = document.getElementById("scannedList");
    const count = document.getElementById("scannedCount");
    const doneBtn = document.getElementById("doneScanBtn");

    // Remove from list
    const items = list.querySelectorAll("[data-tree-id]");
    items.forEach((item) => {
      const itemQR = item.querySelector("p.font-semibold").textContent;
      if (itemQR === qrCode) {
        item.remove();
      }
    });

    // Update count
    count.textContent = this.scannedCodes.size;

    // Show empty message if no trees
    if (this.scannedCodes.size === 0) {
      list.innerHTML = `
        <p class="text-gray-500 text-sm text-center py-4">
          Chưa quét cây nào
        </p>
      `;
      doneBtn.disabled = true;
    }
  },

  /**
   * Clear all scanned trees
   */
  clearScanned() {
    if (this.scannedCodes.size === 0) return;

    Swal.fire({
      title: "Xóa tất cả?",
      text: `Bạn có chắc muốn xóa ${this.scannedCodes.size} cây đã quét?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    }).then((result) => {
      if (result.isConfirmed) {
        this.scannedCodes.clear();

        const list = document.getElementById("scannedList");
        const count = document.getElementById("scannedCount");
        const doneBtn = document.getElementById("doneScanBtn");

        list.innerHTML = `
          <p class="text-gray-500 text-sm text-center py-4">
            Chưa quét cây nào
          </p>
        `;
        count.textContent = "0";
        doneBtn.disabled = true;
      }
    });
  },

  /**
   * Show scan status
   */
  showScanStatus(message, type = "info") {
    const status = document.getElementById("scanStatus");
    const colors = {
      success: "bg-green-500 text-white",
      error: "bg-red-500 text-white",
      info: "bg-white text-gray-700",
    };

    status.innerHTML = `
      <div class="${colors[type]} bg-opacity-90 rounded-lg px-4 py-2 inline-block">
        <p class="text-sm font-semibold">
          ${type === "success" ? '<i class="fas fa-check-circle mr-2"></i>' : ""}
          ${type === "error" ? '<i class="fas fa-exclamation-circle mr-2"></i>' : ""}
          ${message}
        </p>
      </div>
    `;

    // Auto hide after 2 seconds
    setTimeout(() => {
      if (status) {
        status.innerHTML = `
          <div class="bg-white bg-opacity-90 rounded-lg px-4 py-2 inline-block">
            <p class="text-sm font-semibold text-gray-700">
              <i class="fas fa-camera mr-2"></i>
              Đưa mã QR vào khung hình
            </p>
          </div>
        `;
      }
    }, 2000);
  },

  /**
   * Finish scanning
   */
  finishScanning(onClose) {
    this.closeScanner();
    if (onClose) {
      onClose(Array.from(this.scannedCodes));
    }
  },

  /**
   * Close scanner
   */
  closeScanner(onClose) {
    this.isScanning = false;

    // Stop camera
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Remove modal
    if (this.scannerModal) {
      this.scannerModal.remove();
      this.scannerModal = null;
    }

    // Call onClose without scanned codes (cancelled)
    if (onClose) {
      onClose(null);
    }
  },
};

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  QRScanner.init();
});
