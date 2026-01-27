// ==========================================
// TRUY-XUAT-CAMERA.JS - Camera & Upload QR
// ==========================================

let stream = null;
let videoElement = null;
let uploadedFile = null;

document.addEventListener("DOMContentLoaded", function () {
  videoElement = document.getElementById("cameraPreview");

  // Setup file input
  document
    .getElementById("qrImageInput")
    .addEventListener("change", handleFileSelect);

  // Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const qrCode = urlParams.get("qr");
  if (qrCode) {
    processQRCode(qrCode);
  }
});

/**
 * Start Camera
 */
async function startCamera() {
  try {
    // Request camera access
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }, // Use back camera on mobile
    });

    videoElement.srcObject = stream;

    // Show camera container
    document.getElementById("cameraContainer").classList.add("active");
    document.getElementById("cameraOption").classList.add("active");
    document.getElementById("uploadOption").classList.remove("active");
    document.getElementById("uploadPreview").classList.remove("active");
  } catch (error) {
    console.error("Camera error:", error);
    alert(
      "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập hoặc sử dụng tính năng tải ảnh lên.",
    );
  }
}

/**
 * Stop Camera
 */
function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  document.getElementById("cameraContainer").classList.remove("active");
  document.getElementById("cameraOption").classList.remove("active");
}

/**
 * Capture QR from camera
 */
function captureQR() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Get image data
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  // Decode QR using jsQR
  const code = jsQR(imageData.data, imageData.width, imageData.height);

  if (code) {
    stopCamera();
    processQRCode(code.data);
  } else {
    alert(
      "Không tìm thấy mã QR. Vui lòng đưa mã QR vào khung hình và thử lại.",
    );
  }
}

/**
 * Trigger upload
 */
function triggerUpload() {
  document.getElementById("qrImageInput").click();
}

/**
 * Handle file select
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith("image/")) {
    alert("Vui lòng chọn file ảnh");
    return;
  }

  uploadedFile = file;

  // Preview image
  const reader = new FileReader();
  reader.onload = function (event) {
    document.getElementById("uploadedImage").src = event.target.result;
    document.getElementById("uploadPreview").classList.add("active");
    document.getElementById("uploadOption").classList.add("active");
    document.getElementById("cameraOption").classList.remove("active");
    stopCamera();
  };
  reader.readAsDataURL(file);
}

/**
 * Process uploaded image
 */
async function processUploadedImage() {
  if (!uploadedFile) return;

  showLoading();

  try {
    // Create FormData
    const formData = new FormData();
    formData.append("qrImage", uploadedFile);

    // Call API
    const response = await fetch("/api/public/scan-government-stamp", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    hideLoading();

    if (!result.success) {
      showError(result.error || "Không đọc được mã QR từ ảnh");
      return;
    }

    // If API returns QR code, process it
    if (result.data && result.data.stamp) {
      displayResult(result.data);
    } else {
      showError("Không tìm thấy thông tin tem");
    }
  } catch (error) {
    hideLoading();
    console.error("Upload error:", error);
    showError("Không thể xử lý ảnh");
  }
}

/**
 * Cancel upload
 */
function cancelUpload() {
  document.getElementById("uploadPreview").classList.remove("active");
  document.getElementById("uploadOption").classList.remove("active");
  document.getElementById("qrImageInput").value = "";
  uploadedFile = null;
}

/**
 * Process QR code text
 */
async function processQRCode(qrText) {
  // Extract QR code if in URL format
  let qrCode = qrText;
  if (qrText.includes("qr=")) {
    const match = qrText.match(/qr=([^&]+)/);
    if (match) qrCode = match[1];
  } else if (qrText.includes(":")) {
    qrCode = qrText.split(":")[1];
  }

  showLoading();

  try {
    const response = await fetch("/api/public/scan-government-stamp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ qrCode: qrCode }),
    });

    const result = await response.json();

    hideLoading();

    if (!result.success) {
      showError(result.error || "Không tìm thấy thông tin");
      return;
    }

    displayResult(result.data);
  } catch (error) {
    hideLoading();
    console.error("Process QR error:", error);
    showError("Không thể kết nối đến server");
  }
}

/**
 * Display result
 */
