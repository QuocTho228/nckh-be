// ============================================================
// TRUY-XUAT-CAMERA.JS
// Gộp toàn bộ logic: Camera · Upload · Hiển thị kết quả · Đính chính
//
// FIX so với phiên bản cũ:
//   1. displayResult: hiển thị batch.quantity (tổng lô đã đính chính)
//      vào element #batchQuantity thay vì chỉ product.weight
//   2. Badge "Đã đính chính" dùng batch.isCorrected từ API (đã thêm ở backend)
// ============================================================

// ── State ──────────────────────────────────────────────────
let stream = null;
let videoElement = null;
let uploadedFile = null;
let currentBatchId = null;
let correctionHistory = [];

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  videoElement = document.getElementById("cameraPreview");

  document
    .getElementById("qrImageInput")
    .addEventListener("change", handleFileSelect);

  const urlParams = new URLSearchParams(window.location.search);
  const qrCode = urlParams.get("qr");
  if (qrCode) processQRCode(qrCode);
});

// ============================================================
// CAMERA
// ============================================================

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    videoElement.srcObject = stream;
    document.getElementById("cameraContainer").classList.add("active");
    document.getElementById("cameraOption").classList.add("active");
    document.getElementById("uploadOption").classList.remove("active");
    document.getElementById("uploadPreview").classList.remove("active");
  } catch (error) {
    console.error("Camera error:", error);
    alert("Không thể truy cập camera. Vui lòng dùng tính năng tải ảnh lên.");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  document.getElementById("cameraContainer").classList.remove("active");
  document.getElementById("cameraOption").classList.remove("active");
}

function captureQR() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
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

// ============================================================
// UPLOAD
// ============================================================

function triggerUpload() {
  document.getElementById("qrImageInput").click();
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Vui lòng chọn file ảnh");
    return;
  }

  uploadedFile = file;

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

async function processUploadedImage() {
  if (!uploadedFile) return;

  showLoading();

  try {
    const formData = new FormData();
    formData.append("qrImage", uploadedFile);

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

    if (result.data && result.data.stamp) {
      await displayResult(result.data);
    } else {
      showError("Không tìm thấy thông tin tem");
    }
  } catch (error) {
    hideLoading();
    console.error("Upload error:", error);
    showError("Không thể xử lý ảnh");
  }
}

function cancelUpload() {
  document.getElementById("uploadPreview").classList.remove("active");
  document.getElementById("uploadOption").classList.remove("active");
  document.getElementById("qrImageInput").value = "";
  uploadedFile = null;
}

// ============================================================
// QR CODE PROCESSING
// ============================================================

async function processQRCode(qrText) {
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCode }),
    });

    const result = await response.json();
    hideLoading();

    if (!result.success) {
      showError(result.error || "Không tìm thấy thông tin");
      return;
    }

    await displayResult(result.data);
  } catch (error) {
    hideLoading();
    console.error("Process QR error:", error);
    showError("Không thể kết nối đến server");
  }
}

// ============================================================
// DISPLAY RESULT
// ============================================================

