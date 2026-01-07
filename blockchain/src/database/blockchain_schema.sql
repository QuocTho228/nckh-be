-- =====================================================
-- BLOCKCHAIN DATABASE SCHEMA
-- =====================================================

-- CREATE DATABASE IF NOT EXISTS TRACEABILITY
-- CHARACTER SET utf8mb4
-- COLLATE utf8mb4_unicode_ci;

-- USE TRACEABILITY;

-- =====================================================
-- EXISTING TABLES (Giữ nguyên)
-- =====================================================

-- Creating table for roles
CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creating table for notification_type
CREATE TABLE notification_type (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creating table for regions
CREATE TABLE regions (
    region_id VARCHAR(10) PRIMARY KEY,
    region_name VARCHAR(100) NOT NULL,
    ward_name VARCHAR(100),
    district_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creating table for provinces
CREATE TABLE provinces (
    province_id INT AUTO_INCREMENT PRIMARY KEY,
    province_name VARCHAR(100) NOT NULL,
    region_id VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES regions(region_id) ON DELETE SET NULL
);

-- Creating table for districts
CREATE TABLE districts (
    district_id INT AUTO_INCREMENT PRIMARY KEY,
    district_name VARCHAR(100) NOT NULL,
    province_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (province_id) REFERENCES provinces(province_id) ON DELETE SET NULL
);

-- Creating table for wards
CREATE TABLE wards (
    ward_id INT AUTO_INCREMENT PRIMARY KEY,
    ward_name VARCHAR(100) NOT NULL,
    district_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts(district_id) ON DELETE SET NULL
);

-- Creating table for admin
CREATE TABLE admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_email VARCHAR(255) NOT NULL UNIQUE,
    admin_name VARCHAR(255) NOT NULL,
    admin_pass VARCHAR(255) NOT NULL,
    role_id INT,
    province_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE SET NULL,
    FOREIGN KEY (province_id) REFERENCES provinces(province_id) ON DELETE SET NULL
);

-- Creating table for users
CREATE TABLE users (
    uid INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    passwd VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    avatar VARCHAR(255),
    dob DATE,
    gender ENUM('male', 'female', 'other'),
    role_id INT,
    region_id VARCHAR(10),
    province_id INT,
    district_id INT,
    ward_id INT,
    verificationToken VARCHAR(255),
    is_approved BOOLEAN DEFAULT FALSE,
    reset_password_token VARCHAR(255),
    temp_password VARCHAR(255),
    reset_password_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE SET NULL,
    FOREIGN KEY (region_id) REFERENCES regions(region_id) ON DELETE SET NULL,
    FOREIGN KEY (province_id) REFERENCES provinces(province_id) ON DELETE SET NULL,
    FOREIGN KEY (district_id) REFERENCES districts(district_id) ON DELETE SET NULL,
    FOREIGN KEY (ward_id) REFERENCES wards(ward_id) ON DELETE SET NULL
);

-- Creating table for products
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2),
    description TEXT,
    img VARCHAR(255),
    uses TEXT,
    process TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creating table for batch
CREATE TABLE batch (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_name VARCHAR(255) NOT NULL,
    actor_id INT,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT,
    approved_on TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES users(uid) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES admin(id) ON DELETE SET NULL
);

