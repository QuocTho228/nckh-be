/**
 * ========================================
 * STATUS-UPDATE.JS
 * ========================================
 */

function statusUpdate() {
  return {
    loading: true,
    error: null,
    batchId: null,
    batchData: null,
    submitting: false,
    currentLocation: null,
    gettingLocation: false,
    savedTransportInfo: null,

    formData: {
      fromLocation: "",
      toLocation: "",
      vehicle: "",
      licensePlate: "",
      temperature: "",
      humidity: "",
      notes: "",
      images: [],
      selectedAction: null,
    },

    get availableActions() {
      if (!this.batchData || !this.batchData.batch) return [];

      const currentStatus = this.batchData.batch.detailed_transport_status;

      const actionMap = {
        NotStarted: [
          {
            code: 0,
            name: "Bắt đầu vận chuyển",
            description: "Bắt đầu quá trình vận chuyển",
            color: "blue",
          },
        ],
        InTransit: [
          {
            code: 1,
            name: "Tạm dừng vận chuyển",
            description: "Dừng tạm thời (nghỉ, sửa chữa...)",
            color: "yellow",
          },
          {
            code: 3,
            name: "Hoàn thành vận chuyển",
            description: "Đã giao đến điểm đến",
            color: "green",
          },
        ],
        Paused: [
          {
            code: 2,
            name: "Tiếp tục vận chuyển",
            description: "Tiếp tục hành trình",
            color: "blue",
          },
          // {
          //   code: 3,
          //   name: "Hoàn thành vận chuyển",
          //   description: "Đã giao đến điểm đến",
          //   color: "green",
          // },
        ],
        Delivered: [
          {
            code: 0,
            name: "Bắt đầu vận chuyển",
            description: "Bắt đầu lần vận chuyển mới",
            color: "blue",
          },
        ],
      };

      const status = currentStatus || "NotStarted";
      return actionMap[status] || [];
    },

    getActionColorClass(color) {
      const colorMap = {
        blue: "border-blue-500 bg-blue-50",
        green: "border-green-500 bg-green-50",
        yellow: "border-yellow-500 bg-yellow-50",
      };
      return colorMap[color] || "border-gray-200";
    },

    async init() {
      const isAuthorized = await Auth.requireTransporter();
      if (!isAuthorized) return;

      const urlParams = new URLSearchParams(window.location.search);
      this.batchId = urlParams.get("id");

      if (!this.batchId) {
        this.error = "Không tìm thấy ID lô hàng";
        this.loading = false;
        return;
      }

      await this.loadBatchData();
      await this.getCurrentLocation();
      this.loadSavedTransportInfo();

      if (this.availableActions.length > 0) {
        this.formData.selectedAction = this.availableActions[0].code;
      }

      Auth.updateNavbar();
    },

    loadSavedTransportInfo() {
      const storageKey = `transport_info_${this.batchId}`;
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        try {
          this.savedTransportInfo = JSON.parse(saved);
          const currentStatus =
            this.batchData?.batch?.detailed_transport_status;

          if (
            currentStatus &&
            currentStatus !== "NotStarted" &&
            currentStatus !== "Delivered"
          ) {
            this.formData.fromLocation =
              this.savedTransportInfo.fromLocation ||
              this.formData.fromLocation;
            this.formData.toLocation =
              this.savedTransportInfo.toLocation || this.formData.toLocation;
            this.formData.vehicle =
              this.savedTransportInfo.vehicle || this.formData.vehicle;
            this.formData.licensePlate =
              this.savedTransportInfo.licensePlate ||
              this.formData.licensePlate;
          }
        } catch (e) {
          console.error("Error loading saved transport info:", e);
        }
      }
    },

    saveTransportInfo() {
      const storageKey = `transport_info_${this.batchId}`;
      const transportInfo = {
        fromLocation: this.formData.fromLocation,
        toLocation: this.formData.toLocation,
        vehicle: this.formData.vehicle,
        licensePlate: this.formData.licensePlate,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(storageKey, JSON.stringify(transportInfo));
      this.savedTransportInfo = transportInfo;
    },

    async getCurrentLocation() {
      this.gettingLocation = true;

      try {
        if (!navigator.geolocation) {
          this.currentLocation = null;
          return;
        }

        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });

        const { latitude, longitude } = position.coords;
        this.currentLocation = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        Utils.toast.success("Đã lấy vị trí GPS");
      } catch (error) {
        console.error("Get location error:", error);
        this.currentLocation = null;
      } finally {
        this.gettingLocation = false;
      }
    },

    async loadBatchData() {
      this.loading = true;
      this.error = null;

      try {
        const result = await API.get(
          `/api/transporter/batch/${this.batchId}/details`,
        );

        if (!result.success) {
          throw new Error(result.error || "Lỗi khi tải thông tin lô hàng");
        }

        this.batchData = result.data.data;

        if (!this.batchData.history || !Array.isArray(this.batchData.history)) {
          this.batchData.history = [];
        }

        if (!this.batchData.batch) {
          throw new Error("Không tìm thấy lô hàng");
        }

        this.setDefaultLocations();
      } catch (error) {
        console.error("Load batch data error:", error);
        this.error = error.message || "Lỗi khi tải thông tin lô hàng";
      } finally {
        this.loading = false;
      }
    },

    setDefaultLocations() {
      if (!this.savedTransportInfo) {
        if (this.batchData.transportPhase === "transport1") {
          this.formData.fromLocation =
            this.batchData.batch.purchaser_address || "Nơi thu mua";
          this.formData.toLocation = "Nhà máy sản xuất";
        } else if (this.batchData.transportPhase === "transport2") {
          this.formData.fromLocation = "Nhà máy sản xuất";
          this.formData.toLocation = "Kho bãi";
        }
      }
    },

    async handleImages(event) {
      const files = Array.from(event.target.files);
      const validation = Utils.validateFiles(files);

      if (!validation.valid) {
        Utils.toast.error(validation.error);
        event.target.value = "";
        return;
      }

      this.formData.images = files;

      const container = document.getElementById("imagePreview");
      container.innerHTML = "";

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
        container.appendChild(div);
      }
    },

    getSelectedActionDetails() {
      return this.availableActions.find(
        (a) => a.code === this.formData.selectedAction,
      );
    },

    formatDateTimeVN(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },

    async submitUpdate() {
      // Validate required fields
      if (
        !this.formData.fromLocation ||
        !this.formData.toLocation ||
        !this.formData.vehicle ||
        !this.formData.licensePlate
      ) {
        Utils.toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
        return;
      }

      if (this.formData.selectedAction === null) {
        Utils.toast.error("Vui lòng chọn hành động");
        return;
      }

      const actionDetails = this.getSelectedActionDetails();
      if (!actionDetails) {
        Utils.toast.error("Hành động không hợp lệ");
        return;
      }

      const currentTime = this.formatDateTimeVN(new Date());

      const confirmed = await Swal.fire({
        title: "Xác nhận cập nhật",
        html: `
          <div class="text-left">
            <p class="mb-4">Bạn có chắc muốn cập nhật trạng thái: <strong>${actionDetails.name}</strong>?</p>
            <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Lô hàng:</span>
                <span class="font-semibold">${this.batchData.batch.batch_name}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Từ:</span>
                <span class="font-semibold">${this.formData.fromLocation}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Đến:</span>
                <span class="font-semibold">${this.formData.toLocation}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Phương tiện:</span>
                <span class="font-semibold">${this.formData.vehicle} (${this.formData.licensePlate})</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Thời gian:</span>
                <span class="font-semibold">${currentTime}</span>
              </div>
            </div>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Xác nhận",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#028040",
        cancelButtonColor: "#6b7280",
      });

      if (!confirmed.isConfirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        this.saveTransportInfo();

        const locationData = this.currentLocation
          ? `${this.formData.fromLocation} → ${this.formData.toLocation} [GPS: ${this.currentLocation}]`
          : `${this.formData.fromLocation} → ${this.formData.toLocation}`;

        // ✅ FIX: Đảm bảo payload có đầy đủ và đúng kiểu dữ liệu
        const payload = {
          batchId: parseInt(this.batchId), // ✅ Convert to number
          actionCode: parseInt(actionDetails.code), // ✅ Convert to number
          action: String(actionDetails.name), // ✅ Ensure string
          location: String(locationData), // ✅ Ensure string
          participantType: "Transporter",
        };

        // Add optional fields only if they have values
        if (this.formData.temperature) {
          payload.temperature = parseInt(this.formData.temperature);
        }

        if (this.formData.humidity) {
          payload.humidity = parseInt(this.formData.humidity);
        }

        console.log("=== SENDING PAYLOAD ===");
        console.log(JSON.stringify(payload, null, 2));

        const result = await API.post(
          "/api/transporter/update-status",
          payload,
        );

        console.log("=== API RESPONSE ===");
        console.log(JSON.stringify(result, null, 2));

        Utils.loading.hide();

        if (result.success) {
          const resultTime = this.formatDateTimeVN(new Date());

          await Swal.fire({
            icon: "success",
            title: "Cập nhật thành công!",
            html: `
              <p class="mb-2">Đã cập nhật: <strong>${actionDetails.name}</strong></p>
              <div class="bg-gray-50 rounded-lg p-4 mt-4 text-sm text-left">
                <p class="text-gray-600 mb-2">Thông tin vận chuyển:</p>
                <p><span class="text-gray-600">Lô hàng:</span> <strong>${this.batchData.batch.batch_name}</strong></p>
                <p><span class="text-gray-600">Từ:</span> <strong>${this.formData.fromLocation}</strong></p>
                <p><span class="text-gray-600">Đến:</span> <strong>${this.formData.toLocation}</strong></p>
                <p><span class="text-gray-600">Phương tiện:</span> <strong>${this.formData.vehicle} (${this.formData.licensePlate})</strong></p>
                <p><span class="text-gray-600">Thời gian:</span> <strong>${resultTime}</strong></p>
                ${this.currentLocation ? `<p><span class="text-gray-600">Vị trí GPS:</span> <strong>${this.currentLocation}</strong></p>` : ""}
              </div>
              <p class="text-xs text-gray-500 mt-3">
                <i class="fas fa-check-circle mr-1"></i>
                Đã lưu vào hệ thống
              </p>
            `,
            confirmButtonColor: "#028040",
            confirmButtonText: "OK",
          });

          // Clear storage if completed
          if (actionDetails.code === 3) {
            const storageKey = `transport_info_${this.batchId}`;
            localStorage.removeItem(storageKey);
            window.location.href = "/transporter/index.html";
          } else {
            window.location.reload();
          }
        } else {
          console.error("=== API ERROR ===");
          console.error(result);

          Utils.toast.error(result.error || "Lỗi khi cập nhật trạng thái");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("=== SUBMIT ERROR ===");
        console.error(error);

        Utils.toast.error("Lỗi khi cập nhật trạng thái: " + error.message);
      } finally {
        this.submitting = false;
      }
    },
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});

window.statusUpdate = statusUpdate;