async function displayResult(data) {
  const {
    stamp,
    product,
    batch,
    producer,
    sourceTrees,
    timeline,
    qualityTests,
  } = data;

  stopCamera();
  cancelUpload();

  currentBatchId = batch?.batchId || null;

  // ── Stamp ────────────────────────────────────────────────
  document.getElementById("stampCode").textContent = stamp.qrCode;
  document.getElementById("issuedDate").textContent = formatDate(
    stamp.issuedDate,
  );
  document.getElementById("issuedBy").textContent =
    stamp.issuedBy || "Bộ Công An";

  // ── Product ──────────────────────────────────────────────
  document.getElementById("productImage").src =
    product.productImage || "../hinhanh/default-product.jpg";
  document.getElementById("productName").textContent = product.productName;
  document.getElementById("productQR").textContent = product.productQRCode;
  document.getElementById("sscc").textContent = batch.sscc;

  // Khối lượng gói (gram/gói — từ product, không bao giờ thay đổi)
  document.getElementById("weight").textContent = product.weight
    ? `${product.weight}g`
    : "-";

  // FIX: Hiển thị tổng lô (batch.quantity — có thể đã được đính chính)
  // Element #batchQuantity cần có trong HTML truy-xuat.html (xem hướng dẫn bên dưới)
  const batchQtyEl = document.getElementById("batchQuantity");
  if (batchQtyEl) {
    batchQtyEl.textContent = batch.quantity || "-";
  }

  // Hiển thị batchName + badge đính chính
  // FIX: Dùng batch.isCorrected từ API (backend đã trả đúng trường này)
  const isCorrected = batch.isCorrected === true || batch.isCorrected === 1;
  const batchNameEl = document.getElementById("batchName");
  if (batchNameEl) {
    batchNameEl.innerHTML =
      escHtml(batch.batchName) +
      (isCorrected
        ? ` <span id="correctionBadge" onclick="openCorrectionModal()"
               style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;
                      background:#fef3c7;border:1px solid #d97706;color:#92400e;
                      font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;
                      vertical-align:middle;margin-left:6px;">
               ✏️ Đã đính chính
             </span>`
        : "");
  }

  // ── Producer ─────────────────────────────────────────────
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

  // ── Trees · Quality · Timeline ───────────────────────────
  displaySourceTrees(sourceTrees);
  displayQualityTests(qualityTests);
  displayTimeline(timeline);

  // Hiện kết quả
  document.getElementById("error").style.display = "none";
  document.getElementById("resultContent").style.display = "block";
  document
    .getElementById("resultContent")
    .scrollIntoView({ behavior: "smooth" });

  // Load lịch sử đính chính song song (không block UI)
  if (currentBatchId) {
    loadCorrectionHistory(currentBatchId, isCorrected);
  }
}

// ============================================================
// CORRECTION HISTORY
// ============================================================

async function loadCorrectionHistory(batchId, alreadyMarked) {
  try {
    const resp = await fetch(`/api/correction/history/${batchId}`);
    if (!resp.ok) return;

    const data = await resp.json();
    if (!data.success || data.data.length === 0) return;

    correctionHistory = data.data;

    // Nếu badge chưa hiển thị (batch.isCorrected=false nhưng có history) → thêm badge
    if (!alreadyMarked) {
      const batchNameEl = document.getElementById("batchName");
      if (batchNameEl && !document.getElementById("correctionBadge")) {
        batchNameEl.innerHTML += ` <span id="correctionBadge" onclick="openCorrectionModal()"
          style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;
                 background:#fef3c7;border:1px solid #d97706;color:#92400e;
                 font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;
                 vertical-align:middle;margin-left:6px;">
          ✏️ Đã đính chính
        </span>`;
      }
    }
  } catch (err) {
    console.error("Load correction history error:", err);
  }
}

function openCorrectionModal() {
  if (correctionHistory.length === 0 && currentBatchId) {
    loadCorrectionHistory(currentBatchId, true).then(() => {
      if (correctionHistory.length > 0) _renderCorrectionModal();
    });
    return;
  }
  _renderCorrectionModal();
}

