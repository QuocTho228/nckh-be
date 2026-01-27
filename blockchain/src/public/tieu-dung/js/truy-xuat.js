// ==========================================
// TRUY-XUAT.JS - Logic quét QR tem chính phủ
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
  // Setup upload area
  const uploadZone = document.getElementById("uploadZone");
  const qrImageInput = document.getElementById("qrImageInput");

  // Click to upload
  uploadZone.addEventListener("click", () => qrImageInput.click());

  // Drag and drop
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("dragover");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  });

  // File input change
  qrImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageUpload(file);
  });

  // Check if QR in URL
  const urlParams = new URLSearchParams(window.location.search);
  const qrCode = urlParams.get("qr");
  if (qrCode) {
    document.getElementById("qrInput").value = qrCode;
    scanQR();
  }
});

/**
 * Scan QR Code
 */
async function scanQR() {
  const qrInput = document.getElementById("qrInput").value.trim();

  if (!qrInput) {
    alert("Vui lòng nhập mã QR");
    return;
  }

  showLoading();

  try {
    const response = await fetch("/api/public/scan-government-stamp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ qrCode: qrInput }),
    });

    const result = await response.json();

    if (!result.success) {
      showError(result.error || "Không tìm thấy thông tin");
      return;
    }

    displayResult(result.data);
  } catch (error) {
    console.error("Scan error:", error);
    showError("Không thể kết nối đến server");
  }
}

/**
 * Handle image upload
 */
async function handleImageUpload(file) {
  if (!file.type.startsWith("image/")) {
    alert("Vui lòng chọn file ảnh");
    return;
  }

  showLoading();

  try {
    const formData = new FormData();
    formData.append("qrImage", file);

    const response = await fetch("/api/public/scan-government-stamp", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      showError(result.error || "Không đọc được mã QR từ ảnh");
      return;
    }

    // Update input
    document.getElementById("qrInput").value = result.data.stamp.qrCode;

    displayResult(result.data);
  } catch (error) {
    console.error("Upload error:", error);
    showError("Không thể xử lý ảnh");
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

  // Stamp info
  document.getElementById("stampCode").textContent = stamp.qrCode;
  document.getElementById("stampStatus").textContent = getStampStatusText(
    stamp.status,
  );
  document.getElementById("stampStatus").className =
    `stamp-status status-${stamp.status === "USED" ? "valid" : "invalid"}`;
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
  document.getElementById("packagedDate").textContent = formatDateTime(
    product.packagedDate,
  );

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

  // Timeline
  displayTimeline(timeline);

  // Source trees
  displaySourceTrees(sourceTrees);

  // Quality tests
  displayQualityTests(qualityTests);

  // Hide loading, show result
  hideLoading();
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
 * Display timeline with beautiful design
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
            <div class="timeline-item" data-aos="fade-right" data-aos-delay="${index * 100}">
                <div class="timeline-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${item.title}</div>
                    <div class="timeline-time">
                        <i class="far fa-clock mr-2"></i>${formatDateTime(item.timestamp)}
                    </div>
                    <div class="timeline-desc">${item.description}</div>
                    ${item.actor ? `<div class="timeline-actor"><i class="fas fa-user mr-2"></i>${item.actor}</div>` : ""}
                </div>
            </div>
        `;
    })
    .join("");
}

/**
 * Display source trees with beautiful cards
 */
function displaySourceTrees(trees) {
  const container = document.getElementById("treesContainer");

  if (!trees || trees.length === 0) {
    container.innerHTML =
      '<p class="text-muted col-12 text-center">Chưa có thông tin cây nguồn gốc</p>';
    return;
  }

  container.innerHTML = trees
    .map(
      (tree, index) => `
        <div class="col-md-6 mb-4" data-aos="zoom-in" data-aos-delay="${index * 100}">
            <div class="tree-card-modern">
                <div class="tree-icon">
                    <i class="fas fa-tree"></i>
                </div>
                <h6 class="text-center font-weight-bold text-success mb-3">
                    ${tree.treeType} - ${tree.variety}
                </h6>
                <div class="text-center">
                    <span class="info-badge"><i class="fas fa-qrcode mr-1"></i>${tree.treeQRCode}</span>
                    <span class="info-badge"><i class="fas fa-calendar mr-1"></i>${formatDate(tree.plantedDate)}</span>
                    <span class="info-badge"><i class="fas fa-user mr-1"></i>${tree.farmerName}</span>
                    <span class="info-badge"><i class="fas fa-tasks mr-1"></i>${tree.totalActivities} hoạt động</span>
                </div>
                ${tree.coordinates ? `<p class="text-muted small text-center mt-3 mb-0"><i class="fas fa-map-marker-alt mr-2"></i>${tree.coordinates}</p>` : ""}
            </div>
        </div>
    `,
    )
    .join("");
}

/**
 * Display quality tests with modern badges
 */
function displayQualityTests(tests) {
  if (!tests || tests.length === 0) return;

  document.getElementById("qualitySection").style.display = "block";
  const container = document.getElementById("qualityContainer");

  container.innerHTML = tests
    .map(
      (test, index) => `
        <div class="card mb-3 border-0 shadow-sm" data-aos="fade-up" data-aos-delay="${index * 100}">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-9">
                        <h6 class="font-weight-bold text-success mb-3">${test.testType}</h6>
                        <p class="mb-2"><strong>Phương pháp:</strong> ${test.testMethod || "-"}</p>
                        <p class="mb-2"><strong>Ngày kiểm tra:</strong> ${formatDateTime(test.testDate)}</p>
                        <p class="mb-2"><strong>Tiêu chuẩn:</strong> ${test.standard || "-"}</p>
                        <p class="mb-2"><strong>Kết quả:</strong> ${test.result || "-"}</p>
                        ${test.notes ? `<p class="text-muted small mb-0 mt-2"><i class="fas fa-sticky-note mr-2"></i>${test.notes}</p>` : ""}
                        <p class="text-muted small mt-3 mb-0">
                            <i class="fas fa-user-md mr-2"></i>${test.inspectorName} - ${test.inspectorPhone}
                        </p>
                    </div>
                    <div class="col-md-3 text-center">
                        <div class="quality-badge ${test.passed ? "quality-pass" : "quality-fail"}">
                            <div>
                                <i class="fas ${test.passed ? "fa-check-circle" : "fa-times-circle"} fa-2x mb-2"></i>
                                <div>${test.passed ? "ĐẠT" : "KHÔNG ĐẠT"}</div>
                            </div>
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
 * Helper functions
 */
function getStampStatusText(status) {
  const texts = {
    AVAILABLE: "CÒN HIỆU LỰC",
    USED: "ĐÃ SỬ DỤNG",
    EXPIRED: "HẾT HẠN",
    REVOKED: "BỊ THU HỒI",
  };
  return texts[status] || status;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("vi-VN");
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("vi-VN");
}

function showLoading() {
  document.getElementById("loading").style.display = "block";
  document.getElementById("error").style.display = "none";
  document.getElementById("resultContent").style.display = "none";
}

function hideLoading() {
  document.getElementById("loading").style.display = "none";
}

function showError(message) {
  hideLoading();
  document.getElementById("error").style.display = "block";
  document.getElementById("error").querySelector("p").textContent = message;
  document.getElementById("resultContent").style.display = "none";
}
