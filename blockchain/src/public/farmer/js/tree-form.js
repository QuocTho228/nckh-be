/**
 * ========================================
 * TREE-FORM.JS - Updated với Auto QR Generation
 * ========================================
 */

const TreeForm = {
  /**
   * Render form đăng ký cây mới (KHÔNG CẦN NHẬP QR CODE)
   */
  async renderAddTreeForm(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Load regions
    const regionsResult = await API.getRegions();
    const regions = regionsResult.success ? regionsResult.data : [];

    container.innerHTML = `
      <form id="addTreeForm" class="space-y-6">
        
        <!-- ❌ REMOVED: QR Code input field -->
        <!-- QR Code sẽ được tạo tự động -->
        
        <!-- Region -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Vùng trồng <span class="text-red-500">*</span>
          </label>
          <select id="regionId" required class="input-gradient">
            <option value="">-- Chọn vùng --</option>
            ${regions
              .map(
                (r) =>
                  `<option value="${r.region_id}">${r.region_name}</option>`,
              )
              .join("")}
          </select>
        </div>
        
        <!-- Tree Type -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Loại cây <span class="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            id="treeType"
            required
            placeholder="Ví dụ: Sầu riêng"
            class="input-gradient"
          >
        </div>
        
        <!-- Variety -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Giống <span class="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            id="variety"
            required
            placeholder="Ví dụ: Ri6, Mong Thong, Musang King..."
            class="input-gradient"
          >
        </div>
        
        <!-- Coordinates -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Vị trí / Tọa độ <span class="text-red-500">*</span>
          </label>
          <div class="relative">
            <textarea 
              id="coordinates"
              required
              rows="2"
              placeholder="Đang lấy vị trí GPS..."
              readonly
              class="input-gradient pr-12 bg-gray-50 cursor-not-allowed select-none"
            ></textarea>
            <button 
              type="button" 
              id="gpsBtn"
              title="Lấy lại vị trí GPS"
              class="absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-full bg-green-100 hover:bg-green-200 text-green-700 transition"
            >
              <i class="fas fa-location-crosshairs text-sm"></i>
            </button>
          </div>
          <!-- GPS status -->
          <div id="gpsStatus" class="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <i class="fas fa-spinner fa-spin text-green-500"></i>
            <span>Đang lấy vị trí GPS tự động...</span>
          </div>
        </div>

        <!-- ✅ INFO BOX: QR Code sẽ tự động tạo -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <i class="fas fa-info-circle text-blue-600 text-xl"></i>
            <div class="flex-1">
              <p class="text-sm font-semibold text-blue-900 mb-1">
                Mã QR Code sẽ được tạo tự động
              </p>
              <p class="text-xs text-blue-700">
                Sau khi đăng ký thành công, hệ thống sẽ tự động sinh mã QR Code 
                theo định dạng <strong>DURIAN-{ID}-{Ngày}</strong> cho cây của bạn.
              </p>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex gap-3 pt-4 border-t border-gray-200">
          <button type="button" id="cancelBtn" class="btn-secondary flex-1">
            <i class="fas fa-times mr-2"></i> Hủy
          </button>
          <button type="submit" class="btn-primary flex-1">
            <i class="fas fa-save mr-2"></i> Đăng ký cây
          </button>
        </div>
        
      </form>
    `;

    // ✅ GPS: Auto-detect location when form opens
    const coordsField = document.getElementById("coordinates");
    const gpsStatus = document.getElementById("gpsStatus");
    const gpsBtn = document.getElementById("gpsBtn");

    /**
     * Lấy tên vị trí từ tọa độ (reverse geocoding) dùng Nominatim (miễn phí, không cần API key)
     */
    async function reverseGeocode(lat, lng) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
          { headers: { "Accept-Language": "vi" } },
        );
        if (!res.ok) return null;
        const data = await res.json();
        const addr = data.address || {};

        // DEBUG: xem Nominatim trả về fields gì cho vị trí này
        console.log(
          "[GPS] Nominatim address fields:",
          JSON.stringify(addr, null, 2),
        );

        // Phường/Xã: Nominatim VN thường trả về ở city_district, suburb, quarter, hoặc village
        const ward =
          addr.city_district ||
          addr.quarter ||
          addr.suburb ||
          addr.neighbourhood ||
          addr.village ||
          addr.hamlet ||
          addr.town ||
          "";

        // Tỉnh/TP trực thuộc TW
        const city = addr.city || addr.state || "";

        // Rút gọn: "Thành phố Cần Thơ" → "TP. Cần Thơ", "Tỉnh An Giang" → "An Giang"
        const cityShort = city
          .replace(/^Th\u00e0nh ph\u1ed1\s+/i, "TP. ")
          .replace(/^T\u1ec9nh\s+/i, "");

        const parts = [ward, cityShort].filter(Boolean);
        console.log(
          "[GPS] ward:",
          ward,
          "| city:",
          city,
          "| cityShort:",
          cityShort,
        );
        return parts.length > 0 ? parts.join(", ") : null;
      } catch (e) {
        console.error("[GPS] reverseGeocode error:", e);
        return null;
      }
    }

    /**
     * Lấy GPS và điền vào ô tọa độ
     */
    async function fetchGPS() {
      if (!navigator.geolocation) {
        gpsStatus.innerHTML = `<i class="fas fa-exclamation-circle text-red-500"></i> <span class="text-red-500">Trình duyệt không hỗ trợ GPS</span>`;
        coordsField.placeholder = "Nhập thủ công: Ví dụ: 10.762622, 106.660172";
        return;
      }

      gpsStatus.innerHTML = `<i class="fas fa-spinner fa-spin text-green-500"></i> <span>Đang lấy vị trí GPS tự động...</span>`;
      gpsBtn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          const accuracy = Math.round(pos.coords.accuracy);

          // Lấy tên địa điểm
          gpsStatus.innerHTML = `<i class="fas fa-spinner fa-spin text-blue-500"></i> <span>Đang tra cứu tên vị trí...</span>`;
          const placeName = await reverseGeocode(lat, lng);

          if (placeName) {
            coordsField.value = `${placeName}, ${lat}, ${lng}`;
          } else {
            coordsField.value = `${lat}, ${lng}`;
          }

          gpsStatus.innerHTML = `<i class="fas fa-check-circle text-green-500"></i> <span class="text-green-700">Đã lấy vị trí GPS (độ chính xác ~${accuracy}m)</span>`;
          gpsBtn.disabled = false;
        },
        (err) => {
          gpsBtn.disabled = false;
          let msg = "Không lấy được GPS";
          if (err.code === 1) msg = "Bạn đã từ chối quyền truy cập vị trí";
          else if (err.code === 2) msg = "Không tìm thấy tín hiệu GPS";
          else if (err.code === 3) msg = "Hết thời gian chờ GPS";
          gpsStatus.innerHTML = `<i class="fas fa-exclamation-circle text-orange-500"></i> <span class="text-orange-600">${msg} — nhập thủ công bên dưới</span>`;
          coordsField.placeholder =
            "Ví dụ: Thửa 15, Lô A2 hoặc 10.762622, 106.660172";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }

    // Tự động lấy GPS ngay khi form mở
    fetchGPS();

    // Nút lấy lại GPS
    gpsBtn.addEventListener("click", fetchGPS);

    // Handle form submit
    const form = document.getElementById("addTreeForm");
    const cancelBtn = document.getElementById("cancelBtn");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = {
        regionId: document.getElementById("regionId").value,
        treeType: document.getElementById("treeType").value.trim(),
        variety: document.getElementById("variety").value.trim(),
        coordinates: document.getElementById("coordinates").value.trim(),
      };

      // Validate
      if (
        !formData.regionId ||
        !formData.treeType ||
        !formData.variety ||
        !formData.coordinates
      ) {
        Utils.toast.error("Vui lòng điền đầy đủ thông tin");
        return;
      }

      // Show loading
      Utils.loading.show();

      try {
        const result = await API.registerTree(formData);

        Utils.loading.hide();

        if (result.success) {
          // ✅ FIX: Check the actual response structure
          console.log("API Response:", result);

          // Backend returns: { success: true, message: "...", data: { treeId, treeQRCode, qrImageUrl, ... } }
          const responseData = result.data?.data || result.data;

          // ✅ Extract data with fallbacks
          const treeQRCode = responseData?.treeQRCode || "N/A";
          const treeId = responseData?.treeId || "N/A";
          const qrImageUrl = responseData?.qrImageUrl || "";

          console.log("Extracted data:", { treeQRCode, treeId, qrImageUrl });

          // Show success dialog
          await Swal.fire({
            icon: "success",
            title: "Đăng ký cây thành công!",
            html: `
          <div class="text-left space-y-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <p class="text-sm text-green-800 mb-2">
                <i class="fas fa-check-circle mr-2"></i>
                Cây của bạn đã được đăng ký thành công
              </p>
              <div class="space-y-2 text-sm">
                <div>
                  <span class="text-gray-600">Mã QR:</span>
                  <strong class="ml-2 text-green-900">${treeQRCode}</strong>
                  <button 
                    onclick="navigator.clipboard.writeText('${treeQRCode}'); Swal.showValidationMessage('Đã sao chép!');"
                    class="ml-2 text-xs text-blue-600 hover:text-blue-800"
                    type="button"
                  >
                    <i class="fas fa-copy"></i> Sao chép
                  </button>
                </div>
                <div>
                  <span class="text-gray-600">ID Cây:</span>
                  <strong class="ml-2 text-green-900">${treeId}</strong>
                </div>
              </div>
            </div>

            ${
              qrImageUrl
                ? `
              <!-- ✅ QR Code Image -->
              <div class="flex justify-center">
                <div class="bg-white p-4 rounded-lg border-2 border-green-200">
                  <img 
                    src="${qrImageUrl}" 
                    alt="QR Code" 
                    class="w-48 h-48"
                    onerror="this.parentElement.innerHTML='<p class=text-red-500>Không thể tải ảnh QR</p>'"
                  />
                  <p class="text-xs text-center text-gray-600 mt-2">
                    Mã QR của cây
                  </p>
                </div>
              </div>

              <div class="text-xs text-gray-500 text-center">
                <i class="fas fa-info-circle mr-1"></i>
                Bạn có thể tải ảnh QR Code này về để in dán
              </div>
            `
                : `
              <div class="text-center text-gray-500">
                <i class="fas fa-exclamation-circle mr-1"></i>
                Chưa có ảnh QR Code
              </div>
            `
            }
          </div>
        `,
            confirmButtonColor: "#028040",
            confirmButtonText: "Đóng",
            width: 600,
          });

          if (options.onSuccess) {
            options.onSuccess(responseData);
          }
        } else {
          Utils.toast.error(result.error || "Lỗi khi đăng ký cây");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Register tree error:", error);
        Utils.toast.error("Lỗi khi đăng ký cây: " + error.message);
      }
    });

    cancelBtn.addEventListener("click", () => {
      if (options.onCancel) {
        options.onCancel();
      }
    });
  },

  /**
   * Render form ghi nhật ký chăm sóc
   */
  async renderAddCareForm(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { treeIds = [], trees = [] } = options;

    container.innerHTML = `
      <form id="addCareForm" class="space-y-6">
        
        <!-- Selected Trees Info -->
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 class="font-semibold text-green-900 mb-2">
            <i class="fas fa-tree mr-2"></i>
            Đang chăm sóc ${treeIds.length} cây:
          </h4>
          <div class="flex flex-wrap gap-2">
            ${trees
              .map(
                (t) => `
              <span class="badge badge-success">
                ${t.tree_qr_code}
              </span>
            `,
              )
              .join("")}
          </div>
        </div>
        
        <!-- Category -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Loại hoạt động <span class="text-red-500">*</span>
          </label>
          <select id="category" required class="input-gradient">
            <option value="">-- Chọn loại --</option>
            <option value="0">Quản lý cây</option>
            <option value="1">Canh tác</option>
          </select>
        </div>
        
        <!-- Activity Name -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Tên hoạt động <span class="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            id="activityName"
            required
            maxlength="200"
            placeholder="Ví dụ: Bón phân lần 1, Phun thuốc trừ sâu..."
            class="input-gradient"
          >
        </div>
        
        <!-- Description -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Mô tả chi tiết
          </label>
          <textarea 
            id="description"
            rows="3"
            placeholder="Mô tả chi tiết về hoạt động chăm sóc..."
            class="input-gradient"
          ></textarea>
        </div>
        
        <!-- Fertilizer & Pesticide -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Loại phân bón
            </label>
            <input 
              type="text" 
              id="fertilizer"
              placeholder="Ví dụ: NPK 20-20-15"
              class="input-gradient"
            >
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Loại thuốc trừ sâu
            </label>
            <input 
              type="text" 
              id="pesticide"
              placeholder="Ví dụ: Abamectin 1.8% EC"
              class="input-gradient"
            >
          </div>
        </div>
        
        <!-- Quantity & Unit -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Số lượng
            </label>
            <input 
              type="number" 
              id="quantity"
              step="0.01"
              min="0"
              placeholder="0"
              class="input-gradient"
            >
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Đơn vị
            </label>
            <select id="unit" class="input-gradient">
              <option value="">-- Chọn --</option>
              <option value="kg">kg</option>
              <option value="lít">lít</option>
              <option value="ml">ml</option>
              <option value="gram">gram</option>
            </select>
          </div>
        </div>
        
        <!-- Environment -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Nhiệt độ (°C)
            </label>
            <input 
              type="number" 
              id="temperature"
              placeholder="30"
              class="input-gradient"
            >
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Độ ẩm (%)
            </label>
            <input 
              type="number" 
              id="humidity"
              min="0"
              max="100"
              placeholder="75"
              class="input-gradient"
            >
          </div>
          
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Thời tiết
            </label>
            <select id="weather" class="input-gradient">
              <option value="">-- Chọn --</option>
              <option value="Nắng">Nắng</option>
              <option value="Mưa">Mưa</option>
              <option value="Nhiều mây">Nhiều mây</option>
              <option value="Âm u">Âm u</option>
            </select>
          </div>
        </div>
        
        <!-- Health Status -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Tình trạng sức khỏe cây
          </label>
          <select id="healthStatus" class="input-gradient">
            <option value="">-- Chọn --</option>
            <option value="Tốt">Tốt</option>
            <option value="Bình thường">Bình thường</option>
            <option value="Yếu">Yếu</option>
            <option value="Bệnh">Bệnh</option>
          </select>
        </div>
        
        <!-- Notes -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Ghi chú thêm
          </label>
          <textarea 
            id="notes"
            rows="2"
            placeholder="Các ghi chú khác..."
            class="input-gradient"
          ></textarea>
        </div>
        
        <!-- Images Upload -->
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            Ảnh minh chứng (tối đa 5 ảnh)
          </label>
          <input 
            type="file" 
            id="imageUrls"
            accept="image/*"
            multiple
            max="5"
            class="input-gradient"
          >
          <p class="text-xs text-gray-500 mt-1">
            <i class="fas fa-camera mr-1"></i> 
            JPEG, PNG, WebP - Tối đa 10MB/ảnh
          </p>
          
          <!-- Image Preview -->
          <div id="imagePreview" class="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3"></div>
        </div>
        
        <!-- Actions -->
        <div class="flex gap-3 pt-4 border-t border-gray-200">
          <button type="button" id="cancelBtn" class="btn-secondary flex-1">
            <i class="fas fa-times mr-2"></i> Hủy
          </button>
          <button type="submit" class="btn-primary flex-1">
            <i class="fas fa-save mr-2"></i> Lưu nhật ký
          </button>
        </div>
        
      </form>
    `;

    // Handle image preview
    const imageInput = document.getElementById("imageUrls");
    const imagePreview = document.getElementById("imagePreview");

    imageInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);

      // Validate
      const validation = Utils.validateFiles(files);
      if (!validation.valid) {
        Utils.toast.error(validation.error);
        imageInput.value = "";
        return;
      }

      // Show preview
      imagePreview.innerHTML = "";
      for (let file of files) {
        const preview = await Utils.previewImage(file);
        const div = document.createElement("div");
        div.className = "relative";
        div.innerHTML = `
          <img src="${preview}" class="w-full h-20 object-cover rounded-lg">
          <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition rounded-lg">
            <i class="fas fa-eye text-white"></i>
          </div>
        `;
        imagePreview.appendChild(div);
      }
    });

    // Handle form submit
    const form = document.getElementById("addCareForm");
    const cancelBtn = document.getElementById("cancelBtn");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Get form data
      const category = document.getElementById("category").value;
      const activityName = document.getElementById("activityName").value.trim();
      const description = document.getElementById("description").value.trim();
      const fertilizer = document.getElementById("fertilizer").value.trim();
      const pesticide = document.getElementById("pesticide").value.trim();
      const quantity = document.getElementById("quantity").value;
      const unit = document.getElementById("unit").value;
      const temperature = document.getElementById("temperature").value;
      const humidity = document.getElementById("humidity").value;
      const weather = document.getElementById("weather").value;
      const healthStatus = document.getElementById("healthStatus").value;
      const notes = document.getElementById("notes").value.trim();
      const images = imageInput.files;

      // Validate required
      if (!category || !activityName) {
        Utils.toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append("treeIds", JSON.stringify(treeIds));
      formData.append("category", category);
      formData.append("activityName", activityName);
      if (description) formData.append("description", description);
      if (fertilizer) formData.append("fertilizer", fertilizer);
      if (pesticide) formData.append("pesticide", pesticide);
      if (quantity) formData.append("quantity", quantity);
      if (unit) formData.append("unit", unit);
      if (temperature) formData.append("temperature", temperature);
      if (humidity) formData.append("humidity", humidity);
      if (weather) formData.append("weather", weather);
      if (healthStatus) formData.append("healthStatus", healthStatus);
      if (notes) formData.append("notes", notes);

      // Append images
      for (let i = 0; i < images.length; i++) {
        formData.append("imageUrls", images[i]);
      }

      // Show loading
      Utils.loading.show();

      try {
        const result = await API.addTreeCare(formData);

        Utils.loading.hide();

        if (result.success) {
          Utils.toast.success(
            `Đã ghi nhật ký chăm sóc cho ${treeIds.length} cây!`,
          );
          if (options.onSuccess) {
            options.onSuccess(result.data);
          }
        } else {
          Utils.toast.error(result.error || "Lỗi khi ghi nhật ký");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Add tree care error:", error);
        Utils.toast.error("Lỗi khi ghi nhật ký");
      }
    });

    cancelBtn.addEventListener("click", () => {
      if (options.onCancel) {
        options.onCancel();
      }
    });
  },
};

// Export for browser
if (typeof window !== "undefined") {
  window.TreeForm = TreeForm;
}
