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

    // Purchaser
    PURCHASER_STATS: "/api/purchaser/stats",
    PURCHASER_APPROVED_BATCHES: "/api/purchaser/approved-batches",
    PURCHASER_BATCH_DETAILS: "/api/purchaser/batch/:id/details",
    PURCHASER_MY_PURCHASES: "/api/purchaser/my-purchases",
    PURCHASER_RECORD_PURCHASE: "/api/purchaser/record-purchase",
    PURCHASER_PURCHASE_IMAGES: "/api/purchaser/purchase/:id/images",

    // Transporter
    TRANSPORTER_STATS: "/api/transporter/stats",
    TRANSPORTER_BATCHES: "/api/transporter/batches-to-transport",
    TRANSPORTER_BATCH_DETAILS: "/api/transporter/batch/:id/details",
    TRANSPORTER_CURRENT_STATUS: "/api/transporter/batch/:id/current-status",
    TRANSPORTER_UPDATE_STATUS: "/api/transporter/update-status",
    TRANSPORTER_MY_TRANSPORTS: "/api/transporter/my-transports",
    TRANSPORTER_BATCH_HISTORY: "/api/transporter/batch/:id/transport-history",

    // Processor
    PROCESSOR_STATS: "/api/processor/stats",
    PROCESSOR_PENDING_BATCHES: "/api/processor/pending-batches",
    PROCESSOR_BATCH_DETAILS: "/api/processor/batch/:id/processing-details",
    PROCESSOR_BATCH_TREES: "/api/processor/batch/:id/trees",
    PROCESSOR_RECORD_PROCESSING: "/api/processor/record-processing",
    PROCESSOR_CREATE_PRODUCTS: "/api/processor/create-products",
    PROCESSOR_MY_BATCHES: "/api/processor/my-batches",
    PROCESSOR_PRODUCTS_BY_BATCH: "/api/processor/products/by-batch/:id",
    PROCESSOR_MY_PRODUCTS: "/api/processor/my-products",
    PROCESSOR_PRODUCT_DETAILS: "/api/processor/product/:id/details",

    // Government Stamps (Tem QR Bộ Công An)
    STAMPS_GENERATE: "/api/government-stamps/generate",
    STAMPS_LIST: "/api/government-stamps/list",
    STAMPS_VALIDATE: "/api/government-stamps/validate",
    STAMPS_STATISTICS: "/api/government-stamps/statistics",
    STAMPS_DETAILS: "/api/government-stamps/:qrCode/details",
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

  // Government Stamp Status
  STAMP_STATUS: {
    AVAILABLE: "AVAILABLE",
    USED: "USED",
    EXPIRED: "EXPIRED",
    REVOKED: "REVOKED",
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
    QR_CODE_PATTERN: /^[A-Z]{2,10}\d{4}-\d{8}$/,
  },
};

// Export cho browser
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