function displayResult(data) {
  const {
    stamp,
    product,
    batch,
    producer,
    sourceTrees,
    timeline,
    qualityTests,
  } = data;

  // Hide scanner
  stopCamera();
  cancelUpload();

  // Stamp info
  document.getElementById("stampCode").textContent = stamp.qrCode;
  document.getElementById("issuedDate").textContent = formatDate(
    stamp.issuedDate,
  );
  document.getElementById("issuedBy").textContent =
    stamp.issuedBy || "Bộ Công An";

  // Product info
  document.getElementById("productImage").src =
    product.productImage || "../hinhanh/default-product.jpg";
  document.getElementById("productName").textContent = product.productName;
  document.getElementById("productQR").textContent = product.productQRCode;
  document.getElementById("batchName").textContent = batch.batchName;
  document.getElementById("sscc").textContent = batch.sscc;
  document.getElementById("weight").textContent = product.weight
    ? `${product.weight}g`
    : "-";

  // Producer info
  document.getElementById("producerName").textContent = producer.name || "-";
  document.getElementById("producerEmail").textContent = producer.email || "-";
  document.getElementById("producerPhone").textContent = producer.phone || "-";

  const address = [
    producer.address,
    producer.ward,
    producer.district,
    producer.province,
  ]
    .filter(Boolean)
    .join(", ");
  document.getElementById("producerAddress").textContent = address || "-";

  // Source trees
  displaySourceTrees(sourceTrees);

  // Quality tests
  displayQualityTests(qualityTests);

  // Timeline
  displayTimeline(timeline);

  // Show result
  document.getElementById("error").style.display = "none";
  document.getElementById("resultContent").style.display = "block";

  // Scroll to result
  setTimeout(() => {
    document.getElementById("resultContent").scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 300);
}

/**
 * Display source trees - ✅ Click vào card để xem chi tiết
 */
function displaySourceTrees(trees) {
  const container = document.getElementById("treesContainer");

  if (!trees || trees.length === 0) {
    container.innerHTML =
      '<div class="col-12"><div class="empty-state text-center py-5"><i class="fas fa-tree fa-3x text-muted mb-3"></i><p class="text-muted">Chưa có thông tin cây nguồn gốc</p></div></div>';
    return;
  }

  container.innerHTML = trees
    .map(
      (tree, index) => `
        <div class="col-12 mb-3" data-aos="fade-up" data-aos-delay="${index * 50}">
            <a href="./../tieu-dung/cay-nguon-goc.html?qr=${encodeURIComponent(tree.treeQRCode)}" 
               class="tree-card-link">
                <div class="tree-card-horizontal">
                    <div class="tree-icon-section">
                        <div class="tree-icon-circle">
                            <i class="fas fa-tree fa-2x text-white"></i>
                        </div>
                    </div>
                    <div class="tree-info-section">
                        <h6 class="tree-title">${tree.treeType} - ${tree.variety}</h6>
                        <div class="tree-details">
                            <span class="tree-badge"><i class="fas fa-qrcode"></i> ${tree.treeQRCode}</span>
                            <span class="tree-badge"><i class="fas fa-calendar"></i> ${formatDate(tree.plantedDate)}</span>
                            <span class="tree-badge"><i class="fas fa-user"></i> ${tree.farmerName}</span>
                            <span class="tree-badge"><i class="fas fa-tasks"></i> ${tree.totalActivities} hoạt động</span>
                        </div>
                        ${tree.coordinates ? `<p class="tree-location"><i class="fas fa-map-marker-alt"></i> ${tree.coordinates}</p>` : ""}
                    </div>
                    <div class="tree-arrow-section">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            </a>
        </div>
    `,
    )
    .join("");

  // Add CSS for tree cards
  if (!document.getElementById("treeCardStyles")) {
    const style = document.createElement("style");
    style.id = "treeCardStyles";
    style.textContent = `
      .tree-card-link {
        text-decoration: none;
        color: inherit;
        display: block;
      }
      
      .tree-card-horizontal {
        display: flex;
        align-items: center;
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 1.25rem;
        transition: all 0.3s ease;
        gap: 1.25rem;
      }
      
      .tree-card-horizontal:hover {
        transform: translateX(5px);
        border-color: var(--primary-green);
        box-shadow: 0 8px 20px rgba(2, 128, 64, 0.15);
      }
      
      .tree-icon-section {
        flex-shrink: 0;
      }
      
      .tree-icon-circle {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary-green), var(--light-green));
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(2, 128, 64, 0.25);
      }
      
      .tree-info-section {
        flex-grow: 1;
      }
      
      .tree-title {
        color: var(--primary-green);
        font-weight: bold;
        margin-bottom: 0.75rem;
        font-size: 1.05rem;
      }
      
      .tree-details {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      
      .tree-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: #f5f5f5;
        padding: 0.35rem 0.75rem;
        border-radius: 20px;
        font-size: 0.85rem;
        color: #555;
      }
      
      .tree-badge i {
        color: var(--primary-green);
        font-size: 0.75rem;
      }
      
      .tree-location {
        margin-top: 0.5rem;
        margin-bottom: 0;
        font-size: 0.85rem;
        color: #888;
      }
      
      .tree-location i {
        color: var(--primary-green);
      }
      
      .tree-arrow-section {
        flex-shrink: 0;
        color: var(--primary-green);
        font-size: 1.25rem;
        opacity: 0.6;
        transition: all 0.3s ease;
      }
      
      .tree-card-horizontal:hover .tree-arrow-section {
        opacity: 1;
        transform: translateX(5px);
      }
      
      .empty-state i {
        opacity: 0.3;
      }
      
      @media (max-width: 768px) {
        .tree-card-horizontal {
          flex-direction: column;
          text-align: center;
        }
        
        .tree-details {
          justify-content: center;
        }
        
        .tree-arrow-section {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Display quality tests
 */
function displayQualityTests(tests) {
  if (!tests || tests.length === 0) return;

  document.getElementById("qualitySection").style.display = "block";
  const container = document.getElementById("qualityContainer");

  container.innerHTML = tests
    .map(
      (test, index) => `
        <div class="card mb-3" data-aos="fade-up" data-aos-delay="${index * 50}">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-9">
                        <h6 class="text-success">${test.testType}</h6>
                        <p class="mb-1"><strong>Phương pháp:</strong> ${test.testMethod || "-"}</p>
                        <p class="mb-1"><strong>Ngày:</strong> ${formatDateTime(test.testDate)}</p>
                        <p class="mb-1"><strong>Kết quả:</strong> ${test.result || "-"}</p>
                    </div>
                    <div class="col-md-3 text-center">
                        <div class="badge ${test.passed ? "badge-success" : "badge-danger"} p-3">
                            <i class="fas ${test.passed ? "fa-check-circle" : "fa-times-circle"} fa-2x"></i>
                            <div class="mt-2">${test.passed ? "ĐẠT" : "KHÔNG ĐẠT"}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

/**
 * Display timeline
 */
function displayTimeline(timeline) {
  const container = document.getElementById("timelineContainer");

  if (!timeline || timeline.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">Chưa có dữ liệu hành trình</p>';
    return;
  }

  const stageIcons = {
    Created: "fa-plus-circle",
    Purchased: "fa-shopping-cart",
    Transported: "fa-truck",
    Transport: "fa-truck",
    Processed: "fa-cogs",
    QualityInspected: "fa-clipboard-check",
    Warehoused: "fa-warehouse",
    Packaged: "fa-box",
  };

  container.innerHTML = timeline
    .map((item, index) => {
      const icon = stageIcons[item.stage] || "fa-circle";

      return `
            <div class="timeline-item" data-aos="fade-right" data-aos-delay="${index * 50}">
                <div class="timeline-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="timeline-content">
                    <h6 class="text-success font-weight-bold">${item.title}</h6>
                    <p class="text-muted small mb-2">
                        <i class="far fa-clock mr-2"></i>${formatDateTime(item.timestamp)}
                    </p>
                    <p class="mb-0">${item.description}</p>
                    ${item.actor ? `<p class="text-muted small mb-0 mt-2"><i class="fas fa-user mr-2"></i>${item.actor}</p>` : ""}
                </div>
            </div>
        `;
    })
    .join("");
}

/**
 * Helper functions
 */
function showLoading() {
  document.getElementById("loadingOverlay").classList.add("active");
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.remove("active");
}

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
  document.getElementById("error").style.display = "block";
  document.getElementById("resultContent").style.display = "none";

  // Scroll to error
  document.getElementById("error").scrollIntoView({ behavior: "smooth" });
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("vi-VN");
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("vi-VN");
}
