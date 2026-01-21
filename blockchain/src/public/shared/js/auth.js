/**
 * ========================================
 * AUTH.JS - Authentication Helper
 * ========================================
 */

const Auth = {
  /**
   * Current user data (cached)
   */
  currentUser: null,

  /**
   * Kiểm tra đã đăng nhập chưa
   */
  async checkAuth() {
    try {
      const result = await API.getUserInfo();

      if (result.success && result.data.userId) {
        this.currentUser = result.data;
        return true;
      }

      return false;
    } catch (error) {
      console.error("Check auth error:", error);
      return false;
    }
  },

  /**
   * Lấy thông tin user hiện tại
   */
  getCurrentUser() {
    return this.currentUser;
  },

  /**
   * Kiểm tra role
   */
  hasRole(roleId) {
    return this.currentUser && this.currentUser.roleId === roleId;
  },

  /**
   * Kiểm tra có phải farmer không
   */
  isFarmer() {
    return this.hasRole(CONFIG.ROLES.FARMER);
  },

  /**
   * Kiểm tra có phải inspector không
   */
  isInspector() {
    return this.hasRole(CONFIG.ROLES.INSPECTOR);
  },

  /**
   * Kiểm tra có phải purchaser không
   */
  isPurchaser() {
    return this.hasRole(CONFIG.ROLES.PURCHASER);
  },

  /**
   * Kiểm tra có phải transporter không
   */
  isTransporter() {
    return this.hasRole(CONFIG.ROLES.TRANSPORTER);
  },

  /**
   * Kiểm tra có phải processor không
   */
  isProcessor() {
    return this.hasRole(CONFIG.ROLES.PROCESSOR);
  },

  /**
   * Kiểm tra có phải government không
   */
  isGovernment() {
    return this.hasRole(CONFIG.ROLES.GOVERNMENT);
  },

  /**
   * Kiểm tra có phải quality inspector không
   */
  isQualityInspector() {
    return this.hasRole(CONFIG.ROLES.QUALITY_INSPECTOR);
  },

  /**
   * Kiểm tra có phải warehouse không
   */
  isWarehouse() {
    return this.hasRole(CONFIG.ROLES.WAREHOUSE);
  },

  /**
   * Đăng xuất
   */
  async logout() {
    const confirmed = await Utils.confirm(
      "Đăng xuất",
      "Bạn có chắc muốn đăng xuất?",
      "Đăng xuất",
    );

    if (!confirmed) return;

    Utils.loading.show();

    const result = await API.logout();

    Utils.loading.hide();

    if (result.success) {
      this.currentUser = null;
      Utils.toast.success("Đăng xuất thành công");
      setTimeout(() => {
        window.location.href = "/account/dangnhap.html";
      }, 1000);
    } else {
      Utils.toast.error("Lỗi khi đăng xuất");
    }
  },

  /**
   * Require auth - redirect nếu chưa đăng nhập
   */
  async requireAuth() {
    const isLoggedIn = await this.checkAuth();

    if (!isLoggedIn) {
      Utils.toast.error("Vui lòng đăng nhập để tiếp tục");
      setTimeout(() => {
        window.location.href = "/account/dangnhap.html";
      }, 1500);
      return false;
    }

    return true;
  },

  /**
   * Require farmer role
   */
  async requireFarmer() {
    const isLoggedIn = await this.requireAuth();

    if (!isLoggedIn) return false;

    if (!this.isFarmer()) {
      Utils.toast.error("Bạn không có quyền truy cập trang này");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }

    return true;
  },

  /**
   * Require inspector role
   */
  async requireInspector() {
    const isLoggedIn = await this.requireAuth();
    if (!isLoggedIn) return false;

    if (!this.isInspector()) {
      Utils.toast.error("Bạn không có quyền truy cập trang này");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }
    return true;
  },

  /**
   * Require purchaser role
   */
  async requirePurchaser() {
    const isLoggedIn = await this.requireAuth();
    if (!isLoggedIn) return false;

    if (!this.isPurchaser()) {
      Utils.toast.error("Bạn không có quyền truy cập trang này");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }
    return true;
  },

  /**
   * Require transporter role
   */
  async requireTransporter() {
    const isLoggedIn = await this.requireAuth();
    if (!isLoggedIn) return false;

    if (!this.isTransporter()) {
      Utils.toast.error("Bạn không có quyền truy cập trang này");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }
    return true;
  },

  /**
   * Require processor role
   */
  async requireProcessor() {
    const isLoggedIn = await this.requireAuth();
    if (!isLoggedIn) return false;

    if (!this.isProcessor()) {
      Utils.toast.error("Bạn không có quyền truy cập trang này");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }
    return true;
  },

  /**
   * Require government role
   */
  async requireGovernment() {
    const isLoggedIn = await this.requireAuth();
    if (!isLoggedIn) return false;

    if (!this.isGovernment()) {
      Utils.toast.error(
        "Bạn không có quyền truy cập trang này. Chỉ dành cho Bộ Công An.",
      );
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }
    return true;
  },

  /**
   * Require quality inspector role
   */
  async requireQualityInspector() {
    const isLoggedIn = await this.requireAuth();
    if (!isLoggedIn) return false;

    if (!this.isQualityInspector()) {
      Utils.toast.error("Bạn không có quyền truy cập trang này");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }
    return true;
  },

  /**
   * Require warehouse role
   */
  async requireWarehouse() {
    const isLoggedIn = await this.requireAuth();
    if (!isLoggedIn) return false;

    if (!this.isWarehouse()) {
      Utils.toast.error("Bạn không có quyền truy cập trang này");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
      return false;
    }
    return true;
  },

  /**
   * Initialize auth on page load
   */
  async init() {
    // Check auth khi load trang
    await this.checkAuth();

    // Update navbar với user info
    this.updateNavbar();
  },

  /**
   * Update navbar với thông tin user
   */
  updateNavbar() {
    if (!this.currentUser) return;

    // Tìm các element cần update
    const userNameEl = document.getElementById("userName");
    const userAvatarEl = document.getElementById("userAvatar");
    const userEmailEl = document.getElementById("userEmail");

    if (userNameEl) {
      userNameEl.textContent = this.currentUser.name || "Bộ Công An";
    }

    if (userAvatarEl && this.currentUser.avatar) {
      userAvatarEl.src = this.currentUser.avatar;
    }

    if (userEmailEl) {
      userEmailEl.textContent = this.currentUser.email || "";
    }
  },
};

// Export for browser
if (typeof window !== "undefined") {
  window.Auth = Auth;
}
