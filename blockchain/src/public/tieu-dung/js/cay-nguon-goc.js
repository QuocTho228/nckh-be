// ==========================================
// CAY-NGUON-GOC.JS - Lịch sử chăm sóc cây
// ==========================================

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const treeQR = urlParams.get("qr");

  if (!treeQR) {
    showError("Không tìm thấy mã QR cây");
    return;
  }

  await loadTreeDetails(treeQR);
});

/**
 * Load thông tin chi tiết cây
 */
async function loadTreeDetails(treeQR) {
  try {
    const response = await fetch(
      `/api/public/tree/${encodeURIComponent(treeQR)}/details`,
    );
    const result = await response.json();

    if (!result.success) {
      showError(result.error || "Không thể tải thông tin cây");
      return;
    }

    const data = result.data;

    displayTreeInfo(data);
    displayActivities(data.activities);
    displayHarvests(data.harvests);

    document.getElementById("loading").style.display = "none";
    document.getElementById("treeContent").style.display = "block";
  } catch (error) {
    console.error("Error loading tree:", error);
    showError("Không thể kết nối đến server");
  }
}

/**
 * Hiển thị thông tin cây
 */
function displayTreeInfo(data) {
  const { tree, farmer, location, statistics } = data;

  // Header
  document.getElementById("treeType").textContent =
    `${tree.treeType} - ${tree.variety}`;
  document.getElementById("treeQR").textContent = tree.treeQRCode;
  document.getElementById("variety").textContent = tree.variety;
  document.getElementById("plantedDate").textContent = formatDate(
    tree.plantedDate,
  );
  document.getElementById("farmerName").textContent = farmer.name;

  // Info card
  const locationText = [
    location.ward,
    location.district,
    location.province,
    location.region,
  ]
    .filter(Boolean)
    .join(", ");
  document.getElementById("location").textContent = locationText || "-";
  document.getElementById("coordinates").textContent = tree.coordinates || "-";
  document.getElementById("daysSincePlanted").textContent =
    `${statistics.daysSincePlanted} ngày`;
  document.getElementById("totalActivities").textContent =
    statistics.totalActivities;
}

/**
 * Hiển thị lịch sử hoạt động
 */
function displayActivities(activities) {
  const container = document.getElementById("activitiesContainer");

  if (!activities || activities.length === 0) {
    container.innerHTML = '<p class="text-muted">Chưa có hoạt động nào</p>';
    return;
  }

  container.innerHTML = activities
    .map((activity, index) => {
      const categoryInfo = getCategoryInfo(activity.category);

      return `
            <div class="activity-item" data-aos="fade-left" data-aos-delay="${index * 50}">
                <div class="card activity-card shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="text-success mb-0">
                                <i class="${categoryInfo.icon} mr-2"></i>
                                ${activity.activityName}
                            </h6>
                            <span class="badge badge-${categoryInfo.color}">
                                ${categoryInfo.name}
                            </span>
                        </div>
                        
                        <p class="text-muted small mb-2">
                            <i class="far fa-clock mr-2"></i>${formatDateTime(activity.timestamp)}
                        </p>
                        
                        ${
                          activity.description
                            ? `
                            <p class="mb-2">${activity.description}</p>
                        `
                            : ""
                        }
                        
                        ${renderActivityMetadata(activity)}
                        
                        <div class="text-muted small mt-2">
                            <i class="fas fa-user mr-2"></i>${activity.participantName}
                            ${activity.participantPhone ? ` - ${activity.participantPhone}` : ""}
                        </div>
                        
                        ${renderActivityImages(activity.images)}
                    </div>
                </div>
            </div>
        `;
    })
    .join("");
}

/**
 * Render metadata của activity
 */
