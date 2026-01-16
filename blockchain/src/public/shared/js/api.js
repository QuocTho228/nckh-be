/**
 * ========================================
 * API.JS - Axios API Client
 * ========================================
 */
const API = {
  /**
   * Configure axios với base URL và credentials
   */
  client: axios.create({
    baseURL: CONFIG.API_BASE_URL,
    withCredentials: true, // Gửi cookie tự động
    headers: {
      "Content-Type": "application/json",
    },
  }),

  /**
   * Setup interceptors
   */
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Có thể thêm loading state ở đây
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response) {
          // Server trả về error
          const { status, data } = error.response;

          if (status === 401) {
            // Unauthorized - chuyển về login
            Utils.toast.error("Phiên đăng nhập hết hạn");
            setTimeout(() => {
              window.location.href = "/account/dangnhap.html";
            }, 1500);
          } else if (status === 403) {
            // Forbidden
            Utils.toast.error(
              data.error || "Bạn không có quyền thực hiện thao tác này"
            );
          } else if (status >= 500) {
            // Server error
            Utils.toast.error("Lỗi server, vui lòng thử lại sau");
          }
        } else if (error.request) {
          // Request được gửi nhưng không nhận được response
          Utils.toast.error("Không thể kết nối đến server");
        }

        return Promise.reject(error);
      }
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
              (progressEvent.loaded * 100) / progressEvent.total
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

  /**
   * Lấy danh sách cây của nông dân
   */
  async getMyTrees() {
    return this.get(CONFIG.API.FARMER_TREES);
  },

  /**
   * Đăng ký cây mới
   */
  async registerTree(data) {
    return this.post(CONFIG.API.REGISTER_TREE, data);
  },

  /**
   * Thêm nhật ký chăm sóc cây
   */
  async addTreeCare(formData) {
    return this.upload(CONFIG.API.ADD_TREE_CARE, formData);
  },

  /**
   * Lấy danh sách lô hàng
   */
  async getMyBatches(status = null) {
    const params = status ? { status } : {};
    return this.get(CONFIG.API.FARMER_BATCHES, params);
  },

  /**
   * Tạo lô hàng mới
   */
  async createBatch(formData) {
    return this.upload(CONFIG.API.CREATE_BATCH, formData);
  },

  // === INSPECTOR APIs ===

  /**
   * Lấy thống kê inspector
   */
  async getInspectorStats() {
    return this.get(CONFIG.API.INSPECTOR_STATS);
  },

  /**
   * Lấy danh sách lô chờ duyệt
   */
  async getPendingBatches() {
    return this.get(CONFIG.API.INSPECTOR_PENDING_BATCHES);
  },

  /**
   * Lấy thông tin đầy đủ của lô hàng
   */
  async getBatchFullInfo(batchId) {
    const url = CONFIG.API.INSPECTOR_BATCH_FULL_INFO.replace(":id", batchId);
    return this.get(url);
  },

  /**
   * Lấy lịch sử phê duyệt của inspector
   */
  async getMyApprovals(status = null) {
    const params = status ? { status } : {};
    return this.get(CONFIG.API.INSPECTOR_MY_APPROVALS, params);
  },

  /**
   * Phê duyệt lô hàng
   */
  async approveBatch(batchId) {
    const url = CONFIG.API.INSPECTOR_APPROVE_BATCH.replace(":id", batchId);
    return this.post(url);
  },

  /**
   * Từ chối lô hàng
   */
  async rejectBatch(batchId, reason) {
    const url = CONFIG.API.INSPECTOR_REJECT_BATCH.replace(":id", batchId);
    return this.post(url, { reason });
  },

  // === PURCHASER APIs ===

  /**
   * Lấy thống kê purchaser
   */
  async getPurchaserStats() {
    return this.get(CONFIG.API.PURCHASER_STATS);
  },

  /**
   * Lấy danh sách lô đã duyệt
   */
  async getApprovedBatches() {
    return this.get(CONFIG.API.PURCHASER_APPROVED_BATCHES);
  },

  /**
   * Lấy chi tiết lô hàng
   */
  async getBatchDetailsForPurchase(batchId) {
    const url = CONFIG.API.PURCHASER_BATCH_DETAILS.replace(":id", batchId);
    return this.get(url);
  },

  /**
   * Lấy lịch sử mua hàng
   */
  async getMyPurchases() {
    return this.get(CONFIG.API.PURCHASER_MY_PURCHASES);
  },

  /**
   * Ghi nhận mua hàng
   */
  async recordPurchase(formData) {
    return this.upload(CONFIG.API.PURCHASER_RECORD_PURCHASE, formData);
  },

  /**
   * Lấy ảnh của purchase
   */
  async getPurchaseImages(purchaseId) {
    const url = CONFIG.API.PURCHASER_PURCHASE_IMAGES.replace(":id", purchaseId);
    return this.get(url);
  },

  // === MASTER DATA APIs ===

  /**
   * Lấy danh sách sản phẩm
   */
  async getProducts() {
    return this.get(CONFIG.API.PRODUCTS);
  },

  /**
   * Lấy danh sách vùng
   */
  async getRegions() {
    return this.get(CONFIG.API.REGIONS);
  },

  // === AUTH APIs ===

  /**
   * Lấy thông tin user hiện tại
   */
  async getUserInfo() {
    return this.get(CONFIG.API.USER_INFO);
  },

  /**
   * Đăng xuất
   */
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
