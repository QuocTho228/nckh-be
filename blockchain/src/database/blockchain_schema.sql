-- =====================================================
-- BLOCKCHAIN DATABASE SCHEMA
-- =====================================================

-- CREATE DATABASE IF NOT EXISTS TRACEABILITY;
-- USE TRACEABILITY;

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

-- Adding indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_uid ON users(uid);
CREATE INDEX idx_admin_email ON admin(admin_email);
CREATE INDEX idx_products_product_id ON products(product_id);
CREATE INDEX idx_batch_actor_id ON batch(actor_id);

-- =====================================================
-- BLOCKCHAIN DATABASE LOGGER SCHEMA
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
-- VIEWS (Không có lỗi với Node.js MySQL client)
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

-- =====================================================
-- SAMPLE QUERIES
-- =====================================================

-- Query 1: Lấy 10 events gần nhất
-- SELECT * FROM vw_blockchain_events_full LIMIT 10;

-- Query 2: Lấy tất cả events của một batch
-- SELECT * FROM vw_batch_events WHERE batch_id = 1;

-- Query 3: Kiểm tra chain integrity
-- CALL sp_verify_chain_integrity(0, 100);

-- Query 4: Lấy timeline của batch
-- CALL sp_get_batch_timeline(1);

-- Query 5: Thống kê
-- CALL sp_get_blockchain_stats();
-- SELECT * FROM vw_event_statistics;