function renderActivityMetadata(activity) {
  const fields = [];

  if (activity.fertilizer) {
    fields.push(
      `<span class="badge badge-info mr-1">Phân bón: ${activity.fertilizer}</span>`,
    );
  }
  if (activity.pesticide) {
    fields.push(
      `<span class="badge badge-warning mr-1">Thuốc BVTV: ${activity.pesticide}</span>`,
    );
  }
  if (activity.quantity && activity.unit) {
    fields.push(
      `<span class="badge badge-secondary mr-1">Số lượng: ${activity.quantity} ${activity.unit}</span>`,
    );
  }
  if (activity.temperature) {
    fields.push(
      `<span class="badge badge-light mr-1">Nhiệt độ: ${activity.temperature}°C</span>`,
    );
  }
  if (activity.humidity) {
    fields.push(
      `<span class="badge badge-light mr-1">Độ ẩm: ${activity.humidity}%</span>`,
    );
  }
  if (activity.weather) {
    fields.push(
      `<span class="badge badge-light mr-1">Thời tiết: ${activity.weather}</span>`,
    );
  }
  if (activity.healthStatus) {
    fields.push(
      `<span class="badge badge-success mr-1">Tình trạng: ${activity.healthStatus}</span>`,
    );
  }
  if (activity.notes) {
    fields.push(
      `<p class="text-muted small mb-0 mt-2"><i class="fas fa-sticky-note mr-2"></i>${activity.notes}</p>`,
    );
  }

  return fields.length > 0 ? `<div class="mb-2">${fields.join("")}</div>` : "";
}

/**
 * Render ảnh của activity
 */
function renderActivityImages(images) {
  if (!images || images.length === 0) return "";

  return `
        <div class="activity-images">
            ${images
              .map(
                (img) => `
                <img src="${img}" alt="Activity" onclick="showImage(this)" />
            `,
              )
              .join("")}
        </div>
    `;
}

/**
 * Hiển thị lịch sử thu hoạch
 */
function displayHarvests(harvests) {
  if (!harvests || harvests.length === 0) return;

  document.getElementById("harvestSection").style.display = "block";
  const container = document.getElementById("harvestContainer");

  container.innerHTML = harvests
    .map(
      (harvest) => `
        <div class="card mb-2">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <h6 class="mb-2">${harvest.batchName}</h6>
                        <p class="mb-1">
                            <strong>Mã SSCC:</strong> 
                            <a href="lo-hang.html?sscc=${harvest.sscc}" class="badge badge-success">
                                ${harvest.sscc}
                            </a>
                        </p>
                        <p class="mb-1">
                            <strong>Ngày thu hoạch:</strong> ${formatDate(harvest.harvestDate)}
                        </p>
                        ${harvest.harvestNotes ? `<p class="text-muted small mb-0">${harvest.harvestNotes}</p>` : ""}
                    </div>
                    <div class="col-md-4 text-right">
                        <span class="badge badge-info p-2">${harvest.batchStatus}</span>
                    </div>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

/**
 * Get category info
 */
function getCategoryInfo(category) {
  const categories = {
    TreeManagement: {
      name: "Quản lý cây",
      icon: "fas fa-tree",
      color: "primary",
    },
    Farming: { name: "Canh tác", icon: "fas fa-tractor", color: "success" },
    Harvesting: {
      name: "Thu hoạch",
      icon: "fas fa-shopping-basket",
      color: "warning",
    },
    Purchase: { name: "Thu mua", icon: "fas fa-shopping-cart", color: "info" },
    Transport: { name: "Vận chuyển", icon: "fas fa-truck", color: "secondary" },
    Processing: { name: "Sơ chế", icon: "fas fa-cogs", color: "dark" },
    Packaging: { name: "Đóng gói", icon: "fas fa-box", color: "primary" },
    QualityControl: {
      name: "Kiểm nghiệm",
      icon: "fas fa-clipboard-check",
      color: "success",
    },
    Warehouse: { name: "Kho bãi", icon: "fas fa-warehouse", color: "info" },
    Distribution: {
      name: "Phân phối",
      icon: "fas fa-shipping-fast",
      color: "warning",
    },
  };

  return (
    categories[category] || {
      name: category,
      icon: "fas fa-circle",
      color: "secondary",
    }
  );
}

/**
 * Helper functions
 */
function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("vi-VN");
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("vi-VN");
}

function showError(message) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("error").textContent = message;
  document.getElementById("error").style.display = "block";
}

function showImage(img) {
  const overlay = document.getElementById("overlay");
  const overlayImg = document.getElementById("overlay-img");
  overlayImg.src = img.src;
  overlay.style.display = "flex";
}

function hideImage() {
  document.getElementById("overlay").style.display = "none";
}
