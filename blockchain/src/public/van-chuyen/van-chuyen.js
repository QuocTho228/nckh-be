// Khai báo các hàm ở phạm vi toàn cục
let batchInfo;
let html5QrCode = null;
let startCameraButton;
let qrInput;
let fileSelected;
let scanButton;
let qrReader;

// Hàm định nghĩa hành động vận chuyển
function translateAction(action) {
  const actions = {
    0: "Bắt đầu vận chuyển",
    1: "Tạm dừng vận chuyển",
    2: "Tiếp tục vận chuyển",
    3: "Hoàn thành vận chuyển"
  };
  return actions[action] || action;
}

function translateParticipantType(type) {
  const types = {
    0: "Người vận chuyển",
    1: "Kho"
  };
  return types[type] || type;
}

async function displayTransportHistory(sscc) {
  try {
    const response = await fetch(`/api/batch-transport-history/${sscc}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const history = await response.json();

    console.log("Transport History:", history);

    if (!Array.isArray(history)) {
      throw new Error("Lịch sử vận chuyển không phải là một mảng");
    }

    let historyHTML = `
      <h3>Lịch sử vận chuyển</h3>
      <div class="timeline">
    `;

    history.forEach((event, index) => {
      // Xử lý địa chỉ để loại bỏ phần trùng lặp
      const addressParts = event.transporterAddress.split(", ");
      const uniqueAddressParts = [...new Set(addressParts)];
      const formattedAddress = uniqueAddressParts.join(", ");

      // Thêm class để tạo hiệu ứng xen kẽ (trái/phải)
      const positionClass =
        index % 2 === 0 ? "timeline-left" : "timeline-right";

      historyHTML += `
        <div class="timeline-item ${positionClass}">
          <div class="timeline-content">
            <div class="timeline-dot"></div>
            <div class="timeline-details">
              <h4>${translateAction(event.action)}</h4>
              <p><strong>Thời gian:</strong> ${new Date(
                event.timestamp
              ).toLocaleString("vi-VN", {
                hour12: false,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              })}</p>
              <p><strong>Loại người tham gia:</strong> ${translateParticipantType(
                event.participantType
              )}</p>
              <p><strong>Người vận chuyển:</strong> ${
                event.transporterName || "Không có thông tin"
              }</p>
              <p><strong>Số điện thoại:</strong> ${
                event.transporterPhone || "Không có thông tin"
              }</p>
              <p><strong>Địa chỉ:</strong> ${
                formattedAddress || "Không có thông tin"
              }</p>
            </div>
          </div>
        </div>
      `;
    });

    historyHTML += `
      </div>
    `;

    const transportHistoryElement = document.getElementById("transportHistory");
    if (transportHistoryElement) {
      transportHistoryElement.innerHTML = historyHTML;
    } else {
      console.error('Element with id "transportHistory" not found');
    }
  } catch (error) {
    console.error("Error displaying transport history:", error);
    alert("Không thể lấy lịch sử vận chuyển. Vui lòng thử lại.");
  }
}

function displayBatchInfo(info) {
  console.log("Displaying batch info:", info);
  const batchInfoDiv = document.getElementById("batchInfo");
  const batchDetailsDiv = document.getElementById("batchDetails");
  const transportActionsDiv = document.getElementById("transportActions");

  let tableHTML = '<table class="batch-info-table">';

  const addRow = (label, value, className = "") => {
    tableHTML += `
            <tr>
                <th>${label}</th>
                <td class="${className}">${value}</td>
            </tr>
        `;
  };

  addRow(
    "Trạng thái",
    `<span class="status-approved"><i class="fas fa-check-circle"></i> ${info.status}</span>`
  );
  addRow("Mã Lô hàng", info.batchId);
  addRow("Tên lô hàng", info.name);
  addRow("Số lượng (tấn)", info.quantity);
  addRow(
    "Ngày tạo lô hàng",
    new Date(info.productionDate).toLocaleDateString()
  );
  addRow("Trạng thái vận chuyển", info.transportStatus);
  addRow("Người sản xuất", info.producer.name);
  addRow("Địa chỉ", info.producer.address);
  addRow("Số điện thoại", info.producer.phone);

  if (info.productImageUrls && Object.keys(info.productImageUrls).length > 0) {
    const imageCount = Object.keys(info.productImageUrls).length;
    addRow(
      "Hình ảnh sản phẩm",
      `<button class="btn btn-primary" onclick="openImageGallery('product')">Xem ${imageCount} ảnh sản phẩm</button>`
    );
  }

  if (info.certificateImageUrl) {
    addRow(
      "Giấy chứng nhận",
      `<button class="btn btn-primary" onclick="openImageModal('${info.certificateImageUrl}')">Xem giấy chứng nhận</button>`
    );
  }

  tableHTML += "</table>";
  batchDetailsDiv.innerHTML = tableHTML;

  // Thêm các nút hành động với icon vào transportActionsDiv
  let transportButtonsHTML = "";
  if (
    info.detailedTransportStatus === "Chưa bắt đầu" ||
    info.detailedTransportStatus === "Tạm dừng"
  ) {
    transportButtonsHTML = `
      <button onclick="updateTransportStatus('${info.sscc}', 'Bat dau van chuyen')" class="btn btn-success">
        <i class="fas fa-play-circle"></i>
        <span class="button-text">Bắt đầu vận chuyển</span>
        <div class="loading-spinner"></div>
      </button>`;
  } else if (info.detailedTransportStatus === "Đang vận chuyển") {
    transportButtonsHTML = `
      <button onclick="updateTransportStatus('${info.sscc}', 'Tam dung van chuyen')" class="btn btn-warning">
        <i class="fas fa-pause-circle"></i>
        <span class="button-text">Tạm dừng vận chuyển</span>
        <div class="loading-spinner"></div>
      </button>
      <button onclick="updateTransportStatus('${info.sscc}', 'Hoan thanh van chuyen')" class="btn btn-success">
        <i class="fas fa-check-circle"></i>
        <span class="button-text">Hoàn thành vận chuyển</span>
        <div class="loading-spinner"></div>
      </button>`;
  } else if (info.detailedTransportStatus === "Đã giao") {
    transportButtonsHTML = `
      <button onclick="updateTransportStatus('${info.sscc}', 'Bat dau van chuyen')" class="btn btn-success">
        <i class="fas fa-redo-alt"></i> Bắt đầu vận chuyển mới
      </button>`;
  }

  transportActionsDiv.innerHTML = transportButtonsHTML;
  batchInfoDiv.style.display = "block";
  transportActionsDiv.style.display = transportButtonsHTML ? "flex" : "none";

  displayTransportHistory(info.sscc);
}

async function fetchBatchInfoBySSCC(sscc) {
  try {
    const response = await fetch(`/api/batch-info-by-sscc/${sscc}`);
    if (!response.ok) {
      throw new Error("Không thể lấy thông tin lô hàng");
    }
    batchInfo = await response.json();
    displayBatchInfo(batchInfo);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin lô hàng:", error);
    alert("Có lỗi xảy ra khi lấy thông tin lô hàng. Vui lòng thử lại.");
  }
}

function showCompletionModal() {
  const modal = document.getElementById("completionModal");
  modal.style.display = "block";
}

// Thêm hàm để đóng modal và làm mới trang
function closeCompletionModalAndRefresh() {
  const modal = document.getElementById("completionModal");
  modal.style.display = "none";
  location.reload(); // Làm mới trang
}

async function updateTransportStatus(sscc, action) {
  console.log("Updating transport status:", { sscc, action });

  // Tìm và thêm loading state cho nút được click
  const clickedButton = event.target.closest("button");
  clickedButton.classList.add("btn-loading");

  try {
    const response = await fetch("/api/accept-transport", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sscc, action })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Không thể cập nhật trạng thái vận chuyển");
    }

    showActionMessage(data.message, "success");
    await fetchBatchInfoBySSCC(sscc);
  } catch (error) {
    console.error("Error:", error);
    showActionMessage(
      "Có lỗi xảy ra khi cập nhật trạng thái vận chuyển: " + error.message,
      "error"
    );
  } finally {
    // Xóa loading state
    clickedButton.classList.remove("btn-loading");
  }
}

// Cập nhật hàm showTransportCompletionMessage
function showTransportCompletionMessage() {
  const successMessage = document.createElement("div");
  successMessage.className = "alert alert-success mt-3";
  successMessage.innerHTML = `
        <h4 class="alert-heading">Vận chuyển thành công!</h4>
        <p>Bạn đã hoàn thành vận chuyển lô hàng này.</p>
        <hr>
        <p class="mb-0">Trang sẽ tự động tải lại sau 5 giây.</p>
    `;

  // Ẩn thông tin lô hàng và các nút hành động nếu có
  const batchInfoDiv = document.getElementById("batchInfo");
  const transportActionsDiv = document.getElementById("transportActions");
  if (batchInfoDiv) batchInfoDiv.style.display = "none";
  if (transportActionsDiv) transportActionsDiv.style.display = "none";

  // Chèn thông báo vào đầu trang
  const container = document.querySelector(".container");
  container.insertBefore(successMessage, container.firstChild);

  // Cuộn trang đến thông báo
  successMessage.scrollIntoView({ behavior: "smooth" });

  // Đợi 2 giây và sau đó tải lại trang
  setTimeout(() => {
    window.location.reload();
  }, 5000);
}

let currentImages = [];
let currentImageIndex = 0;

// Hàm hiển thị modal ảnh
function openImageModal(src) {
  console.log("Opening modal for:", src);
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const modalContent = document.getElementById("modalContent");

  // Reset nội dung
  modalContent.innerHTML = "";
  modalImg.src = src;
  modalImg.style.display = "block";
  modal.style.display = "flex";

  // Thêm nút tải về
  let downloadBtn = modal.querySelector(".download-btn");
  if (!downloadBtn) {
    downloadBtn = document.createElement("button");
    downloadBtn.className = "download-btn";
    downloadBtn.innerHTML = '<i class="fas fa-download"></i> Tải về';
    modalContent.appendChild(downloadBtn); // Thêm vào modalContent
  }
  downloadBtn.style.display = "block"; // Đảm bảo nút hiển thị

  downloadBtn.onclick = function (e) {
    e.stopPropagation();
    const fileName = src.split("/").pop() || `image-${Date.now()}.jpg`;
    const link = document.createElement("a");
    link.href = src;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Đóng modal khi click overlay
  modal
    .querySelector(".modal-overlay")
    .addEventListener("click", closeModal, { once: true });
}

// Hàm hiển thị gallery ảnh
function openImageGallery(type) {
  console.log("Opening gallery for:", type);
  console.log("Batch Info:", batchInfo);
  const modal = document.getElementById("imageModal");
  const modalContent = document.getElementById("modalContent");
  const modalImg = document.getElementById("modalImage");

  // Reset nội dung
  modalContent.innerHTML = "";
  modalImg.style.display = "none";
  currentImages = [];
  currentImageIndex = 0;

  // Lấy danh sách ảnh
  const images =
    type === "product" ? batchInfo.productImageUrls : batchInfo.batchImageUrls;
  if (images && Array.isArray(images) && images.length > 0) {
    currentImages = images;
    let galleryHTML = '<div class="image-gallery">';
    currentImages.forEach((url, index) => {
      galleryHTML += `<img src="${url}" alt="${type} image" class="gallery-image" onclick="expandImage(${index})">`;
    });
    galleryHTML += "</div>";
    modalContent.innerHTML = galleryHTML;

    // Thêm nút điều hướng nếu có nhiều hơn 1 ảnh
    if (currentImages.length > 1) {
      let prevBtn = modal.querySelector(".prev-btn");
      let nextBtn = modal.querySelector(".next-btn");
      if (!prevBtn) {
        prevBtn = document.createElement("button");
        prevBtn.className = "prev-btn";
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        modal.appendChild(prevBtn);
      }
      if (!nextBtn) {
        nextBtn = document.createElement("button");
        nextBtn.className = "next-btn";
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        modal.appendChild(nextBtn);
      }
      prevBtn.style.display = "block";
      nextBtn.style.display = "block";
      prevBtn.onclick = () => {
        currentImageIndex =
          (currentImageIndex - 1 + currentImages.length) % currentImages.length;
        expandImage(currentImageIndex);
      };
      nextBtn.onclick = () => {
        currentImageIndex = (currentImageIndex + 1) % currentImages.length;
        expandImage(currentImageIndex);
      };
    }

    // Hiển thị ảnh đầu tiên
    if (currentImages.length > 0) {
      expandImage(0); // Gọi expandImage để hiển thị ảnh và nút tải về
    }
  } else if (
    images &&
    typeof images === "object" &&
    Object.keys(images).length > 0
  ) {
    currentImages = Object.values(images);
    let galleryHTML = '<div class="image-gallery">';
    currentImages.forEach((url, index) => {
      galleryHTML += `<img src="${url}" alt="${type} image" class="gallery-image" onclick="expandImage(${index})">`;
    });
    galleryHTML += "</div>";
    modalContent.innerHTML = galleryHTML;

    // Thêm nút điều hướng nếu có nhiều hơn 1 ảnh
    if (currentImages.length > 1) {
      let prevBtn = modal.querySelector(".prev-btn");
      let nextBtn = modal.querySelector(".next-btn");
      if (!prevBtn) {
        prevBtn = document.createElement("button");
        prevBtn.className = "prev-btn";
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        modal.appendChild(prevBtn);
      }
      if (!nextBtn) {
        nextBtn = document.createElement("button");
        nextBtn.className = "next-btn";
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        modal.appendChild(nextBtn);
      }
      prevBtn.style.display = "block";
      nextBtn.style.display = "block";
      prevBtn.onclick = () => {
        currentImageIndex =
          (currentImageIndex - 1 + currentImages.length) % currentImages.length;
        expandImage(currentImageIndex);
      };
      nextBtn.onclick = () => {
        currentImageIndex = (currentImageIndex + 1) % currentImages.length;
        expandImage(currentImageIndex);
      };
    }

    // Hiển thị ảnh đầu tiên
    if (currentImages.length > 0) {
      expandImage(0); // Gọi expandImage để hiển thị ảnh và nút tải về
    }
  } else {
    modalContent.innerHTML = "<p>Không có hình ảnh để hiển thị.</p>";
  }

  modal.style.display = "flex"; // Sử dụng flex để căn giữa

  // Đóng modal khi click overlay
  modal
    .querySelector(".modal-overlay")
    .addEventListener("click", closeModal, { once: true });
}

// Hàm mở rộng ảnh trong gallery
function expandImage(index) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const modalContent = document.getElementById("modalContent");

  currentImageIndex = index;
  modalImg.src = currentImages[index];
  modalImg.style.display = "block";

  // Ẩn gallery
  const gallery = modalContent.querySelector(".image-gallery");
  if (gallery) {
    gallery.style.display = "none";
  }

  // Tạo hoặc tìm nút tải về
  let downloadBtn = modalContent.querySelector(".download-btn");
  if (!downloadBtn) {
    downloadBtn = document.createElement("button");
    downloadBtn.className = "download-btn";
    downloadBtn.innerHTML = '<i class="fas fa-download"></i> Tải về';
    modalContent.appendChild(downloadBtn); // Thêm vào modalContent
  }
  downloadBtn.style.display = "block"; // Hiển thị nút

  // Cập nhật sự kiện tải về
  downloadBtn.onclick = function (e) {
    e.stopPropagation();
    const src = currentImages[index];
    const fileName = src.split("/").pop() || `image-${Date.now()}.jpg`;
    const link = document.createElement("a");
    link.href = src;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

// Hàm đóng modal
function closeModal() {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const modalContent = document.getElementById("modalContent");
  modal.style.display = "none";
  modalImg.src = "";
  modalImg.style.display = "none";
  modalContent.innerHTML = ""; // Xóa toàn bộ nội dung, bao gồm download-btn
  const prevBtn = modal.querySelector(".prev-btn");
  const nextBtn = modal.querySelector(".next-btn");
  if (prevBtn) prevBtn.style.display = "none";
  if (nextBtn) nextBtn.style.display = "none";
}

// Event listener cho DOMContentLoaded
document.addEventListener("DOMContentLoaded", async function () {
  startCameraButton = document.getElementById("start-camera");
  qrInput = document.getElementById("qr-input");
  fileSelected = document.getElementById("file-selected");
  scanButton = document.getElementById("scan-button");
  qrReader = document.getElementById("qr-reader");

  if (startCameraButton) {
    startCameraButton.addEventListener("click", async function () {
      // Nếu đang quét, dừng quét
      if (html5QrCode && html5QrCode.isScanning) {
        stopScanner();
        return;
      }

      // Nếu chưa quét, bắt đầu quét
      try {
        // Yêu cầu quyền camera khi nhấn nút này
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        // Dừng stream ngay sau khi được cấp quyền
        stream.getTracks().forEach((track) => track.stop());

        // Bắt đầu quét sau khi được cấp quyền
        startScanner();
      } catch (err) {
        console.error("Camera permission error:", err);
        alert("Vui lòng cấp quyền camera trong cài đặt trình duyệt của bạn.");
      }
    });
  }

  if (qrInput) {
    qrInput.addEventListener("change", handleFileInput);
  }
  if (scanButton) {
    scanButton.addEventListener("click", scanQR);
  }

  async function startScanner() {
    try {
      // Khởi tạo scanner trước
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
      }
      qrReader.style.display = "block";

      // Thử camera sau trước
      await html5QrCode.start(
        { facingMode: { exact: "environment" } },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          console.log("QR Code detected:", decodedText);
          stopScanner();
          handleQRCode(decodedText);
        },
        (errorMessage) => {
          console.log("QR Error:", errorMessage);
        }
      );

      // Đổi text của nút thành "Dừng quét"
      startCameraButton.innerHTML =
        '<i class="fas fa-stop-circle"></i> Dừng quét';
      scanButton.disabled = true;
    } catch (err) {
      console.error("Back camera error:", err);

      // Thử camera trước nếu camera sau không được
      try {
        await html5QrCode.start(
          { facingMode: "user" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            console.log("QR Code detected:", decodedText);
            stopScanner();
            handleQRCode(decodedText);
          }
        );

        // Đổi text của nút thành "Dừng quét"
        startCameraButton.innerHTML =
          '<i class="fas fa-stop-circle"></i> Dừng quét';
        scanButton.disabled = true;
      } catch (frontErr) {
        console.error("Front camera error:", frontErr);
        alert("Không thể truy cập camera. Vui lòng kiểm tra quyền và thử lại.");
        await stopScanner();
      }
    }
  }

  async function stopScanner() {
    try {
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          await html5QrCode.stop();
          console.log("Scanner stopped");
        }
        await html5QrCode.clear();
        html5QrCode = null;
      }
      qrReader.style.display = "none";
      startCameraButton.innerHTML =
        '<i class="fas fa-camera"></i> Quét QR bằng camera';
      scanButton.disabled = false;
    } catch (err) {
      console.error("Stop scanner error:", err);
    }
  }

  function handleFileInput(event) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // Giới hạn 5MB
        alert("File quá lớn. Vui lòng chọn file nhỏ hơn 5MB.");
        return;
      }
      if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
        alert(
          "Định dạng file không hỗ trợ. Vui lòng chọn file JPEG, PNG hoặc GIF."
        );
        return;
      }
      fileSelected.style.display = "block";
      scanButton.disabled = false;
    } else {
      fileSelected.style.display = "none";
      scanButton.disabled = true;
    }
  }

  function scanQR() {
    const file = qrInput.files[0];
    if (file) {
      scanQRFromImage(file);
    } else {
      startScanner();
    }
  }

  function scanQRFromImage(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          handleQRCode(code.data);
        } else {
          console.error("Không tìm thấy mã QR trong ảnh");
          alert(
            "Không tìm thấy mã QR trong ảnh. Vui lòng thử lại với ảnh khác."
          );
        }
      };
      img.src = event.target.result;
    };
    reader.onerror = function () {
      console.error("Lỗi khi đọc file");
      alert("Có lỗi xảy ra khi đọc file. Vui lòng thử lại.");
    };
    reader.readAsDataURL(file);
  }

  function handleQRCode(decodedText) {
    console.log("Đã phát hiện mã QR:", decodedText);
    // Hiển thị loading spinner
    showLoadingSpinner();

    // Trích xuất SSCC từ URL
    const sscc = extractSSCC(decodedText);
    if (sscc) {
      console.log("Đã trích xuất SSCC:", sscc);
      fetchBatchInfoBySSCC(sscc).finally(() => {
        // Ẩn loading spinner khi hoàn thành (dù thành công hay thất bại)
        hideLoadingSpinner();
      });
    } else {
      console.error("Không thể trích xuất SSCC từ URL:", decodedText);
      alert("Mã QR không hợp lệ hoặc không chứa SSCC");
      hideLoadingSpinner();
    }
  }

  function showLoadingSpinner() {
    if (!document.getElementById("loadingSpinner")) {
      const spinner = document.createElement("div");
      spinner.id = "loadingSpinner";
      spinner.className = "loading-spinner";
      spinner.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(spinner);
    }
    document.getElementById("loadingSpinner").style.display = "block";
  }

  function hideLoadingSpinner() {
    const spinner = document.getElementById("loadingSpinner");
    if (spinner) {
      spinner.style.display = "none";
    }
  }

  function extractSSCC(url) {
    // Kiểm tra nếu url chứa '/batch/'
    if (url.includes("/batch/")) {
      // Lấy phần cuối cùng của URL sau '/batch/'
      const parts = url.split("/batch/");
      return parts[parts.length - 1];
    }
    // Nếu không, tìm kiếm tham số sscc trong URL
    const match = url.match(/sscc=([^&]+)/);
    return match ? match[1] : null;
  }

  const closeButton = document.querySelector(".close");
  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  const completionMessage = localStorage.getItem("transportCompletionMessage");
  if (completionMessage) {
    showTransportCompletionMessage();
  }
});

// Gán các hàm cần thiết cho window object
window.displayBatchInfo = displayBatchInfo;
window.fetchBatchInfoBySSCC = fetchBatchInfoBySSCC;
window.updateTransportStatus = updateTransportStatus;
window.openImageModal = openImageModal;
window.openImageGallery = openImageGallery;
window.expandImage = expandImage;
window.closeModal = closeModal;

function showActionMessage(message, type) {
  const actionMessage = document.getElementById("actionMessage");
  actionMessage.textContent = message;
  actionMessage.className = `action-message ${type}`;
  actionMessage.style.display = "block";

  // Force a reflow
  void actionMessage.offsetWidth;

  actionMessage.classList.add("show");

  setTimeout(() => {
    actionMessage.classList.remove("show");
    setTimeout(() => {
      actionMessage.style.display = "none";
    }, 300); // Đợi cho animation kết thúc
  }, 3000);
}
