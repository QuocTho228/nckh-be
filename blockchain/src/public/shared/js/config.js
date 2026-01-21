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

    // Farmer (ROLE 1)
    FARMER_TREES: "/api/farmer/my-trees",
    REGISTER_TREE: "/api/farmer/register-tree",
    ADD_TREE_CARE: "/api/farmer/add-tree-care",
    FARMER_BATCHES: "/api/farmer/my-batches",
    CREATE_BATCH: "/api/farmer/create-batch",

    // Inspector (ROLE 2)
    INSPECTOR_STATS: "/api/inspector/stats",
    INSPECTOR_PENDING_BATCHES: "/api/inspector/pending-batches",
    INSPECTOR_BATCH_FULL_INFO: "/api/inspector/batch/:id/full-info",
    INSPECTOR_MY_APPROVALS: "/api/inspector/my-approvals",
    INSPECTOR_APPROVE_BATCH: "/api/inspector/approve-batch/:id",
    INSPECTOR_REJECT_BATCH: "/api/inspector/reject-batch/:id",

    // Purchaser (ROLE 3)
    PURCHASER_STATS: "/api/purchaser/stats",
    PURCHASER_APPROVED_BATCHES: "/api/purchaser/approved-batches",
    PURCHASER_BATCH_DETAILS: "/api/purchaser/batch/:id/details",
    PURCHASER_MY_PURCHASES: "/api/purchaser/my-purchases",
    PURCHASER_RECORD_PURCHASE: "/api/purchaser/record-purchase",
    PURCHASER_PURCHASE_IMAGES: "/api/purchaser/purchase/:id/images",

    // Processor (ROLE 4)
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

    // Quality Inspector (ROLE 5)
    QUALITY_INSPECTOR_STATS: "/api/quality-inspector/stats",
    QUALITY_INSPECTOR_PENDING_BATCHES: "/api/quality-inspector/pending-batches",
    QUALITY_INSPECTOR_MY_TESTS: "/api/quality-inspector/my-tests",
    QUALITY_INSPECTOR_RECORD_TEST: "/api/quality-inspector/record-test",
    QUALITY_INSPECTOR_BATCH_PROCESSING_INFO:
      "/api/quality-inspector/batch/:id/processing-info",
    QUALITY_INSPECTOR_TEST_IMAGES: "/api/quality-inspector/test/:id/images",

    // Transporter (ROLE 6)
    TRANSPORTER_STATS: "/api/transporter/stats",
    TRANSPORTER_BATCHES: "/api/transporter/batches-to-transport",
    TRANSPORTER_BATCH_DETAILS: "/api/transporter/batch/:id/details",
    TRANSPORTER_CURRENT_STATUS: "/api/transporter/batch/:id/current-status",
    TRANSPORTER_UPDATE_STATUS: "/api/transporter/update-status",
    TRANSPORTER_MY_TRANSPORTS: "/api/transporter/my-transports",
    TRANSPORTER_BATCH_HISTORY: "/api/transporter/batch/:id/transport-history",

    // Distributor (ROLE 7)
    DISTRIBUTOR_STATS: "/api/distributor/stats",
    DISTRIBUTOR_AVAILABLE_PRODUCTS: "/api/distributor/available-products",
    DISTRIBUTOR_SALES_HISTORY: "/api/distributor/sales-history",
    DISTRIBUTOR_MARK_SOLD: "/api/distributor/mark-sold",
    DISTRIBUTOR_SCAN_PRODUCT: "/api/distributor/scan-product",
    DISTRIBUTOR_PRODUCT_FULL_INFO: "/api/distributor/product/:qr/full-info",

    // Warehouse (ROLE 8)
    WAREHOUSE_STATS: "/api/warehouse/stats",
    WAREHOUSE_INCOMING_BATCHES: "/api/warehouse/incoming-batches",
    WAREHOUSE_MY_INVENTORY: "/api/warehouse/my-inventory",
    WAREHOUSE_CONFIRM_RECEIPT: "/api/warehouse/confirm-receipt",
    WAREHOUSE_BATCH_TRANSPORT_INFO: "/api/warehouse/batch/:id/transport-info",
    WAREHOUSE_PRODUCTS_AVAILABLE: "/api/warehouse/products/available",

    // Government Stamps (ROLE 10) (Tem QR Bộ Công An)
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
    GOVERNMENT: 10,
  },

  // Tree care categories
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

  // Batch stage
  BATCH_STAGE: {
    CREATED: "Created",
    PURCHASED: "Purchased",
    TRANSPORTED1: "Transported1",
    PROCESSED: "Processed",
    QUALITY_INSPECTED: "QualityInspected",
    TRANSPORTED2: "Transported2",
    WAREHOUSED: "Warehoused",
    DELIVERED: "DeliveredToConsumer",
  },

  // Processing methods
  PROCESSING_METHODS: {
    WASHING: "Washing",
    CUTTING: "Cutting",
    DRYING: "Drying",
    FREEZING: "Freezing",
    PACKAGING: "Packaging",
  },

  // Quality test types
  QUALITY_TEST_TYPES: {
    VISUAL: "Kiểm tra cảm quan",
    CHEMICAL: "Phân tích hóa học",
    MICROBIOLOGICAL: "Vi sinh vật",
    PHYSICAL: "Tính chất vật lý",
    PESTICIDE: "Dư lượng thuốc BVTV",
    HEAVY_METAL: "Kim loại nặng",
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