function _renderCorrectionModal() {
  const FIELD_LABELS = {
    batch_name: "Tên lô hàng",
    quantity: "Số lượng",
    farm_plot_number: "Số mảnh vườn",
  };

  const historyHtml = correctionHistory
    .map((item, idx) => {
      const fields = item.changed_fields || [];
      const orig = item.original_data || {};
      const corr = item.corrected_data || {};

      const rows = fields
        .map(
          (f) => `
      <tr style="border-top:1px solid #f3f4f6;font-size:12px;">
        <td style="padding:6px 12px;color:#6b7280;">${FIELD_LABELS[f] || f}</td>
        <td style="padding:6px 12px;"><s style="color:#ef4444;">${escHtml(String(orig[f] ?? ""))}</s></td>
        <td style="padding:6px 12px;color:#16a34a;font-weight:600;">${escHtml(String(corr[f] ?? ""))}</td>
      </tr>
    `,
        )
        .join("");

      const txHash = item.blockchain_tx_hash;

      return `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:12px;">
        <div style="padding:12px 16px;background:white;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:start;">
          <div>
            <p style="font-size:12px;font-weight:600;color:#374151;margin:0;">Lần đính chính #${correctionHistory.length - idx}</p>
            <p style="font-size:11px;color:#9ca3af;margin:2px 0 0;">
              ${formatDateTime(item.reviewed_at)}
              ${item.reviewed_by_name ? " · Duyệt: " + escHtml(item.reviewed_by_name) : ""}
            </p>
          </div>
          <span style="font-size:11px;background:#dcfce7;color:#166534;font-weight:600;padding:3px 10px;border-radius:20px;">Đã duyệt</span>
        </div>
        <div style="padding:12px 16px;">
          <p style="font-size:12px;color:#6b7280;margin:0 0 8px;">
            <b style="color:#374151;">Lý do:</b> ${escHtml(item.reason || "")}
          </p>
          <table style="width:100%;">
            <thead>
              <tr style="font-size:11px;color:#9ca3af;">
                <th style="padding:4px 12px;text-align:left;font-weight:500;">Trường</th>
                <th style="padding:4px 12px;text-align:left;font-weight:500;">Giá trị cũ</th>
                <th style="padding:4px 12px;text-align:left;font-weight:500;">Giá trị mới</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${
            txHash
              ? `<p style="font-size:11px;color:#6b7280;margin:8px 0 0;">
                 🔗 <b>Blockchain TX:</b>
                 <span style="font-family:monospace;word-break:break-all;color:#1d4ed8;">${escHtml(txHash)}</span>
               </p>`
              : `<p style="font-size:11px;color:#9ca3af;margin:8px 0 0;">⏳ Chưa ghi lên blockchain</p>`
          }
        </div>
      </div>
    `;
    })
    .join("");

  let modal = document.getElementById("correctionModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "correctionModal";
    modal.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;" +
      "padding:16px;background:rgba(0,0,0,0.5);";
    modal.innerHTML = `
      <div style="background:white;border-radius:20px;width:100%;max-width:540px;
                  max-height:85vh;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,0.2);">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:16px 20px;border-bottom:1px solid #f3f4f6;">
          <h5 style="margin:0;font-weight:700;color:#1f2937;font-size:16px;">
            🕓 Lịch sử đính chính lô hàng
          </h5>
          <button onclick="closeCorrectionModal()"
            style="background:none;border:none;font-size:18px;color:#9ca3af;cursor:pointer;
                   width:32px;height:32px;border-radius:50%;display:flex;align-items:center;
                   justify-content:center;">×</button>
        </div>
        <div id="correctionModalBody" style="overflow-y:auto;padding:16px 20px;flex:1;"></div>
      </div>
    `;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeCorrectionModal();
    });
    document.body.appendChild(modal);
  }

  document.getElementById("correctionModalBody").innerHTML = `
    <p style="font-size:12px;color:#6b7280;margin:0 0 12px;">
      Dữ liệu gốc vẫn bất biến trên blockchain. Các thay đổi đã được Admin phê duyệt.
    </p>
    ${historyHtml}
  `;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeCorrectionModal() {
  const modal = document.getElementById("correctionModal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

// ============================================================
// SOURCE TREES
// ============================================================

function displaySourceTrees(trees) {
  const container = document.getElementById("treesContainer");
  if (!container) return;

  if (!trees || trees.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-4 text-muted">
        <i class="fas fa-tree fa-2x mb-2"></i>
        <p class="mb-0">Chưa có thông tin cây nguồn gốc</p>
      </div>`;
    return;
  }

  container.innerHTML = trees
    .map(
      (tree, index) => `
    <div class="col-12 mb-2" data-aos="fade-up" data-aos-delay="${index * 50}">
      <a href="./../tieu-dung/cay-nguon-goc.html?qr=${encodeURIComponent(tree.treeQRCode)}"
         style="text-decoration:none;">
        <div style="
          display:flex; align-items:center; gap:12px;
          background:#f8fdf8; border:1px solid #d1fae5;
          border-radius:12px; padding:12px 14px;
          transition:background .2s;">
          <div style="flex:1;min-width:0;">
            <p style="margin:0 0 3px;font-weight:600;font-size:18px;color:#1a1a1a;">
              ${escHtml(tree.treeType)} — ${escHtml(tree.variety)}
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:15px;color:#6b7280;">
              <span><i class="fas fa-qrcode mr-1"></i>${escHtml(tree.treeQRCode)}</span>
              <span><i class="fas fa-calendar mr-1"></i>${formatDate(tree.plantedDate)}</span>
              <span><i class="fas fa-user mr-1"></i>${escHtml(tree.farmerName)}</span>
              <span><i class="fas fa-tasks mr-1"></i>${tree.totalActivities || 0} hoạt động</span>
              ${tree.coordinates ? `<span><i class="fas fa-map-marker-alt mr-1"></i>${escHtml(tree.coordinates)}</span>` : ""}
            </div>
          </div>
          <i class="fas fa-chevron-right" style="color:#9ca3af;font-size:12px;flex-shrink:0;"></i>
        </div>
      </a>
    </div>
  `,
    )
    .join("");
}

// ============================================================
// QUALITY TESTS
// ============================================================

function displayQualityTests(tests) {
  if (!tests || tests.length === 0) return;

  const section = document.getElementById("qualitySection");
  if (section) section.style.display = "block";

  const container = document.getElementById("qualityContainer");
  if (!container) return;

  container.innerHTML = tests
    .map(
      (test, index) => `
    <div style="
      display:flex; align-items:center; gap:12px;
      background:#f9fafb; border:1px solid #e5e7eb;
      border-radius:12px; padding:12px 14px; margin-bottom:8px;"
      data-aos="fade-up" data-aos-delay="${index * 50}">

      <div style="flex:1;min-width:0;">
        <p style="margin:0 0 4px;font-weight:600;font-size:18px;color:#028040;">
          ${escHtml(test.testType)}
        </p>
        <div style="font-size:15px;color:#374151;display:flex;flex-direction:column;gap:2px;">
          <span><strong>Phương pháp:</strong> ${escHtml(test.testMethod || "—")}</span>
          <span><strong>Ngày:</strong> ${formatDateTime(test.testDate)}</span>
          <span><strong>Kết quả:</strong> ${escHtml(test.result || "—")}</span>
          ${test.standard ? `<span><strong>Tiêu chuẩn:</strong> ${escHtml(test.standard)}</span>` : ""}
          ${test.inspectorName ? `<span><strong>Kiểm định viên:</strong> ${escHtml(test.inspectorName)}</span>` : ""}
        </div>
      </div>

      <div style="
        flex-shrink:0; width:70px; height:70px; border-radius:10px;
        background:${test.passed ? "#dcfce7" : "#fee2e2"};
        border:1.5px solid ${test.passed ? "#86efac" : "#fca5a5"};
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
        <i class="fas ${test.passed ? "fa-check-circle" : "fa-times-circle"}"
           style="font-size:30px;color:${test.passed ? "#16a34a" : "#dc2626"};"></i>
        <span style="font-size:15px;font-weight:900;color:${test.passed ? "#15803d" : "#b91c1c"};">
          ${test.passed ? "ĐẠT" : "KHÔNG ĐẠT"}
        </span>
      </div>

    </div>
  `,
    )
    .join("");
}

// ============================================================
// CORRECTION HISTORY
// ============================================================

const batchId = data.batch?.batchId;
if (batchId) {
  loadCorrectionHistory(batchId, data.batch);
}

async function loadCorrectionHistory(batchId, batchData) {
  // Hiển thị badge "Đã đính chính" nếu lô có is_corrected
  if (batchData?.isCorrected) {
    const batchNameEl = document.getElementById("batchName");
    if (batchNameEl) {
      batchNameEl.innerHTML += ` <span class="badge badge-warning" title="${batchData.correctionCount} lần đính chính">
            <i class="fas fa-edit mr-1"></i>Đã đính chính
          </span>`;
    }
  }

  try {
    const resp = await fetch(`/api/correction/history/${batchId}`);
    const result = await resp.json();

    if (!result.success || !result.data?.length) return;

    const section = document.getElementById("correctionSection");
    const container = document.getElementById("correctionContainer");
    document.getElementById("correctionCount").textContent = result.data.length;
    section.style.display = "block";

    container.innerHTML = result.data
      .map(
        (h) => `
      <div class="border rounded p-3 mb-3" style="background:#fffbf0;">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <strong>Đính chính ngày ${new Date(h.reviewed_at).toLocaleDateString("vi-VN")}</strong>
            <span class="text-muted ml-2" style="font-size:.85rem;">bởi Admin</span>
          </div>
          ${
            h.verifiable
              ? `<span class="badge badge-success" title="Đã xác minh trên blockchain">
                 <i class="fas fa-link mr-1"></i>On-chain
               </span>`
              : `<span class="badge badge-secondary">
                 <i class="fas fa-database mr-1"></i>Off-chain
               </span>`
          }
        </div>

        <p class="mb-2" style="font-size:.9rem;">
          <i class="fas fa-comment-alt text-warning mr-1"></i>
          <em>${h.reason}</em>
        </p>

        <table class="table table-sm table-bordered mb-2" style="font-size:.85rem;">
          <thead class="thead-light">
            <tr><th>Trường</th><th>Giá trị cũ</th><th>Giá trị mới</th></tr>
          </thead>
          <tbody>
            ${(h.changed_fields || [])
              .map(
                (f) => `
              <tr>
                <td>${fieldLabelVN(f)}</td>
                <td><s class="text-danger">${h.original_data?.[f] ?? "—"}</s></td>
                <td><strong class="text-success">${h.corrected_data?.[f] ?? "—"}</strong></td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        ${
          h.blockchain_tx_hash
            ? `<p class="mb-0 text-muted" style="font-size:.78rem;">
               <i class="fas fa-cube mr-1"></i>TX: 
               <code>${h.blockchain_tx_hash}</code>
             </p>`
            : ""
        }
      </div>
    `,
      )
      .join("");
  } catch (e) {
    console.warn("Không tải được lịch sử đính chính:", e);
  }
}

function fieldLabelVN(f) {
  return (
    {
      batch_name: "Tên lô",
      quantity: "Số lượng",
      farm_plot_number: "Số mảnh vườn",
    }[f] || f
  );
}

// ============================================================
// TIMELINE
// ============================================================

function displayTimeline(timeline) {
  const container = document.getElementById("timelineContainer");
  if (!container) return;

  if (!timeline || timeline.length === 0) {
    container.innerHTML =
      '<p class="text-muted text-center">Chưa có dữ liệu hành trình</p>';
    return;
  }

  const stageIcons = {
    Created: "fa-plus-circle",
    Purchased: "fa-shopping-cart",
    Transported: "fa-truck",
    Transported1: "fa-truck",
    Transported2: "fa-truck-fast",
    Transport: "fa-truck",
    Processed: "fa-cogs",
    QualityInspected: "fa-clipboard-check",
    Warehoused: "fa-warehouse",
    Packaged: "fa-box",
  };

  container.innerHTML = timeline
    .map(
      (item, index) => `
    <div class="timeline-item" data-aos="fade-right" data-aos-delay="${index * 50}">
      <div class="timeline-icon">
        <i class="fas ${stageIcons[item.stage] || "fa-circle"}"></i>
      </div>
      <div class="timeline-content">
        <h6 class="text-success font-weight-bold">${escHtml(item.title)}</h6>
        <p class="text-muted small mb-2"><i class="far fa-clock mr-2"></i>${formatDateTime(item.timestamp)}</p>
        <p class="mb-0">${escHtml(item.description || "")}</p>
        ${item.actor ? `<p class="text-muted small mb-0 mt-2"><i class="fas fa-user mr-2"></i>${escHtml(item.actor)}</p>` : ""}
      </div>
    </div>
  `,
    )
    .join("");
}

// ============================================================
// HELPERS
// ============================================================

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
  document.getElementById("error").scrollIntoView({ behavior: "smooth" });
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("vi-VN");
}
function formatDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("vi-VN");
}
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
