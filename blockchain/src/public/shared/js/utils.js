/**
 * ========================================
 * UTILS.JS - Utility Functions (FIXED TIMEZONE)
 * ========================================
 */

const Utils = {
  /**
   * Hiển thị toast thông báo với SweetAlert2
   */
  toast: {
    success: (message) => {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    },

    error: (message) => {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: message,
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
      });
    },

    warning: (message) => {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    },

    info: (message) => {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "info",
        title: message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    },
  },

  /**
   * Hiển thị confirm dialog
   */
  confirm: async (title, text, confirmText = "Xác nhận") => {
    const result = await Swal.fire({
      title: title,
      html: text,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: "Hủy",
      confirmButtonColor: "#028040",
      cancelButtonColor: "#d33",
    });
    return result.isConfirmed;
  },

  /**
   * Format date
   */
  formatDate: (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  },

  /**
   * Format datetime - FIXED để hiển thị đúng múi giờ Việt Nam
   */
  formatDateTime: (dateString) => {
    if (!dateString) return "";

    try {
      // Parse date string
      const date = new Date(dateString);

      // Kiểm tra valid date
      if (isNaN(date.getTime())) return "";

      // ✅ FIX: Chuyển sang múi giờ Việt Nam (UTC+7)
      // Nếu dateString đã có timezone, giữ nguyên
      // Nếu không, coi như UTC và chuyển sang VN time
      const options = {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      };

      // Format theo locale Vietnam
      const formatter = new Intl.DateTimeFormat("vi-VN", options);
      const parts = formatter.formatToParts(date);

      // Extract parts
      const partsMap = {};
      parts.forEach((part) => {
        partsMap[part.type] = part.value;
      });

      // Format: HH:mm DD/MM/YYYY
      return `${partsMap.hour}:${partsMap.minute} ${partsMap.day}/${partsMap.month}/${partsMap.year}`;
    } catch (error) {
      console.error("Format datetime error:", error);
      return "";
    }
  },

  /**
   * Get date in Vietnam timezone (for comparison)
   * Returns YYYY-MM-DD string in Vietnam time
   */
  getVietnamDate: (dateString) => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";

      // Get Vietnam date string
      const vnDateStr = date.toLocaleString("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      // Convert MM/DD/YYYY to YYYY-MM-DD
      const [month, day, year] = vnDateStr.split("/");
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Get Vietnam date error:", error);
      return "";
    }
  },

  /**
   * Get today's date in Vietnam timezone (YYYY-MM-DD)
   */
  getTodayVietnam: () => {
    const now = new Date();
    return Utils.getVietnamDate(now.toISOString());
  },

  /**
   * Format number with thousand separator
   */
  formatNumber: (num) => {
    if (!num && num !== 0) return "";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  },

  /**
   * Validate file
   */
  validateFile: (file) => {
    if (!file) return { valid: false, error: "Chưa chọn file" };

    if (file.size > CONFIG.FILE.MAX_SIZE) {
      return {
        valid: false,
        error: `Kích thước file vượt quá ${
          CONFIG.FILE.MAX_SIZE / 1024 / 1024
        }MB`,
      };
    }

    if (!CONFIG.FILE.ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: "Chỉ chấp nhận file ảnh (JPEG, PNG, WebP)",
      };
    }

    return { valid: true };
  },

  /**
   * Validate multiple files
   */
  validateFiles: (files) => {
    if (!files || files.length === 0) {
      return { valid: false, error: "Chưa chọn file" };
    }

    if (files.length > CONFIG.FILE.MAX_IMAGES) {
      return {
        valid: false,
        error: `Chỉ được tải lên tối đa ${CONFIG.FILE.MAX_IMAGES} ảnh`,
      };
    }

    for (let file of files) {
      const validation = Utils.validateFile(file);
      if (!validation.valid) {
        return validation;
      }
    }

    return { valid: true };
  },

  /**
   * Preview image
   */
  previewImage: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Debounce function
   */
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Get badge class by status
   */
  getStatusBadge: (status) => {
    const badges = {
      PendingApproval: "bg-yellow-100 text-yellow-800",
      Approved: "bg-green-100 text-green-800",
      Rejected: "bg-red-100 text-red-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  },

  /**
   * Get status text in Vietnamese
   */
  getStatusText: (status) => {
    const texts = {
      PendingApproval: "Chờ duyệt",
      Approved: "Đã duyệt",
      Rejected: "Bị từ chối",
    };
    return texts[status] || status;
  },

  /**
   * Get category name
   */
  getCategoryName: (categoryId) => {
    const categories = {
      0: "Quản lý cây",
      1: "Canh tác",
      2: "Thu hoạch",
      3: "Thu mua",
      4: "Vận chuyển",
      5: "Sơ chế",
      6: "Đóng gói",
      7: "Kiểm nghiệm",
      8: "Kho bãi",
      9: "Phân phối",
    };
    return categories[categoryId] || "Khác";
  },

  /**
   * Copy to clipboard
   */
  copyToClipboard: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      Utils.toast.success("Đã sao chép!");
      return true;
    } catch (err) {
      Utils.toast.error("Không thể sao chép");
      return false;
    }
  },

  /**
   * Get processing method text
   */
  getProcessingMethodText: (method) => {
    const texts = {
      Washing: "Rửa sạch",
      Cutting: "Cắt/Xẻ",
      Drying: "Sấy khô",
      Freezing: "Đông lạnh",
      Packaging: "Đóng gói",
    };
    return texts[method] || method;
  },

  /**
   * Get batch stage text
   */
  getBatchStageText: (stage) => {
    const texts = {
      Created: "Mới tạo",
      Purchased: "Đã thu mua",
      Transported1: "Vận chuyển đến sơ chế",
      Processed: "Đã sơ chế",
      QualityInspected: "Đã kiểm nghiệm",
      Transported2: "Vận chuyển đến kho",
      Warehoused: "Nhập kho",
      DeliveredToConsumer: "Đã giao khách hàng",
    };
    return texts[stage] || stage;
  },

  /**
   * Get test result badge
   */
  getTestResultBadge: (passed) => {
    return passed ? "badge-success" : "badge-error";
  },

  /**
   * Get test result text
   */
  getTestResultText: (passed) => {
    return passed ? "ĐẠT" : "KHÔNG ĐẠT";
  },

  /**
   * Loading overlay
   */
  loading: {
    show: () => {
      Swal.fire({
        title: "Đang xử lý...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
    },

    hide: () => {
      Swal.close();
    },
  },
};

// Export for browser
if (typeof window !== "undefined") {
  window.Utils = Utils;
}