-- Creating table for register
CREATE TABLE register (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content TEXT,
    FOREIGN KEY (actor_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- Creating table for notification_object
CREATE TABLE notification_object (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type_id INT NOT NULL,
    entity_id INT NOT NULL,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_type_id) REFERENCES notification_type(id) ON DELETE CASCADE
);

-- Creating table for notification_change
CREATE TABLE notification_change (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_object_id INT,
    actor_id INT,
    FOREIGN KEY (notification_object_id) REFERENCES notification_object(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(uid) ON DELETE SET NULL
);

-- Creating table for notification
CREATE TABLE notification (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_object_id INT,
    admin_id INT,
    user_id INT,
    recipient_type ENUM('admin', 'user') NOT NULL,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_object_id) REFERENCES notification_object(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE SET NULL,
    UNIQUE KEY unique_notification (notification_object_id, admin_id, user_id)
);

-- =====================================================
-- NEW TABLES - DỮ LIỆU CHUYỂN TỪ BLOCKCHAIN SANG MYSQL
-- =====================================================

-- Bảng lưu thông tin cây trồng (từ ActivityLog contract)
CREATE TABLE trees (
    tree_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    tree_qr_code VARCHAR(100) NOT NULL UNIQUE,
    farmer_id INT NOT NULL,
    region_id VARCHAR(10),
    tree_type VARCHAR(100),
    variety VARCHAR(100),
    planted_date BIGINT NOT NULL COMMENT 'Unix timestamp',
    planted_date_iso DATETIME COMMENT 'Datetime format',
    coordinates VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    blockchain_tx_hash VARCHAR(66) COMMENT 'Transaction hash khi tạo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_farmer (farmer_id),
    INDEX idx_region (region_id),
    INDEX idx_qr_code (tree_qr_code),
    INDEX idx_tree_type (tree_type),
    INDEX idx_active (is_active),
    
    FOREIGN KEY (farmer_id) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (region_id) REFERENCES regions(region_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Thông tin cây trồng - sync từ blockchain';

-- Bảng liên kết cây với lô hàng
CREATE TABLE tree_batch_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tree_id BIGINT NOT NULL,
    batch_id BIGINT NOT NULL,
    harvest_date BIGINT NOT NULL COMMENT 'Unix timestamp',
    harvest_date_iso DATETIME,
    harvest_notes TEXT,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tree (tree_id),
    INDEX idx_batch (batch_id),
    INDEX idx_harvest_date (harvest_date_iso),
    
    FOREIGN KEY (tree_id) REFERENCES trees(tree_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Liên kết cây với lô hàng khi thu hoạch';

-- Bảng lưu hoạt động chăm sóc cây (Tree Activity Logs)
CREATE TABLE tree_activity_logs (
    log_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    tree_id BIGINT NOT NULL,
    participant_id INT NOT NULL,
    timestamp BIGINT NOT NULL,
    timestamp_iso DATETIME NOT NULL,
    category ENUM('TreeManagement', 'Farming', 'Harvesting', 'Purchase', 'Transport', 
                  'Processing', 'Packaging', 'QualityControl', 'Warehouse', 'Distribution'),
    activity_name VARCHAR(200) NOT NULL,
    description TEXT,
    is_system_activity BOOLEAN DEFAULT FALSE,
    
    -- Metadata fields (từ ActivityMetadata struct)
    fertilizer VARCHAR(200),
    pesticide VARCHAR(200),
    quantity DECIMAL(10, 2),
    unit VARCHAR(50),
    temperature TINYINT,
    humidity TINYINT UNSIGNED,
    weather VARCHAR(100),
    health_status VARCHAR(100),
    notes TEXT,
    
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tree (tree_id),
    INDEX idx_participant (participant_id),
    INDEX idx_timestamp (timestamp_iso),
    INDEX idx_category (category),
    INDEX idx_activity_name (activity_name),
    
    FOREIGN KEY (tree_id) REFERENCES trees(tree_id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Nhật ký hoạt động chăm sóc cây - sync từ blockchain';

-- Bảng lưu ảnh minh chứng cho tree activities
CREATE TABLE tree_activity_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_log (log_id),
    
    FOREIGN KEY (log_id) REFERENCES tree_activity_logs(log_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ảnh minh chứng cho hoạt động cây';

-- Bảng lưu thông tin lô hàng (Batch) từ blockchain
CREATE TABLE blockchain_batches (
    batch_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    batch_name VARCHAR(255) NOT NULL,
    sscc VARCHAR(20) NOT NULL UNIQUE,
    producer_id INT NOT NULL,
    quantity VARCHAR(100),
    production_date BIGINT NOT NULL,
    production_date_iso DATETIME NOT NULL,
    start_date BIGINT NOT NULL,
    start_date_iso DATETIME NOT NULL,
    end_date BIGINT NOT NULL,
    end_date_iso DATETIME NOT NULL,
    
    -- Status
    status ENUM('PendingApproval', 'Approved', 'Rejected') NOT NULL,
    current_stage ENUM('Created', 'Purchased', 'Transported1', 'Processed', 
                       'QualityInspected', 'Transported2', 'Warehoused', 'DeliveredToConsumer'),
    
    -- IDs tham gia
    purchaser_id INT DEFAULT 0,
    processor_id INT DEFAULT 0,
    quality_inspector_id INT DEFAULT 0,
    last_transporter_id INT DEFAULT 0,
    
    -- Transport status
    transport_status ENUM('NotTransported', 'InTransit', 'Delivered'),
    detailed_transport_status ENUM('NotStarted', 'InTransit', 'Paused', 'Delivered'),
    
    -- Product info
    product_type_id INT,
    farm_plot_number VARCHAR(100),
    certificate_image_url VARCHAR(500),
    total_products INT DEFAULT 0,
    
    -- Blockchain
    data_hash VARCHAR(66),
    blockchain_tx_hash VARCHAR(66) COMMENT 'Transaction hash khi tạo',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_sscc (sscc),
    INDEX idx_producer (producer_id),
    INDEX idx_status (status),
    INDEX idx_stage (current_stage),
    INDEX idx_product_type (product_type_id),
    INDEX idx_production_date (production_date_iso),
    
    FOREIGN KEY (producer_id) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (product_type_id) REFERENCES products(product_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Thông tin lô hàng - sync từ blockchain';

-- Bảng lưu ảnh sản phẩm của lô hàng
CREATE TABLE batch_product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    image_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch (batch_id),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ảnh sản phẩm của lô hàng';

-- Bảng lưu sản phẩm đơn lẻ (Products in Batch)
CREATE TABLE blockchain_products (
    product_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    batch_id BIGINT NOT NULL,
    product_qr_code VARCHAR(100) NOT NULL UNIQUE,
    packaged_date BIGINT NOT NULL,
    packaged_date_iso DATETIME NOT NULL,
    package_type VARCHAR(100),
    weight INT COMMENT 'Trọng lượng (gram)',
    is_active BOOLEAN DEFAULT TRUE,
    sold_date BIGINT DEFAULT 0,
    sold_date_iso DATETIME,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch (batch_id),
    INDEX idx_qr_code (product_qr_code),
    INDEX idx_active (is_active),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Sản phẩm đơn lẻ trong lô - sync từ blockchain';

-- Bảng liên kết sản phẩm với cây nguồn gốc
CREATE TABLE product_source_trees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    tree_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_tree (tree_id),
    
    FOREIGN KEY (product_id) REFERENCES blockchain_products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (tree_id) REFERENCES trees(tree_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Liên kết sản phẩm với cây nguồn gốc';

-- Bảng lưu thông tin thu mua (Purchase Records)
CREATE TABLE purchase_records (
    purchase_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    batch_id BIGINT NOT NULL,
    purchaser_id INT NOT NULL,
    farmer_id INT NOT NULL,
    purchase_date BIGINT NOT NULL,
    purchase_date_iso DATETIME NOT NULL,
    total_quantity INT COMMENT 'kg',
    price_per_unit BIGINT COMMENT 'VND per kg',
    total_price BIGINT COMMENT 'VND',
    quality_grade VARCHAR(10),
    notes TEXT,
    is_confirmed BOOLEAN DEFAULT FALSE,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch (batch_id),
    INDEX idx_purchaser (purchaser_id),
    INDEX idx_farmer (farmer_id),
    INDEX idx_date (purchase_date_iso),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (purchaser_id) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (farmer_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Thông tin thu mua - sync từ blockchain';

-- Bảng lưu ảnh thu mua
CREATE TABLE purchase_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_purchase (purchase_id),
    
    FOREIGN KEY (purchase_id) REFERENCES purchase_records(purchase_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu thông tin sơ chế (Processing Records)
CREATE TABLE processing_records (
    processing_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    batch_id BIGINT NOT NULL,
    processor_id INT NOT NULL,
    processing_date BIGINT NOT NULL,
    processing_date_iso DATETIME NOT NULL,
    method ENUM('Washing', 'Cutting', 'Drying', 'Freezing', 'Packaging'),
    method_description TEXT,
    input_weight INT COMMENT 'kg',
    output_weight INT COMMENT 'kg',
    notes TEXT,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch (batch_id),
    INDEX idx_processor (processor_id),
    INDEX idx_date (processing_date_iso),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (processor_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Thông tin sơ chế - sync từ blockchain';

-- Bảng lưu phụ gia sơ chế
CREATE TABLE processing_additives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    processing_id BIGINT NOT NULL,
    additive VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_processing (processing_id),
    
    FOREIGN KEY (processing_id) REFERENCES processing_records(processing_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu ảnh sơ chế
CREATE TABLE processing_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    processing_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_processing (processing_id),
    
    FOREIGN KEY (processing_id) REFERENCES processing_records(processing_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu kiểm nghiệm chất lượng (Quality Tests)
CREATE TABLE quality_tests (
    test_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    batch_id BIGINT NOT NULL,
    inspector_id INT NOT NULL,
    test_date BIGINT NOT NULL,
    test_date_iso DATETIME NOT NULL,
    test_type VARCHAR(200),
    test_method VARCHAR(200),
    result TEXT,
    passed BOOLEAN NOT NULL,
    standard VARCHAR(200),
    notes TEXT,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch (batch_id),
    INDEX idx_inspector (inspector_id),
    INDEX idx_date (test_date_iso),
    INDEX idx_passed (passed),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (inspector_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Kiểm nghiệm chất lượng - sync từ blockchain';

-- Bảng lưu ảnh kiểm nghiệm
CREATE TABLE quality_test_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_test (test_id),
    
    FOREIGN KEY (test_id) REFERENCES quality_tests(test_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu sự kiện vận chuyển (Transport Events)
CREATE TABLE transport_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    participant_id INT NOT NULL,
    timestamp BIGINT NOT NULL,
    timestamp_iso DATETIME NOT NULL,
    action VARCHAR(200) NOT NULL,
    participant_type VARCHAR(100),
    location VARCHAR(500),
    temperature TINYINT,
    humidity TINYINT UNSIGNED,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch (batch_id),
    INDEX idx_participant (participant_id),
    INDEX idx_timestamp (timestamp_iso),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Sự kiện vận chuyển - sync từ blockchain';

-- Bảng lưu xác nhận kho (Warehouse Confirmations)
CREATE TABLE warehouse_confirmations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    warehouse_id INT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blockchain_tx_hash VARCHAR(66),
    
    INDEX idx_batch (batch_id),
    INDEX idx_warehouse (warehouse_id),
    UNIQUE KEY unique_confirmation (batch_id, warehouse_id),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Xác nhận nhận hàng tại kho';

-- Bảng lưu batch activity logs
CREATE TABLE batch_activity_logs (
    log_id BIGINT PRIMARY KEY COMMENT 'ID từ blockchain',
    batch_id BIGINT NOT NULL,
    participant_id INT NOT NULL,
    timestamp BIGINT NOT NULL,
    timestamp_iso DATETIME NOT NULL,
    category ENUM('TreeManagement', 'Farming', 'Harvesting', 'Purchase', 'Transport', 
                  'Processing', 'Packaging', 'QualityControl', 'Warehouse', 'Distribution'),
    activity_name VARCHAR(200) NOT NULL,
    description TEXT,
    is_system_activity BOOLEAN DEFAULT FALSE,
    blockchain_tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_batch (batch_id),
    INDEX idx_participant (participant_id),
    INDEX idx_timestamp (timestamp_iso),
    INDEX idx_category (category),
    
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Nhật ký hoạt động lô hàng - sync từ blockchain';

-- Bảng lưu ảnh activity logs
CREATE TABLE batch_activity_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_log (log_id),
    
    FOREIGN KEY (log_id) REFERENCES batch_activity_logs(log_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu related products trong activity logs
CREATE TABLE batch_activity_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_log (log_id),
    INDEX idx_product (product_id),
    
    FOREIGN KEY (log_id) REFERENCES batch_activity_logs(log_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu lịch sử bán hàng (off-chain)
CREATE TABLE product_sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    product_qr_code VARCHAR(100) NOT NULL,
    batch_id BIGINT NOT NULL,
    distributor_id INT NOT NULL,
    sold_date BIGINT NOT NULL,
    sold_date_iso DATETIME NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_batch (batch_id),
    INDEX idx_distributor (distributor_id),
    INDEX idx_sold_date (sold_date_iso),
    
    FOREIGN KEY (product_id) REFERENCES blockchain_products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES blockchain_batches(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lịch sử bán hàng - off-chain tracking';

-- =====================================================
-- DATABASE CLEANUP SCRIPT
-- =====================================================

-- XÓA các bảng KHÔNG DÙNG
DROP TABLE IF EXISTS batch_activity_images;
DROP TABLE IF EXISTS batch_activity_products;
DROP TABLE IF EXISTS processing_additives;
DROP TABLE IF EXISTS register;
DROP TABLE IF EXISTS batch;

-- =====================================================
-- BLOCKCHAIN LOGGER TABLES (Giữ nguyên)
-- =====================================================

-- Bảng lưu thông tin blocks
CREATE TABLE IF NOT EXISTS blockchain_blocks (
    block_number BIGINT PRIMARY KEY COMMENT 'Số thứ tự block',
    block_hash VARCHAR(66) NOT NULL UNIQUE COMMENT 'Hash của block',
    parent_hash VARCHAR(66) NOT NULL COMMENT 'Hash của block trước đó',
    timestamp BIGINT NOT NULL COMMENT 'Timestamp Unix',
    timestamp_iso DATETIME NOT NULL COMMENT 'Timestamp dạng datetime',
    miner VARCHAR(42) COMMENT 'Địa chỉ miner',
    gas_used BIGINT DEFAULT 0 COMMENT 'Gas đã sử dụng',
    gas_limit BIGINT DEFAULT 0 COMMENT 'Gas limit',
    transaction_count INT DEFAULT 0 COMMENT 'Số lượng transaction trong block',
    difficulty VARCHAR(100) COMMENT 'Độ khó mining',
    extra_data TEXT COMMENT 'Dữ liệu bổ sung',
    nonce VARCHAR(66) COMMENT 'Nonce',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm lưu vào DB',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_block_hash (block_hash),
    INDEX idx_parent_hash (parent_hash),
    INDEX idx_timestamp (timestamp),
    INDEX idx_timestamp_iso (timestamp_iso),
    INDEX idx_miner (miner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lưu trữ thông tin blocks từ blockchain';

-- Bảng lưu các events/logs
CREATE TABLE IF NOT EXISTS blockchain_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    block_number BIGINT NOT NULL COMMENT 'Block chứa event',
    transaction_hash VARCHAR(66) NOT NULL COMMENT 'Hash của transaction',
    transaction_index INT NOT NULL COMMENT 'Vị trí transaction trong block',
    log_index INT NOT NULL COMMENT 'Vị trí log trong transaction',
    event_name VARCHAR(100) NOT NULL COMMENT 'Tên event (BatchCreated, BatchApproved...)',
    contract_address VARCHAR(42) NOT NULL COMMENT 'Địa chỉ contract phát ra event',
    event_data JSON NOT NULL COMMENT 'Dữ liệu event dạng JSON',
    timestamp BIGINT NOT NULL COMMENT 'Timestamp của block',
    timestamp_iso DATETIME NOT NULL COMMENT 'Timestamp dạng datetime',
    
    -- Thông tin transaction
    gas_used BIGINT COMMENT 'Gas đã dùng',
    gas_price VARCHAR(100) COMMENT 'Gas price',
    tx_from VARCHAR(42) COMMENT 'Địa chỉ gửi transaction',
    tx_to VARCHAR(42) COMMENT 'Địa chỉ nhận',
    tx_status TINYINT COMMENT '1=success, 0=failed',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_event (transaction_hash, log_index),
    
    INDEX idx_block (block_number),
    INDEX idx_tx_hash (transaction_hash),
    INDEX idx_event_name (event_name),
    INDEX idx_contract (contract_address),
    INDEX idx_timestamp (timestamp),
    INDEX idx_timestamp_iso (timestamp_iso),
    INDEX idx_tx_from (tx_from),
    INDEX idx_tx_to (tx_to),
    
    -- Indexes cho JSON queries
    INDEX idx_batch_id ((CAST(JSON_UNQUOTE(JSON_EXTRACT(event_data, '$.batchId')) AS UNSIGNED))),
    INDEX idx_producer_id ((CAST(JSON_UNQUOTE(JSON_EXTRACT(event_data, '$.producerId')) AS UNSIGNED))),
    INDEX idx_participant_id ((CAST(JSON_UNQUOTE(JSON_EXTRACT(event_data, '$.participantId')) AS UNSIGNED)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lưu trữ events từ smart contracts';

-- Bảng lưu trạng thái sync
CREATE TABLE IF NOT EXISTS blockchain_sync_status (
    id INT PRIMARY KEY DEFAULT 1,
    last_synced_block BIGINT NOT NULL DEFAULT -1 COMMENT 'Block cuối cùng đã sync',
    total_blocks_synced BIGINT NOT NULL DEFAULT 0 COMMENT 'Tổng số blocks đã sync',
    total_events_synced BIGINT NOT NULL DEFAULT 0 COMMENT 'Tổng số events đã sync',
    last_sync_at TIMESTAMP NULL COMMENT 'Lần sync cuối',
    sync_errors INT DEFAULT 0 COMMENT 'Số lỗi sync',
    last_error TEXT COMMENT 'Lỗi cuối cùng',
    is_syncing BOOLEAN DEFAULT FALSE COMMENT 'Đang sync?',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Trạng thái đồng bộ blockchain';

-- Insert default sync status
INSERT IGNORE INTO blockchain_sync_status (id, last_synced_block) 
VALUES (1, -1);

-- =====================================================
-- VIEWS
-- =====================================================

-- View: Tất cả events với thông tin block
CREATE OR REPLACE VIEW vw_blockchain_events_full AS
SELECT 
    e.id,
    e.event_name,
    e.contract_address,
    e.transaction_hash,
    e.log_index,
    e.event_data,
    e.timestamp_iso as event_time,
    e.gas_used as event_gas_used,
    e.tx_from,
    e.tx_to,
    e.tx_status,
    b.block_number,
    b.block_hash,
    b.parent_hash,
    b.miner,
    b.gas_used as block_gas_used,
    b.transaction_count
FROM blockchain_events e
JOIN blockchain_blocks b ON e.block_number = b.block_number
ORDER BY e.block_number DESC, e.transaction_index ASC, e.log_index ASC;

-- View: Events theo batch
CREATE OR REPLACE VIEW vw_batch_blockchain_events AS
SELECT 
    CAST(JSON_UNQUOTE(JSON_EXTRACT(event_data, '$.batchId')) AS UNSIGNED) as batch_id,
    event_name,
    event_data,
    timestamp_iso,
    block_number,
    transaction_hash
FROM blockchain_events
WHERE JSON_EXTRACT(event_data, '$.batchId') IS NOT NULL
ORDER BY block_number ASC;

-- View: Thống kê events
CREATE OR REPLACE VIEW vw_blockchain_event_statistics AS
SELECT 
    event_name,
    COUNT(*) as total_count,
    MIN(timestamp_iso) as first_occurrence,
    MAX(timestamp_iso) as last_occurrence,
    MIN(block_number) as first_block,
    MAX(block_number) as last_block
FROM blockchain_events
GROUP BY event_name;

-- View: Lấy full traceability của batch
CREATE OR REPLACE VIEW vw_batch_full_traceability AS
SELECT 
    b.batch_id,
    b.batch_name,
    b.sscc,
    b.status,
    b.current_stage,
    b.producer_id,
    u.name as producer_name,
    b.production_date_iso,
    b.total_products,
    
    -- Purchase info
    pr.purchase_id,
    pr.purchaser_id,
    pr.total_quantity as purchase_quantity,
    pr.quality_grade,
    
    -- Processing info
    proc.processing_id,
    proc.processor_id,
    proc.method as processing_method,
    
    -- Quality info
    (SELECT COUNT(*) FROM quality_tests qt WHERE qt.batch_id = b.batch_id AND qt.passed = TRUE) as passed_tests,
    (SELECT COUNT(*) FROM quality_tests qt WHERE qt.batch_id = b.batch_id) as total_tests,
    
    -- Transport info
    b.transport_status,
    b.detailed_transport_status,
    (SELECT COUNT(*) FROM transport_events te WHERE te.batch_id = b.batch_id) as transport_event_count,
    
    -- Warehouse info
    (SELECT COUNT(*) FROM warehouse_confirmations wc WHERE wc.batch_id = b.batch_id) as warehouse_count
    
FROM blockchain_batches b
LEFT JOIN users u ON b.producer_id = u.uid
LEFT JOIN purchase_records pr ON b.batch_id = pr.batch_id
LEFT JOIN processing_records proc ON b.batch_id = proc.batch_id
ORDER BY b.batch_id DESC;

-- View: Product với tree traceability
CREATE OR REPLACE VIEW vw_product_traceability AS
SELECT 
    p.product_id,
    p.product_qr_code,
    p.batch_id,
    b.sscc,
    b.batch_name,
    p.weight,
    p.package_type,
    p.packaged_date_iso,
    
    -- Tree info
    GROUP_CONCAT(t.tree_id) as source_tree_ids,
    GROUP_CONCAT(t.tree_qr_code) as source_tree_qrs,
    GROUP_CONCAT(t.tree_type) as tree_types,
    
    -- Batch info
    b.producer_id,
    b.current_stage,
    b.status
    
FROM blockchain_products p
JOIN blockchain_batches b ON p.batch_id = b.batch_id
LEFT JOIN product_source_trees pst ON p.product_id = pst.product_id
LEFT JOIN trees t ON pst.tree_id = t.tree_id
GROUP BY p.product_id;

-- Adding indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_uid ON users(uid);
CREATE INDEX idx_admin_email ON admin(admin_email);
CREATE INDEX idx_products_product_id ON products(product_id);
CREATE INDEX idx_batch_actor_id ON batch(actor_id);

ALTER TABLE tree_activity_logs 
MODIFY COLUMN activity_name VARCHAR(200) NOT NULL DEFAULT '' 
COMMENT 'Tên hoạt động - sẽ được update bởi TreeActivityDetailsStored event';

ALTER TABLE blockchain_batches 
MODIFY COLUMN batch_name VARCHAR(255) DEFAULT NULL COMMENT 'Tên lô hàng - sẽ được update bởi BatchDetailsStored event',
MODIFY COLUMN quantity VARCHAR(100) DEFAULT NULL COMMENT 'Số lượng - sẽ được update bởi BatchDetailsStored event',
MODIFY COLUMN start_date BIGINT DEFAULT NULL,
MODIFY COLUMN start_date_iso DATETIME DEFAULT NULL,
MODIFY COLUMN end_date BIGINT DEFAULT NULL,
MODIFY COLUMN end_date_iso DATETIME DEFAULT NULL,
MODIFY COLUMN farm_plot_number VARCHAR(100) DEFAULT NULL,
MODIFY COLUMN sscc VARCHAR(20) DEFAULT NULL COMMENT 'Mã SSCC - Chỉ có khi batch được phê duyệt';

ALTER TABLE batch_activity_logs 
MODIFY COLUMN activity_name VARCHAR(200) NOT NULL DEFAULT ''
COMMENT 'Tên hoạt động - sẽ được update bởi ActivityLogDetailsStored event';

ALTER TABLE tree_activity_logs
MODIFY COLUMN activity_name VARCHAR(200) NOT NULL DEFAULT ''
COMMENT 'Tên hoạt động cây - sẽ được update bởi TreeActivityDetailsStored event';

ALTER TABLE blockchain_batches 
MODIFY COLUMN batch_name VARCHAR(255) NOT NULL DEFAULT ''
COMMENT 'Tên lô hàng - sẽ được update bởi BatchDetailsStored event';

ALTER TABLE blockchain_batches 
MODIFY COLUMN quantity VARCHAR(100) NOT NULL DEFAULT ''
COMMENT 'Số lượng - sẽ được update bởi BatchDetailsStored event';

ALTER TABLE transport_events 
MODIFY COLUMN action VARCHAR(200) NOT NULL DEFAULT ''
COMMENT 'Mô tả hành động vận chuyển - sẽ được update bởi TransportDetailsStored event nếu có';
-- =====================================================
-- SUMMARY COMMENTS
-- =====================================================
/*
KIẾN TRÚC TỐI ƯU:

1. DỮ LIỆU LƯU TRÊN BLOCKCHAIN (Chỉ thông tin tối thiểu):
   - Batch ID, SSCC, Producer ID, Data Hash
   - Product ID, Product QR Code, Batch ID
   - Tree ID, Tree QR Code, Farmer ID
   - Timestamps, Status, Stage
   - Transaction hashes để xác thực

2. DỮ LIỆU LƯU TRÊN MYSQL (Chi tiết mở rộng):
   - Tất cả các mảng (images, additives, GPS checkpoints)
   - Descriptions, notes, metadata
   - Thông tin chi tiết không cần immutability
   - Relationships và foreign keys

3. LỢI ÍCH:
   - Giảm 70-80% gas cost
   - Giảm kích thước transaction
   - Tăng tốc độ query phức tạp
   - Dễ mở rộng và bảo trì
   - Blockchain chỉ lưu proof & critical data
   - MySQL lưu detailed & queryable data

4. WORKFLOW:
   - Smart contract emit events với dữ liệu tối thiểu
   - Backend listener bắt events
   - Parse và lưu chi tiết vào MySQL
   - Frontend query từ MySQL (nhanh hơn)
   - Verify bằng blockchain khi cần (data hash)
*/