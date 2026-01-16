/**
 * ========================================
 * CONFIG.JS - Cấu hình API và Constants
 * ========================================
 */

const CONFIG = {
  // API Base URL
  API_BASE_URL: window.location.origin,

  // API Endpoints
  API: {
    // Auth
    LOGIN: "/api/dangnhap",
    LOGOUT: "/api/dangxuat",
    USER_INFO: "/api/user-info",
    CHECK_LOGIN: "/api/check-login",

    // Master data
    PRODUCTS: "/api/products",
    REGIONS: "/api/region",
    ADDRESS_DATA: "/api/address-data",

    // Farmer - Trees
    FARMER_TREES: "/api/farmer/my-trees",
    REGISTER_TREE: "/api/farmer/register-tree",
    ADD_TREE_CARE: "/api/farmer/add-tree-care",

    // Farmer - Batches
    FARMER_BATCHES: "/api/farmer/my-batches",
    CREATE_BATCH: "/api/farmer/create-batch",

    // Inspector
    INSPECTOR_STATS: "/api/inspector/stats",
    INSPECTOR_PENDING_BATCHES: "/api/inspector/pending-batches",
    INSPECTOR_BATCH_FULL_INFO: "/api/inspector/batch/:id/full-info",
    INSPECTOR_MY_APPROVALS: "/api/inspector/my-approvals",
    INSPECTOR_APPROVE_BATCH: "/api/inspector/approve-batch/:id",
    INSPECTOR_REJECT_BATCH: "/api/inspector/reject-batch/:id",
  },

  // Roles
  ROLES: {
    FARMER: 1,
    INSPECTOR: 2,
    PURCHASER: 3,
    PROCESSOR: 4,
    QUALITY_INSPECTOR: 5,
    TRANSPORTER: 6,
    DISTRIBUTOR: 7,
    WAREHOUSE: 8,
    ADMIN: 9,
  },

  // Tree care categories (map với ActivityLog.sol)
  TREE_CARE_CATEGORIES: {
    TREE_MANAGEMENT: 0,
    FARMING: 1,
    HARVESTING: 2,
    PURCHASE: 3,
    TRANSPORT: 4,
    PROCESSING: 5,
    PACKAGING: 6,
    QUALITY_CONTROL: 7,
    WAREHOUSE: 8,
    DISTRIBUTION: 9,
  },

  // Batch status
  BATCH_STATUS: {
    PENDING: "PendingApproval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  },

  // File upload limits
  FILE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_IMAGES: 10,
    ALLOWED_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  },

  // Validation rules
  VALIDATION: {
    BATCH_NAME_MIN: 3,
    BATCH_NAME_MAX: 255,
    QUANTITY_MIN: 0.01,
    ACTIVITY_NAME_MIN: 3,
    ACTIVITY_NAME_MAX: 200,
  },
};

// Export cho browser
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
