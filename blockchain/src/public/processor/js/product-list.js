/**
 * ========================================
 * PRODUCT-LIST.JS - Logic Danh Sách Sản Phẩm
 * ========================================
 */

function productList() {
  return {
    products: [],
    loading: true,
    searchQuery: "",
    filterStatus: "",

    stats: {
      total: 0,
      active: 0,
      sold: 0,
      totalWeight: 0,
    },

    /**
     * Filtered products
     */
    get filteredProducts() {
      let filtered = this.products;

      // Filter by status
      if (this.filterStatus === "active") {
        filtered = filtered.filter((p) => p.is_active);
      } else if (this.filterStatus === "sold") {
        filtered = filtered.filter((p) => !p.is_active);
      }

      // Filter by search query
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.product_qr_code?.toLowerCase().includes(query) ||
            p.batch_name?.toLowerCase().includes(query) ||
            p.package_type?.toLowerCase().includes(query),
        );
      }

      return filtered;
    },

    /**
     * Initialize
     */
    async init() {
      const isAuthorized = await Auth.requireProcessor();
      if (!isAuthorized) return;

      await this.loadProducts();
      Auth.updateNavbar();

      // Generate QR codes after products are loaded
      this.$nextTick(() => {
        this.generateAllQRCodes();
      });
    },

    /**
     * Load products
     */
    async loadProducts() {
      this.loading = true;

      try {
        const processorId = Auth.getCurrentUser()?.userId;

        // Get all products from all batches
        const result = await API.get("/api/processor/my-products");

        if (result.success) {
          this.products = result.data.data || [];

          // Calculate stats
          this.calculateStats();

          console.log(`✅ Loaded ${this.products.length} products`);
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải danh sách");
        }
      } catch (error) {
        console.error("Load products error:", error);
        Utils.toast.error("Lỗi khi tải danh sách: " + error.message);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Calculate statistics
     */
    calculateStats() {
      this.stats = {
        total: this.products.length,
        active: this.products.filter((p) => p.is_active).length,
        sold: this.products.filter((p) => !p.is_active).length,
        totalWeight:
          this.products.reduce((sum, p) => sum + (p.weight || 0), 0) / 1000,
      };
    },

    /**
     * Generate all QR codes
     */
    generateAllQRCodes() {
      this.filteredProducts.forEach((product) => {
        this.generateQRCode(product);
      });
    },

    /**
     * Generate QR code for a product
     */
    generateQRCode(product) {
      const canvasId = `qr-${product.product_id}`;
      const canvas = document.getElementById(canvasId);

      if (!canvas) {
        console.warn(`Canvas ${canvasId} not found`);
        return;
      }

      // QR code data - URL to trace page
      const traceUrl = `${window.location.origin}/tieu-dung/truyxuatnguongoc.html?qr=${product.product_qr_code}`;

      QRCode.toCanvas(
        canvas,
        traceUrl,
        {
          width: 192,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        function (error) {
          if (error) {
            console.error(
              `Error generating QR for ${product.product_qr_code}:`,
              error,
            );
          }
        },
      );
    },

    /**
     * Download QR code
     */
    async downloadQR(product) {
      const canvasId = `qr-${product.product_id}`;
      const canvas = document.getElementById(canvasId);

      if (!canvas) {
        Utils.toast.error("Không tìm thấy mã QR");
        return;
      }

      try {
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `QR_${product.product_qr_code}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          Utils.toast.success("Đã tải mã QR");
        });
      } catch (error) {
        console.error("Download QR error:", error);
        Utils.toast.error("Lỗi khi tải mã QR");
      }
    },

    /**
     * View product details
     */
    async viewProduct(product) {
      Utils.loading.show();

      try {
        // Get product details including source trees
        const result = await API.get(
          `/api/processor/product/${product.product_id}/details`,
        );

        Utils.loading.hide();

        if (result.success) {
          const details = result.data.data;

          await Swal.fire({
            title: "Chi Tiết Sản Phẩm",
            html: `
              <div class="text-left space-y-4">
                <!-- QR Code -->
                <div class="flex justify-center mb-4">
                  <div class="qr-container" id="modal-qr-container"></div>
                </div>

                <!-- Basic Info -->
                <div class="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Mã QR:</span>
                    <span class="font-semibold font-mono">${product.product_qr_code}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Khối lượng:</span>
                    <span class="font-semibold">${(product.weight / 1000).toFixed(2)} kg</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Bao bì:</span>
                    <span class="font-semibold">${product.package_type}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Trạng thái:</span>
                    <span class="font-semibold ${product.is_active ? "text-green-600" : "text-gray-600"}">
                      ${product.is_active ? "Đang bán" : "Đã bán"}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Ngày đóng gói:</span>
                    <span class="font-semibold">${Utils.formatDate(product.packaged_date_iso)}</span>
                  </div>
                </div>

                <!-- Batch Info -->
                ${
                  details.batch
                    ? `
                  <div>
                    <h4 class="font-semibold mb-2">Thông tin lô hàng:</h4>
                    <div class="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
                      <div class="flex justify-between">
                        <span class="text-gray-600">Tên lô:</span>
                        <span class="font-semibold">${details.batch.batch_name}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">SSCC:</span>
                        <span class="font-mono text-xs">${details.batch.sscc}</span>
                      </div>
                    </div>
                  </div>
                `
                    : ""
                }

                <!-- Source Trees -->
                ${
                  details.sourceTrees && details.sourceTrees.length > 0
                    ? `
                  <div>
                    <h4 class="font-semibold mb-2">Cây nguồn gốc:</h4>
                    <div class="bg-green-50 p-4 rounded-lg space-y-2 text-sm">
                      ${details.sourceTrees
                        .map(
                          (tree) => `
                        <div class="border-b pb-2">
                          <div class="font-semibold">${tree.tree_qr_code}</div>
                          <div class="text-gray-600 text-xs">${tree.tree_type} - ${tree.variety}</div>
                          <div class="text-gray-500 text-xs">Trồng: ${Utils.formatDate(tree.planted_date_iso)}</div>
                        </div>
                      `,
                        )
                        .join("")}
                    </div>
                  </div>
                `
                    : ""
                }

                <!-- Trace URL -->
                <div>
                  <h4 class="font-semibold mb-2">Link truy xuất nguồn gốc:</h4>
                  <div class="bg-gray-100 p-3 rounded text-xs break-all">
                    ${window.location.origin}/tieu-dung/truyxuatnguongoc.html?qr=${product.product_qr_code}
                  </div>
                </div>
              </div>
            `,
            width: 700,
            confirmButtonColor: "#028040",
            confirmButtonText: "Đóng",
            didOpen: () => {
              // Generate QR in modal
              const container = document.getElementById("modal-qr-container");
              const canvas = document.createElement("canvas");
              container.appendChild(canvas);

              const traceUrl = `${window.location.origin}/tieu-dung/truyxuatnguongoc.html?qr=${product.product_qr_code}`;

              QRCode.toCanvas(canvas, traceUrl, {
                width: 200,
                margin: 1,
              });
            },
          });
        } else {
          Utils.toast.error(result.error || "Lỗi khi tải chi tiết");
        }
      } catch (error) {
        Utils.loading.hide();
        console.error("View product error:", error);
        Utils.toast.error("Lỗi khi tải chi tiết: " + error.message);
      }
    },
  };
}

/**
 * Initialize auth
 */
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.init();
});
