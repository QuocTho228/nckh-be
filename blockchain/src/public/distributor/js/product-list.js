/**
 * ========================================
 * PRODUCT-LIST.JS - Danh sách sản phẩm có sẵn (FIXED)
 * ========================================
 */

function productListData() {
  return {
    products: [],
    filteredProducts: [],
    loading: true,
    searchQuery: "",
    filterBatch: "",

    get uniqueBatches() {
      const batches = {};
      this.products.forEach((p) => {
        if (p.batch_id && !batches[p.batch_id]) {
          batches[p.batch_id] = {
            batch_id: p.batch_id,
            batch_name: p.batch_name,
          };
        }
      });
      return Object.values(batches);
    },

    async init() {
      // Kiểm tra auth
      const isAuthorized = await Auth.requireDistributor();
      if (!isAuthorized) return;

      // Load products
      await this.loadProducts();
    },

    async loadProducts() {
      this.loading = true;

      try {
        const result = await API.getDistributorAvailableProducts();
        console.log("Available products result:", result);

        if (result.success) {
          // ✅ FIX: Xử lý cấu trúc data linh hoạt
          let productsData = [];

          if (Array.isArray(result.data)) {
            // Nếu data là array trực tiếp
            productsData = result.data;
          } else if (result.data && typeof result.data === "object") {
            // Nếu data là object chứa array
            // Backend trả về: { success: true, count: X, data: [...] }
            // hoặc: { success: true, data: { productCount: X, products: [...] } }
            productsData =
              result.data.products ||
              result.data.items ||
              result.data.data ||
              [];
          }

          console.log("Processed products data:", productsData);

          // Ensure productsData is array
          if (Array.isArray(productsData)) {
            this.products = productsData;
            this.filteredProducts = [...this.products];

            // Sort by packaged date (newest first)
            this.filteredProducts.sort((a, b) => {
              if (!a.packaged_date_iso || !b.packaged_date_iso) return 0;
              const dateA = new Date(a.packaged_date_iso);
              const dateB = new Date(b.packaged_date_iso);
              return dateB - dateA;
            });

            console.log("Final products array:", this.products);

            if (this.products.length === 0) {
              Utils.toast.info("Chưa có sản phẩm nào");
            } else {
              Utils.toast.success(`Đã tải ${this.products.length} sản phẩm`);
            }
          } else {
            console.warn("Products data is not an array:", productsData);
            this.products = [];
            this.filteredProducts = [];
            Utils.toast.warning("Không có dữ liệu sản phẩm");
          }
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách sản phẩm");
          this.products = [];
          this.filteredProducts = [];
        }
      } catch (error) {
        console.error("Load products error:", error);
        Utils.toast.error("Lỗi khi tải danh sách sản phẩm");
        this.products = [];
        this.filteredProducts = [];
      } finally {
        this.loading = false;
      }
    },

    filterProducts() {
      let filtered = [...this.products];

      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter((p) => {
          return (
            (p.product_qr_code &&
              p.product_qr_code.toLowerCase().includes(query)) ||
            (p.batch_name && p.batch_name.toLowerCase().includes(query)) ||
            (p.sscc && p.sscc.toLowerCase().includes(query)) ||
            (p.product_name && p.product_name.toLowerCase().includes(query)) ||
            (p.farmer_name && p.farmer_name.toLowerCase().includes(query))
          );
        });
      }

      // Filter by batch
      if (this.filterBatch) {
        filtered = filtered.filter((p) => p.batch_id == this.filterBatch);
      }

      this.filteredProducts = filtered;
    },

    async quickSell(product) {
      const confirmed = await Utils.confirm(
        "Xác nhận bán hàng",
        `Bạn muốn đánh dấu sản phẩm <strong>${product.product_qr_code}</strong> đã bán?`,
        "Xác nhận bán",
      );

      if (!confirmed) return;

      Utils.loading.show();

      try {
        // ✅ FIX: Đảm bảo field name đúng
        const result = await API.markProductSold({
          productQRCode: product.product_qr_code, // Chú ý: QRCode viết hoa
          notes: "Bán trực tiếp từ danh sách",
        });

        console.log("Mark sold result:", result);

        if (result.success) {
          Utils.toast.success("Đã đánh dấu sản phẩm đã bán");

          // Remove from list
          this.products = this.products.filter(
            (p) => p.product_id !== product.product_id,
          );
          this.filterProducts();

          // Show success info
          await Swal.fire({
            title: "Thành công!",
            html: `
              <div class="text-left">
                <p><strong>Sản phẩm:</strong> ${product.product_qr_code}</p>
                <p><strong>Lô hàng:</strong> ${product.batch_name}</p>
                <p><strong>Trạng thái:</strong> Đã bán</p>
              </div>
            `,
            icon: "success",
            confirmButtonText: "OK",
          });
        } else {
          Utils.toast.error(result.error || "Lỗi khi đánh dấu sản phẩm");
        }
      } catch (error) {
        console.error("Quick sell error:", error);
        Utils.toast.error("Lỗi khi đánh dấu sản phẩm");
      } finally {
        Utils.loading.hide();
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
