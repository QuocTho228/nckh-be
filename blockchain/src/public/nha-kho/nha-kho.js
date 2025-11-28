let batchInfo;
let html5QrCode;
let isConfirming = false;
let startCameraButton;
let qrInput;
let fileSelected;
let scanButton;
let qrReader;

let currentGalleryImages = [];
let currentImageIndex = 0;

function normalizeImageUrl(imageUrl) {
    if (!imageUrl) return '/Uploads/noimage.png';
    imageUrl = decodeURIComponent(imageUrl);
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    imageUrl = imageUrl.replace(/\\/g, '/');
    if (imageUrl.startsWith('/uploads/')) {
        return imageUrl;
    }
    if (!imageUrl.includes('/')) {
        return `/uploads/${imageUrl}`;
    }
    return imageUrl;
}

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

        if (!Array.isArray(history)) {
            throw new Error("Lịch sử vận chuyển không phải là một mảng");
        }

        let historyHTML = `
            <h3>Lịch sử vận chuyển</h3>
            <div class="timeline">
        `;

        history.forEach((event, index) => {
            const addressParts = event.transporterAddress ? event.transporterAddress.split(", ") : [];
            const uniqueAddressParts = [...new Set(addressParts)];
            const formattedAddress = uniqueAddressParts.join(", ");
            const positionClass = index % 2 === 0 ? "timeline-left" : "timeline-right";

            historyHTML += `
                <div class="timeline-item ${positionClass}">
                    <div class="timeline-content">
                        <div class="timeline-dot"></div>
                        <div class="timeline-details">
                            <h4>${translateAction(event.action)}</h4>
                            <p><strong>Thời gian:</strong> ${new Date(event.timestamp).toLocaleString("vi-VN", {
                                hour12: false,
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            })}</p>
                            <p><strong>Loại người tham gia:</strong> ${translateParticipantType(event.participantType)}</p>
                            <p><strong>Người vận chuyển:</strong> ${event.transporterName || "Không có thông tin"}</p>
                            <p><strong>Số điện thoại:</strong> ${event.transporterPhone || "Không có thông tin"}</p>
                            <p><strong>Địa chỉ:</strong> ${formattedAddress || "Không có thông tin"}</p>
                        </div>
                    </div>
                </div>
            `;
        });

        historyHTML += `</div>`;
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
    const warehouseActionsDiv = document.getElementById("warehouseActions");

    let tableHTML = '<table class="batch-info-table">';
    const addRow = (label, value, className = "") => {
        tableHTML += `
            <tr>
                <th>${label}</th>
                <td class="${className}">${value}</td>
            </tr>
        `;
    };

    addRow("Trạng thái", `<span class="status-approved"><i class="fas fa-check-circle"></i> ${info.status}</span>`);
    addRow("Mã Lô hàng", info.batchId);
    addRow("Tên lô hàng", info.name);
    addRow("Số lượng (tấn)", info.quantity);
    addRow("Ngày tạo lô hàng", new Date(info.productionDate).toLocaleDateString());
    addRow("Trạng thái vận chuyển", info.transportStatus);
    addRow("Người sản xuất", info.producer.name);
    addRow("Địa chỉ", info.producer.address);
    addRow("Số điện thoại", info.producer.phone);

    if (info.productImageUrls && Object.keys(info.productImageUrls).length > 0) {
        const imageCount = Object.keys(info.productImageUrls).length;
        addRow("Hình ảnh sản phẩm", `<button class="btn btn-primary" onclick="openImageGallery('product')">Xem ${imageCount} ảnh sản phẩm</button>`);
    }

    if (info.certificateImageUrl) {
        const escapedUrl = info.certificateImageUrl.replace(/'/g, "\\'");
        addRow("Giấy chứng nhận", `<button class="btn btn-primary" onclick="openImageModal('${escapedUrl}')">Xem giấy chứng nhận</button>`);
    }

    tableHTML += "</table>";

    batchDetailsDiv.innerHTML = tableHTML;
    batchInfoDiv.style.display = "block";

    let actionsHTML = "";
    if (info.transportStatus === "Đã vận chuyển" && info.detailedTransportStatus === "Đã giao" && info.warehouseConfirmed === false) {
        actionsHTML = `
            <button onclick="confirmReceipt('${info.sscc}')" class="btn btn-primary">
                <i class="fas fa-check-circle"></i> Xác nhận nhận hàng
            </button>`;
    } else if (info.warehouseConfirmed === true) {
        actionsHTML = `<div class="confirmation-status"><i class="fas fa-check-circle"></i> Lô hàng đã được xác nhận</div>`;
    } else {
        actionsHTML = `<p class="mt-3">Lô hàng chưa sẵn sàng để xác nhận</p>`;
    }

    warehouseActionsDiv.innerHTML = actionsHTML;
    warehouseActionsDiv.style.display = actionsHTML ? "flex" : "none";

    displayTransportHistory(info.sscc);
}

