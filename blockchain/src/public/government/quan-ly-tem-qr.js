/**
 * ========================================
 * QUAN-LY-TEM-QR.JS - Logic Quản Lý Tem QR
 * ========================================
 */

function stampManagement() {
  return {
    activeTab: "generate",
    stamps: [],
    displayStamps: [],
    searchQuery: "",
    filterStatus: "",
    filterLimit: 10,
    loading: false,
    generating: false,
    showStampModal: false,
    selectedStamp: null,

    stampForm: {
      prefix: "SRCA",
      year: "2026",
      quantity: 10,
      startNumber: 1,
    },

    stats: {
      total: 0,
      used: 0,
      available: 0,
    },

    async init() {
      // Kiểm tra quyền truy cập - Yêu cầu ROLE Government (10)
      const hasAccess = await Auth.requireGovernment();
      if (!hasAccess) return;

      // Load dữ liệu
      await this.loadStamps();
      await this.loadStats();
    },

    async loadStamps() {
      this.loading = true;
      try {
        const result = await API.getGovernmentStamps({
          limit: this.filterLimit,
        });

        console.log("📦 API Response:", result);

        if (result.success) {
          // API có thể trả về { success: true, data: [...] }
          // hoặc { success: true, data: { data: [...] } }
          const stampsData = result.data?.data || result.data;

          if (Array.isArray(stampsData)) {
            this.stamps = stampsData;
          } else if (stampsData) {
            console.warn("Data is not array:", stampsData);
            this.stamps = [];
          } else {
            this.stamps = [];
          }

          this.filterStamps();
          console.log(`✅ Loaded ${this.stamps.length} stamps from database`);
        } else {
          // Đảm bảo stamps là array rỗng khi có lỗi
          this.stamps = [];
          this.displayStamps = [];
          console.error("Failed to load stamps:", result.error);
          Utils.toast.error(result.error || "Không thể tải danh sách tem");
        }
      } catch (error) {
        // Đảm bảo stamps là array rỗng khi có exception
        this.stamps = [];
        this.displayStamps = [];
        console.error("Load stamps error:", error);
        Utils.toast.error("Không thể tải danh sách tem");
      } finally {
        this.loading = false;
      }
    },

    async loadStats() {
      try {
        const result = await API.getGovernmentStampsStatistics();
        console.log("📊 Stats API Response:", result);
        console.log("📊 Stats data:", result.data);
        console.log("📊 Stats data.data:", result.data?.data);

        if (result.success && result.data) {
          // API có thể trả về { success: true, data: { data: {...} } } hoặc { success: true, data: {...} }
          const statsData = result.data.data || result.data;

          console.log("📊 Final statsData:", statsData);

          this.stats = {
            total: parseInt(statsData.total) || 0,
            used: parseInt(statsData.used) || 0,
            available: parseInt(statsData.available) || 0,
            expired: parseInt(statsData.expired) || 0,
            revoked: parseInt(statsData.revoked) || 0,
          };

          console.log("✅ Stats loaded:", this.stats);
        } else {
          // Giữ stats mặc định khi có lỗi
          console.error("Failed to load stats:", result.error);
          Utils.toast.warning("Không thể tải thống kê");
        }
      } catch (error) {
        console.error("Load stats error:", error);
        Utils.toast.warning("Không thể tải thống kê");
      }
    },

    filterStamps() {
      try {
        // Đảm bảo stamps là array
        if (!Array.isArray(this.stamps)) {
          this.stamps = [];
          this.displayStamps = [];
          return;
        }

        let filtered = [...this.stamps];

        // Filter by search query
        if (this.searchQuery.trim()) {
          const query = this.searchQuery.toLowerCase();
          filtered = filtered.filter((stamp) =>
            stamp.qr_code.toLowerCase().includes(query),
          );
        }

        // Filter by status
        if (this.filterStatus) {
          filtered = filtered.filter(
            (stamp) => stamp.status === this.filterStatus,
          );
        }

        this.displayStamps = filtered;
      } catch (error) {
        console.error("Filter stamps error:", error);
        this.displayStamps = [];
      }
    },

    applyLimit() {
      this.loadStamps();
    },

    clearFilters() {
      this.searchQuery = "";
      this.filterStatus = "";
      this.filterStamps();
    },

    async reloadStamps() {
      Utils.toast.info("Đang tải lại...");
      await this.loadStamps();
      await this.loadStats();
      Utils.toast.success("Đã làm mới dữ liệu");
    },

    getStatusText(status) {
      const statusMap = {
        AVAILABLE: "Còn trống",
        USED: "Đã sử dụng",
        EXPIRED: "Hết hạn",
        REVOKED: "Đã thu hồi",
      };
      return statusMap[status] || status;
    },

    // Computed methods cho preview
    getPreviewStartCode() {
      const { prefix, year, startNumber } = this.stampForm;
      const start = parseInt(startNumber) || 1;
      return `${prefix}${year}-${String(start).padStart(8, "0")}`;
    },

    getPreviewEndCode() {
      const { prefix, year, startNumber, quantity } = this.stampForm;
      const start = parseInt(startNumber) || 1;
      const qty = parseInt(quantity) || 1;
      const end = start + qty - 1;
      return `${prefix}${year}-${String(end).padStart(8, "0")}`;
    },

    async generateStamps() {
      const { prefix, year, quantity, startNumber } = this.stampForm;

      if (!prefix || !year || !quantity || !startNumber) {
        Utils.toast.error("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      // Chuyển về số để tính toán đúng
      const start = parseInt(startNumber);
      const qty = parseInt(quantity);
      const end = start + qty - 1;

      const confirmed = await Utils.confirm(
        "Xác nhận tạo tem QR",
        `Bạn sắp tạo ${qty} tem QR từ ${prefix}${year}-${String(start).padStart(8, "0")} đến ${prefix}${year}-${String(end).padStart(8, "0")}`,
        "Tạo ngay",
      );

      if (!confirmed) return;

      this.generating = true;
      Utils.loading.show();

      try {
        const result = await API.generateGovernmentStamps({
          prefix,
          year: parseInt(year),
          startNumber: parseInt(startNumber),
          quantity: parseInt(quantity),
          productType: "DURIAN",
          issuedBy: "Bộ Công An",
          batchNumber: `BATCH-${year}-${Date.now()}`,
        });

        Utils.loading.hide();

        if (result.success) {
          await Swal.fire({
            icon: "success",
            title: "Tạo tem thành công!",
            html: `
              <div class="text-left">
                <p class="mb-2">Đã tạo <strong>${qty}</strong> tem QR mới</p>
                <p class="text-sm text-gray-600">Từ: <span class="font-mono">${result.data.firstCode}</span></p>
                <p class="text-sm text-gray-600">Đến: <span class="font-mono">${result.data.lastCode}</span></p>
              </div>
            `,
            confirmButtonColor: "#028040",
          });

          // Update start number for next batch
          this.stampForm.startNumber = start + qty;

          // Reload data
          await this.loadStamps();
          await this.loadStats();

          // Switch to list tab
          this.activeTab = "list";
        } else {
          Utils.toast.error(result.error || "Không thể tạo tem");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("Generate stamps error:", error);
        Utils.toast.error("Lỗi khi tạo tem: " + error.message);
      } finally {
        this.generating = false;
      }
    },

    async downloadStampImage(qrCode) {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = 400;
        canvas.height = 400;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 400, 400);

        ctx.strokeStyle = "#028040";
        ctx.lineWidth = 4;
        ctx.strokeRect(5, 5, 390, 390);

        ctx.fillStyle = "#028040";
        ctx.fillRect(15, 15, 370, 60);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("BỘ CÔNG AN", 200, 40);
        ctx.font = "14px Arial";
        ctx.fillText("TRUY XUẤT NGUỒN GỐC", 200, 60);

        const qrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(qrCanvas, qrCode, {
          width: 200,
          margin: 1,
        });

        ctx.drawImage(qrCanvas, 100, 100, 200, 200);

        ctx.fillStyle = "#000000";
        ctx.font = "bold 16px Arial";
        ctx.fillText("SẦU RIÊNG VIỆT NAM", 200, 330);

        ctx.font = "12px monospace";
        ctx.fillText(`Mã: ${qrCode}`, 200, 355);

        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `QR_Stamp_${qrCode}.png`;
          a.click();
          URL.revokeObjectURL(url);
        });

        Utils.toast.success("Đã tải tem QR");
      } catch (error) {
        console.error("Download error:", error);
        Utils.toast.error("Lỗi khi tải tem");
      }
    },

    async downloadAllStamps() {
      const toDownload = this.displayStamps;

      if (toDownload.length === 0) {
        Utils.toast.error("Không có tem nào để tải!");
        return;
      }

      const confirmed = await Utils.confirm(
        "Xác nhận tải xuống",
        `Bạn sắp tải ${toDownload.length} tem QR. Quá trình có thể mất vài phút.`,
        "Tải xuống",
      );

      if (!confirmed) return;

      Utils.toast.info(`Đang tải ${toDownload.length} tem...`);

      for (let i = 0; i < toDownload.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await this.downloadStampImage(toDownload[i].qr_code);
      }

      Utils.toast.success(`Đã tải ${toDownload.length} tem QR!`);
    },

    async downloadAvailableStamps() {
      const available = this.displayStamps.filter(
        (s) => s.status === "AVAILABLE",
      );

      if (available.length === 0) {
        Utils.toast.error("Không có tem còn trống để tải!");
        return;
      }

      const confirmed = await Utils.confirm(
        "Tải tem còn trống",
        `Bạn sắp tải ${available.length} tem còn trống. Quá trình có thể mất vài phút.`,
        "Tải xuống",
      );

      if (!confirmed) return;

      Utils.toast.info(`Đang tải ${available.length} tem...`);

      for (let i = 0; i < available.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await this.downloadStampImage(available[i].qr_code);
      }

      Utils.toast.success(`Đã tải ${available.length} tem còn trống!`);
    },

    formatDate(dateString) {
      return Utils.formatDate(dateString);
    },

    async viewStampDetails(stamp) {
      this.selectedStamp = stamp;
      this.showStampModal = true;

      console.log("Opening modal for stamp:", stamp);

      // Wait for modal to render
      setTimeout(async () => {
        const container = document.getElementById("qrCodeCanvas");
        if (container) {
          const canvas = document.createElement("canvas");
          try {
            await QRCode.toCanvas(canvas, stamp.qr_code, {
              width: 256,
              margin: 2,
              color: {
                dark: "#000000",
                light: "#FFFFFF",
              },
            });
            container.innerHTML = "";
            container.appendChild(canvas);
            console.log("QR code generated successfully");
          } catch (error) {
            console.error("Error generating QR code:", error);
          }
        } else {
          console.error("QR code container not found");
        }
      }, 100);
    },
  };
}

function logout() {
  Auth.logout();
}
