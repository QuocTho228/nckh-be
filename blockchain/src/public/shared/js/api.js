/**
 * ========================================
 * API.JS - Axios API Client (Updated)
 * ========================================
 */
const API = {
  /**
   * Configure axios với base URL và credentials
   */
  client: axios.create({
    baseURL: CONFIG.API_BASE_URL,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
    },
  }),

  /**
   * Setup interceptors
   */
  setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, data } = error.response;

          if (status === 401) {
            Utils.toast.error("Phiên đăng nhập hết hạn");
            setTimeout(() => {
              window.location.href = "/account/dangnhap.html";
            }, 1500);
          } else if (status === 403) {
            Utils.toast.error(
              data.error || "Bạn không có quyền thực hiện thao tác này",
            );
          } else if (status >= 500) {
            Utils.toast.error("Lỗi server, vui lòng thử lại sau");
          }
        } else if (error.request) {
          Utils.toast.error("Không thể kết nối đến server");
        }

        return Promise.reject(error);
      },
    );
  },

  /**
   * GET request
   */
  async get(url, params = {}) {
    try {
      const response = await this.client.get(url, { params });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * POST request
   */
  async post(url, data = {}) {
    try {
      const response = await this.client.post(url, data);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * PUT request
   */
  async put(url, data = {}) {
    try {
      const response = await this.client.put(url, data);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * DELETE request
   */
  async delete(url) {
    try {
      const response = await this.client.delete(url);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Upload file với FormData
   */
  async upload(url, formData, onProgress = null) {
    try {
      const response = await this.client.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            onProgress(percentCompleted);
          }
        },
      });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  // === FARMER APIs ===

  async getMyTrees() {
    return this.get(CONFIG.API.FARMER_TREES);
  },

  async registerTree(data) {
    return this.post(CONFIG.API.REGISTER_TREE, data);
  },

  async addTreeCare(formData) {
    return this.upload(CONFIG.API.ADD_TREE_CARE, formData);
  },

  async getMyBatches(status = null) {
    const params = status ? { status } : {};
    return this.get(CONFIG.API.FARMER_BATCHES, params);
  },

  async createBatch(formData) {
    return this.upload(CONFIG.API.CREATE_BATCH, formData);
  },

  // === INSPECTOR APIs ===

  async getInspectorStats() {
    return this.get(CONFIG.API.INSPECTOR_STATS);
  },

  async getPendingBatches() {
    return this.get(CONFIG.API.INSPECTOR_PENDING_BATCHES);
  },

  async getBatchFullInfo(batchId) {
    const url = CONFIG.API.INSPECTOR_BATCH_FULL_INFO.replace(":id", batchId);
    return this.get(url);
  },

  async getMyApprovals(status = null) {
    const params = status ? { status } : {};
    return this.get(CONFIG.API.INSPECTOR_MY_APPROVALS, params);
  },

  async approveBatch(batchId) {
    const url = CONFIG.API.INSPECTOR_APPROVE_BATCH.replace(":id", batchId);
    return this.post(url);
  },

  async rejectBatch(batchId, reason) {
    const url = CONFIG.API.INSPECTOR_REJECT_BATCH.replace(":id", batchId);
    return this.post(url, { reason });
  },

  // === PURCHASER APIs ===

  async getPurchaserStats() {
    return this.get(CONFIG.API.PURCHASER_STATS);
  },

  async getApprovedBatches() {
    return this.get(CONFIG.API.PURCHASER_APPROVED_BATCHES);
  },

  async getBatchDetailsForPurchase(batchId) {
    const url = CONFIG.API.PURCHASER_BATCH_DETAILS.replace(":id", batchId);
    return this.get(url);
  },

  async getMyPurchases() {
    return this.get(CONFIG.API.PURCHASER_MY_PURCHASES);
  },

  async recordPurchase(formData) {
    return this.upload(CONFIG.API.PURCHASER_RECORD_PURCHASE, formData);
  },

  async getPurchaseImages(purchaseId) {
    const url = CONFIG.API.PURCHASER_PURCHASE_IMAGES.replace(":id", purchaseId);
    return this.get(url);
  },

  // === TRANSPORTER APIs ===

  async getTransporterStats() {
    return this.get(CONFIG.API.TRANSPORTER_STATS);
  },

  async getBatchesToTransport() {
    return this.get(CONFIG.API.TRANSPORTER_BATCHES);
  },

  async getBatchDetailsForTransport(batchId) {
    const url = CONFIG.API.TRANSPORTER_BATCH_DETAILS.replace(":id", batchId);
    return this.get(url);
  },

  async getBatchCurrentStatus(batchId) {
    const url = CONFIG.API.TRANSPORTER_CURRENT_STATUS.replace(":id", batchId);
    return this.get(url);
  },

  async updateTransportStatus(formData) {
    return this.upload(CONFIG.API.TRANSPORTER_UPDATE_STATUS, formData);
  },

  // === PROCESSOR APIs ===

  async getProcessorStats() {
    return this.get(CONFIG.API.PROCESSOR_STATS);
  },

  async getPendingProcessingBatches() {
    return this.get(CONFIG.API.PROCESSOR_PENDING_BATCHES);
  },

  async getBatchProcessingDetails(batchId) {
    const url = CONFIG.API.PROCESSOR_BATCH_DETAILS.replace(":id", batchId);
    return this.get(url);
  },

  async getBatchTrees(batchId) {
    const url = CONFIG.API.PROCESSOR_BATCH_TREES.replace(":id", batchId);
    return this.get(url);
  },

  async recordProcessing(formData) {
    return this.upload(CONFIG.API.PROCESSOR_RECORD_PROCESSING, formData);
  },

  async createProducts(data) {
    return this.post(CONFIG.API.PROCESSOR_CREATE_PRODUCTS, data);
  },

  async getMyProcessedBatches() {
    return this.get(CONFIG.API.PROCESSOR_MY_BATCHES);
  },

  async getProductsByBatch(batchId) {
    const url = CONFIG.API.PROCESSOR_PRODUCTS_BY_BATCH.replace(":id", batchId);
    return this.get(url);
  },

  async getMyProducts() {
    return this.get(CONFIG.API.PROCESSOR_MY_PRODUCTS);
  },

  async getProductDetails(productId) {
    const url = CONFIG.API.PROCESSOR_PRODUCT_DETAILS.replace(":id", productId);
    return this.get(url);
  },

  // === GOVERNMENT STAMPS APIs ===

  /**
   * Tạo tem QR hàng loạt
   */
  async generateGovernmentStamps(data) {
    return this.post(CONFIG.API.STAMPS_GENERATE, data);
  },

  /**
   * Lấy danh sách tem QR
   */
  async getGovernmentStamps(params = {}) {
    return this.get(CONFIG.API.STAMPS_LIST, params);
  },

  /**
   * Validate tem QR
   */
  async validateGovernmentStamp(qrCode) {
    return this.post(CONFIG.API.STAMPS_VALIDATE, { qrCode });
  },

  /**
   * Lấy thống kê tem QR
   */
  async getGovernmentStampsStatistics() {
    return this.get(CONFIG.API.STAMPS_STATISTICS);
  },

  /**
   * Lấy chi tiết tem QR
   */
  async getGovernmentStampDetails(qrCode) {
    const url = CONFIG.API.STAMPS_DETAILS.replace(":qrCode", qrCode);
    return this.get(url);
  },

  // === QUALITY INSPECTOR APIs ===

  /**
   * Lấy thống kê cho Quality Inspector
   */
  async getQualityInspectorStats() {
    return this.get(CONFIG.API.QUALITY_INSPECTOR_STATS);
  },

  /**
   * Lấy danh sách lô cần kiểm nghiệm (đã sơ chế xong)
   */
  async getQualityInspectorPendingBatches() {
    return this.get(CONFIG.API.QUALITY_INSPECTOR_PENDING_BATCHES);
  },

  /**
   * Lấy danh sách các test đã thực hiện
   */
  async getQualityInspectorMyTests() {
    return this.get(CONFIG.API.QUALITY_INSPECTOR_MY_TESTS);
  },

  /**
   * Ghi nhận kết quả kiểm nghiệm
   */
  async recordQualityTest(formData) {
    return this.upload(CONFIG.API.QUALITY_INSPECTOR_RECORD_TEST, formData);
  },

  /**
   * Lấy thông tin sơ chế của lô hàng
   */
  async getQualityInspectorBatchProcessingInfo(batchId) {
    const url = CONFIG.API.QUALITY_INSPECTOR_BATCH_PROCESSING_INFO.replace(
      ":id",
      batchId,
    );
    return this.get(url);
  },

  /**
   * Lấy ảnh của test
   */
  async getQualityInspectorTestImages(testId) {
    const url = CONFIG.API.QUALITY_INSPECTOR_TEST_IMAGES.replace(":id", testId);
    return this.get(url);
  },

  // === QUALITY INSPECTOR APIs ===

  /**
   * Lấy thống kê cho Quality Inspector
   */
  async getQualityInspectorStats() {
    return this.get(CONFIG.API.QUALITY_INSPECTOR_STATS);
  },

  /**
   * Lấy danh sách lô cần kiểm nghiệm (đã sơ chế xong)
   */
  async getQualityInspectorPendingBatches() {
    return this.get(CONFIG.API.QUALITY_INSPECTOR_PENDING_BATCHES);
  },

  /**
   * Lấy danh sách các test đã thực hiện
   */
  async getQualityInspectorMyTests() {
    return this.get(CONFIG.API.QUALITY_INSPECTOR_MY_TESTS);
  },

  /**
   * Ghi nhận kết quả kiểm nghiệm
   */
  async recordQualityTest(formData) {
    return this.upload(CONFIG.API.QUALITY_INSPECTOR_RECORD_TEST, formData);
  },

  /**
   * Lấy thông tin sơ chế của lô hàng
   */
  async getQualityInspectorBatchProcessingInfo(batchId) {
    const url = CONFIG.API.QUALITY_INSPECTOR_BATCH_PROCESSING_INFO.replace(
      ":id",
      batchId,
    );
    return this.get(url);
  },

  /**
   * Lấy ảnh của test
   */
  async getQualityInspectorTestImages(testId) {
    const url = CONFIG.API.QUALITY_INSPECTOR_TEST_IMAGES.replace(":id", testId);
    return this.get(url);
  },

  // === WAREHOUSE APIs ===

  /**
   * Lấy thống kê cho Warehouse
   */
  async getWarehouseStats() {
    return this.get(CONFIG.API.WAREHOUSE_STATS);
  },

  /**
   * Lấy danh sách lô đang trên đường đến kho
   */
  async getWarehouseIncomingBatches() {
    return this.get(CONFIG.API.WAREHOUSE_INCOMING_BATCHES);
  },

  /**
   * Lấy hàng tồn kho
   */
  async getWarehouseMyInventory() {
    return this.get(CONFIG.API.WAREHOUSE_MY_INVENTORY);
  },

  /**
   * Xác nhận nhận hàng
   */
  async confirmWarehouseReceipt(batchId) {
    return this.post(CONFIG.API.WAREHOUSE_CONFIRM_RECEIPT, { batchId });
  },

  /**
   * Lấy thông tin vận chuyển của lô
   */
  async getWarehouseBatchTransportInfo(batchId) {
    try {
      const url = CONFIG.API.WAREHOUSE_BATCH_TRANSPORT_INFO.replace(
        ":id",
        batchId,
      );

      // ✅ Gọi trực tiếp this.client.get() thay vì this.get()
      // Để tránh wrap thêm layer { success: true, data: ... }
      const response = await this.client.get(url);

      // response.data đã là: { success: true, data: { batch, transportHistory } }
      return response.data;
    } catch (error) {
      console.error("[API] Get warehouse batch transport info error:", error);

      if (error.response && error.response.data) {
        // Server trả về error response
        return error.response.data;
      }

      // Network error
      return {
        success: false,
        error: error.message || "Lỗi kết nối API",
      };
    }
  },

  /**
   * Lấy sản phẩm có sẵn trong kho
   */
  async getWarehouseProductsAvailable() {
    return this.get(CONFIG.API.WAREHOUSE_PRODUCTS_AVAILABLE);
  },

  // === MASTER DATA APIs ===

  async getProducts() {
    return this.get(CONFIG.API.PRODUCTS);
  },

  async getRegions() {
    return this.get(CONFIG.API.REGIONS);
  },

  // === AUTH APIs ===

  async getUserInfo() {
    return this.get(CONFIG.API.USER_INFO);
  },

  async logout() {
    return this.post(CONFIG.API.LOGOUT);
  },
};

// Setup interceptors khi load
API.setupInterceptors();

// Export for browser
if (typeof window !== "undefined") {
  window.API = API;
}