async function fetchBatchInfoBySSCC(sscc) {
    try {
        const response = await fetch(`/api/batch-info-by-sscc/${sscc}`);
        if (!response.ok) {
            throw new Error("Không thể lấy thông tin lô hàng");
        }
        batchInfo = await response.json();
        console.log("Received batch info:", batchInfo);
        displayBatchInfo(batchInfo);
    } catch (error) {
        console.error("Lỗi khi lấy thông tin lô hàng:", error);
        alert("Có lỗi xảy ra khi lấy thông tin lô hàng. Vui lòng thử lại.");
    }
}

async function confirmReceipt(sscc) {
    console.log("Xác nhận nhận hàng cho SSCC:", sscc);
    try {
        const response = await fetch("/api/warehouse-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sscc })
        });
        const data = await response.json();

        if (response.ok) {
            const batchDetailsDiv = document.getElementById("batchDetails");
            const confirmButton = batchDetailsDiv.querySelector('button[onclick^="confirmReceipt"]');
            if (confirmButton) {
                confirmButton.remove();
            }
            const successMessage = document.createElement("p");
            successMessage.className = "text-success mt-3";
            successMessage.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận nhận hàng thành công';
            batchDetailsDiv.appendChild(successMessage);
            batchInfo.warehouseConfirmed = true;
        } else {
            console.error("Lỗi khi xác nhận nhận hàng:", data.error);
            const errorMessage = document.createElement("p");
            errorMessage.className = "text-danger mt-3";
            errorMessage.textContent = "Lỗi: " + data.error;
            document.getElementById("batchDetails").appendChild(errorMessage);
        }
    } catch (error) {
        console.error("Lỗi khi xác nhận nhận hàng:", error);
        const errorMessage = document.createElement("p");
        errorMessage.className = "text-danger mt-3";
        errorMessage.textContent = "Có lỗi xảy ra khi xác nhận nhận hàng";
        document.getElementById("batchDetails").appendChild(errorMessage);
    }
}

