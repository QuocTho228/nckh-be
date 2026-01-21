/**
 * ========================================
 * SCAN-SELL.JS - Scan QR để bán hàng (FIXED)
 * ========================================
 */

function scanSellData() {
  return {
    qrCode: "",
    scannedProduct: null,
    loading: false,
    submitting: false,
    recentScans: [],

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireDistributor();
      if (!isAuthorized) return;

      // Focus vào input
      this.$nextTick(() => {
        const input = document.querySelector('input[x-model="qrCode"]');
        if (input) input.focus();
      });

      // Load recent scans from sessionStorage
      this.loadRecentScans();
    },

    async scanProduct() {
      if (!this.qrCode.trim()) {
        Utils.toast.error("Vui lòng nhập mã QR sản phẩm");
        return;
      }

      this.loading = true;

      try {
        // Call API to get product info
        const result = await API.getProductFullInfo(this.qrCode.trim());
        console.log("Scan result:", result);

        if (result.success && result.data && result.data.product) {
          this.scannedProduct = result.data.product;

          // Check if product is available
          if (!this.scannedProduct.is_active) {
            Utils.toast.error("Sản phẩm này đã được bán");
            this.resetScan();
            return;
          }

          Utils.toast.success("Đã tìm thấy sản phẩm");
        } else {
          Utils.toast.error(result.error || "Không tìm thấy sản phẩm");
          this.qrCode = "";
        }
      } catch (error) {
        console.error("Scan product error:", error);
        Utils.toast.error("Lỗi khi tìm sản phẩm");
        this.qrCode = "";
      } finally {
        this.loading = false;
      }
    },

    async confirmSale() {
      if (!this.scannedProduct) return;

      const confirmed = await Utils.confirm(
        "Xác nhận bán hàng",
        `Bạn xác nhận bán sản phẩm <strong>${this.scannedProduct.product_qr_code}</strong>?`,
        "Xác nhận bán",
      );

      if (!confirmed) return;

      this.submitting = true;
      Utils.loading.show();

      try {
        // ✅ FIX: Backend expect "productQRCode" (viết hoa QRC), không phải "productQrCode"
        const payload = {
          productQRCode: this.scannedProduct.product_qr_code,
          notes: "Bán qua scan QR",
        };

        console.log("Marking product sold with payload:", payload);

        const result = await API.markProductSold(payload);

        console.log("Mark sold result:", result);

        if (result.success) {
          Utils.toast.success("Đã đánh dấu sản phẩm đã bán");

          // Add to recent scans
          this.addToRecentScans(this.scannedProduct.product_qr_code);

          // Show success
          await Swal.fire({
            title: "Bán hàng thành công!",
            html: `
              <div class="text-left">
                <p><strong>Sản phẩm:</strong> ${this.scannedProduct.product_qr_code}</p>
                <p><strong>Lô hàng:</strong> ${this.scannedProduct.batch_name}</p>
                <p><strong>Thời gian:</strong> ${Utils.formatDateTime(new Date().toISOString())}</p>
              </div>
            `,
            icon: "success",
            confirmButtonText: "Bán tiếp",
            showCancelButton: true,
            cancelButtonText: "Xem lịch sử",
          }).then((result) => {
            if (result.isDismissed) {
              window.location.href = "/distributor/lich-su-ban.html";
            }
          });

          // Reset for next scan
          this.resetScan();

          // Focus back to input
          this.$nextTick(() => {
            const input = document.querySelector('input[x-model="qrCode"]');
            if (input) input.focus();
          });
        } else {
          Utils.toast.error(result.error || "Lỗi khi đánh dấu sản phẩm");
        }
      } catch (error) {
        console.error("Confirm sale error:", error);
        Utils.toast.error("Lỗi khi xử lý bán hàng");
      } finally {
        this.submitting = false;
        Utils.loading.hide();
      }
    },

    resetScan() {
      this.qrCode = "";
      this.scannedProduct = null;
    },

    addToRecentScans(qrCode) {
      const scan = {
        qrCode: qrCode,
        timestamp: Utils.formatDateTime(new Date().toISOString()),
      };

      this.recentScans.unshift(scan);

      // Keep only last 5
      if (this.recentScans.length > 5) {
        this.recentScans = this.recentScans.slice(0, 5);
      }

      // Save to sessionStorage
      this.saveRecentScans();
    },

    loadRecentScans() {
      try {
        const saved = sessionStorage.getItem("recentScans");
        if (saved) {
          this.recentScans = JSON.parse(saved);
        }
      } catch (error) {
        console.error("Load recent scans error:", error);
      }
    },

    saveRecentScans() {
      try {
        sessionStorage.setItem("recentScans", JSON.stringify(this.recentScans));
      } catch (error) {
        console.error("Save recent scans error:", error);
      }
    },
  };
}

/**
 * Initialize auth khi page load
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