function openImageModal(imageUrl) {
    imageUrl = normalizeImageUrl(imageUrl);
    const modal = document.getElementById("imageModal");
    const modalImage = document.getElementById("modalImage");
    const modalContent = document.getElementById("modalContent");

    modalImage.src = imageUrl;
    modalImage.style.display = "block";
    modalContent.innerHTML = "";
    modal.style.display = "flex";

    let downloadBtn = modalContent.querySelector(".download-btn");
    if (!downloadBtn) {
        downloadBtn = document.createElement("button");
        downloadBtn.className = "download-btn";
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Tải về';
        modalContent.appendChild(downloadBtn);
    }
    downloadBtn.style.display = "block";

    downloadBtn.onclick = function(e) {
        e.stopPropagation();
        const fileName = imageUrl.split("/").pop() || `image-${Date.now()}.jpg`;
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

function openImageGallery(type) {
    const modal = document.getElementById("imageModal");
    const modalContent = document.getElementById("modalContent");
    const modalImage = document.getElementById("modalImage");

    modalContent.innerHTML = "";
    modalImage.style.display = "none";
    currentGalleryImages = [];
    currentImageIndex = 0;

    const images = type === "product" ? batchInfo.productImageUrls : batchInfo.batchImageUrls;
    if (images && (Array.isArray(images) || typeof images === "object") && Object.keys(images).length > 0) {
        currentGalleryImages = Array.isArray(images) ? images : Object.values(images);
        let galleryHTML = '<div class="image-gallery">';
        currentGalleryImages.forEach((url, index) => {
            url = normalizeImageUrl(url);
            galleryHTML += `<img src="${url}" alt="${type} image" class="gallery-image" onclick="expandImage(${index})">`;
        });
        galleryHTML += "</div>";
        modalContent.innerHTML = galleryHTML;

        if (currentGalleryImages.length > 1) {
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
                currentImageIndex = (currentImageIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
                expandImage(currentImageIndex);
            };
            nextBtn.onclick = () => {
                currentImageIndex = (currentImageIndex + 1) % currentGalleryImages.length;
                expandImage(currentImageIndex);
            };
        }

        if (currentGalleryImages.length > 0) {
            expandImage(0);
        }
    } else {
        modalContent.innerHTML = "<p>Không có hình ảnh để hiển thị.</p>";
    }

    modal.style.display = "flex";
    document.addEventListener("keydown", handleGalleryKeyPress);
}

function expandImage(index) {
    const modal = document.getElementById("imageModal");
    const modalImage = document.getElementById("modalImage");
    const modalContent = document.getElementById("modalContent");

    currentImageIndex = index;
    modalImage.src = normalizeImageUrl(currentGalleryImages[index]);
    modalImage.style.display = "block";

    const gallery = modalContent.querySelector(".image-gallery");
    if (gallery) {
        gallery.style.display = "none";
    }

    let downloadBtn = modalContent.querySelector(".download-btn");
    if (!downloadBtn) {
        downloadBtn = document.createElement("button");
        downloadBtn.className = "download-btn";
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Tải về';
        modalContent.appendChild(downloadBtn);
    }
    downloadBtn.style.display = "block";

    downloadBtn.onclick = function(e) {
        e.stopPropagation();
        const src = normalizeImageUrl(currentGalleryImages[index]);
        const fileName = src.split("/").pop() || `image-${Date.now()}.jpg`;
        const link = document.createElement("a");
        link.href = src;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

function handleGalleryKeyPress(event) {
    if (event.key === "ArrowLeft") {
        currentImageIndex = (currentImageIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
        expandImage(currentImageIndex);
    } else if (event.key === "ArrowRight") {
        currentImageIndex = (currentImageIndex + 1) % currentGalleryImages.length;
        expandImage(currentImageIndex);
    } else if (event.key === "Escape") {
        closeModal();
    }
}

function closeModal() {
    const modal = document.getElementById("imageModal");
    const modalImage = document.getElementById("modalImage");
    const modalContent = document.getElementById("modalContent");
    modal.style.display = "none";
    modalImage.src = "";
    modalImage.style.display = "none";
    modalContent.innerHTML = "";
    const prevBtn = modal.querySelector(".prev-btn");
    const nextBtn = modal.querySelector(".next-btn");
    if (prevBtn) prevBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "none";
    document.removeEventListener("keydown", handleGalleryKeyPress);
}

document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("imageModal");
    if (modal) {
        const closeBtn = modal.querySelector(".close");
        const overlay = modal.querySelector(".modal-overlay");
        if (closeBtn) {
            closeBtn.addEventListener("click", closeModal);
        }
        if (overlay) {
            overlay.addEventListener("click", closeModal);
        }
    }

    startCameraButton = document.getElementById("start-camera");
    qrInput = document.getElementById("qr-input");
    fileSelected = document.getElementById("file-selected");
    scanButton = document.getElementById("scan-button");
    qrReader = document.getElementById("qr-reader");

    if (startCameraButton) {
        startCameraButton.addEventListener("click", async function () {
            if (html5QrCode && html5QrCode.isScanning) {
                stopScanner();
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                stream.getTracks().forEach((track) => track.stop());
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
            if (!html5QrCode) {
                html5QrCode = new Html5Qrcode("qr-reader");
            }
            qrReader.style.display = "block";
            await html5QrCode.start(
                { facingMode: { exact: "environment" } },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                (decodedText) => {
                    console.log("QR Code detected:", decodedText);
                    stopScanner();
                    handleQRCode(decodedText);
                },
                (errorMessage) => {
                    console.log("QR Error:", errorMessage);
                }
            );
            startCameraButton.innerHTML = '<i class="fas fa-stop-circle"></i> Dừng quét';
            scanButton.disabled = true;
        } catch (err) {
            console.error("Back camera error:", err);
            try {
                await html5QrCode.start(
                    { facingMode: "user" },
                    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                    (decodedText) => {
                        console.log("QR Code detected:", decodedText);
                        stopScanner();
                        handleQRCode(decodedText);
                    }
                );
                startCameraButton.innerHTML = '<i class="fas fa-stop-circle"></i> Dừng quét';
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
            startCameraButton.innerHTML = '<i class="fas fa-camera"></i> Quét QR bằng camera';
            scanButton.disabled = false;
        } catch (err) {
            console.error("Stop scanner error:", err);
        }
    }

    function handleFileInput(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("File quá lớn. Vui lòng chọn file nhỏ hơn 5MB.");
                return;
            }
            if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
                alert("Định dạng file không hỗ trợ. Vui lòng chọn file JPEG, PNG hoặc GIF.");
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
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    handleQRCode(code.data);
                } else {
                    console.error("Không tìm thấy mã QR trong ảnh");
                    alert("Không tìm thấy mã QR trong ảnh. Vui lòng thử lại với ảnh khác.");
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
        showLoadingSpinner();
        const sscc = extractSSCC(decodedText);
        if (sscc) {
            console.log("Đã trích xuất SSCC:", sscc);
            fetchBatchInfoBySSCC(sscc).finally(() => {
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
        if (url.includes("/batch/")) {
            const parts = url.split("/batch/");
            return parts[parts.length - 1];
        }
        const match = url.match(/sscc=([^&]+)/);
        return match ? match[1] : null;
    }
});

window.displayBatchInfo = displayBatchInfo;
window.fetchBatchInfoBySSCC = fetchBatchInfoBySSCC;
window.openImageModal = openImageModal;
window.openImageGallery = openImageGallery;
window.expandImage = expandImage;
window.closeModal = closeModal;
window.confirmReceipt = confirmReceipt;