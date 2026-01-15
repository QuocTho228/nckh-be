-- =====================================================
-- INSERT DATA THEO QUYẾT ĐỊNH 5272/QĐ-BNNMT 2025
-- Quy trình truy xuất nguồn gốc 7 bước
-- =====================================================

-- =====================================================
-- 1. ROLES - BỔ SUNG VAI TRÒ MỚI
-- =====================================================
INSERT INTO roles (role_id, role_name, description) VALUES
(1, 'Farmer', 'Nông dân - Người trồng và chăm sóc cây'),
(2, 'Inspector', 'Thanh tra/Kiểm duyệt - Phê duyệt vùng trồng và lô hàng'),
(3, 'Purchaser', 'Người thu mua - Thu mua sản phẩm từ nông dân'),
(4, 'Processor', 'Cơ sở sơ chế - Sơ chế và đóng gói sản phẩm'),
(5, 'QualityInspector', 'Kiểm nghiệm viên - Kiểm tra chất lượng sản phẩm'),
(6, 'Transporter', 'Người vận chuyển - Vận chuyển sản phẩm'),
(7, 'Distributor', 'Nhà phân phối - Phân phối sản phẩm'),
(8, 'Warehouse', 'Nhà kho - Bảo quản và lưu trữ sản phẩm'),
(9, 'Admin', 'Quản trị viên hệ thống');

-- =====================================================
-- 2. NOTIFICATION TYPES
-- =====================================================
INSERT INTO notification_type (id, name, description) VALUES
(1, 'region_registration', 'Đăng ký vùng trồng mới'),
(2, 'region_approval', 'Phê duyệt vùng trồng'),
(3, 'batch_created', 'Tạo lô hàng mới'),
(4, 'batch_approval', 'Phê duyệt lô hàng'),
(5, 'batch_rejection', 'Từ chối lô hàng'),
(6, 'purchase_confirmed', 'Xác nhận thu mua'),
(7, 'transport_started', 'Bắt đầu vận chuyển'),
(8, 'transport_completed', 'Hoàn thành vận chuyển'),
(9, 'processing_completed', 'Hoàn thành sơ chế'),
(10, 'quality_test_passed', 'Kiểm nghiệm đạt'),
(11, 'quality_test_failed', 'Kiểm nghiệm không đạt'),
(12, 'warehouse_received', 'Kho nhận hàng');

-- =====================================================
-- 3. VÙNG SẢN XUẤT VĨNH KIM (TXNG)
-- =====================================================
INSERT INTO regions (region_id, region_name, ward_name, district_name) VALUES
('82822001', 'Vùng TXNG Sầu riêng Vĩnh Kim - Khu A', 'Xã Vĩnh Kim', 'Huyện Châu Thành'),
('82822002', 'Vùng TXNG Ri6 Vĩnh Kim - Khu B', 'Xã Vĩnh Kim', 'Huyện Châu Thành'),
('82822003', 'Vùng TXNG Monthong Vĩnh Kim - Khu C', 'Xã Vĩnh Kim', 'Huyện Châu Thành'),
('82822004', 'Vùng TXNG Xuất khẩu Vĩnh Kim - Khu D', 'Xã Vĩnh Kim', 'Huyện Châu Thành');

-- =====================================================
-- 4. ĐỊA PHƯƠNG
-- =====================================================
INSERT INTO provinces (province_id, province_name) VALUES (82, 'Tiền Giang');
INSERT INTO districts (district_id, district_name, province_id) VALUES (822, 'Huyện Châu Thành', 82);
INSERT INTO wards (ward_id, ward_name, district_id) VALUES (82201, 'Xã Vĩnh Kim', 822);

-- =====================================================
-- 5. ADMIN - QUẢN TRỊ HỆ THỐNG
-- =====================================================
-- Mật khẩu: 12345678
INSERT INTO admin (admin_email, admin_name, admin_pass, role_id, province_id) VALUES
('admin.tiengiang@nckh.vn', 'Quản trị Tiền Giang', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', 9, 82);

-- =====================================================
-- 6. USERS - CÁC BÊN THAM GIA CHUỖI CUNG ỨNG
-- =====================================================
-- Mật khẩu tất cả: 12345678

-- 6.1. NÔNG DÂN (Farmers)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Nguyễn Văn Hùng', 'nvhung.farmer@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0901111001', 'Ấp 1, Xã Vĩnh Kim, Châu Thành, Tiền Giang', 'farmer1.jpg', '1980-03-15', 'male', 1, '82822001', 82, 822, 82201, TRUE),
('Trần Thị Lan', 'ttlan.farmer@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0901111002', 'Ấp 2, Xã Vĩnh Kim, Châu Thành, Tiền Giang', 'farmer2.jpg', '1985-07-20', 'female', 1, '82822002', 82, 822, 82201, TRUE),
('Lê Văn Minh', 'lvminh.farmer@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0901111003', 'Ấp 3, Xã Vĩnh Kim, Châu Thành, Tiền Giang', 'farmer3.jpg', '1978-11-10', 'male', 1, '82822003', 82, 822, 82201, TRUE);

-- 6.2. THANH TRA/KIỂM DUYỆT (Inspector)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Bùi Văn To', 'bvto.inspector@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0905555001', 'Trạm kiểm nghiệm Tiền Giang', 'inspector1.jpg', '1986-08-22', 'male', 2, '82822001', 82, 822, 82201, TRUE);

-- 6.3. NGƯỜI THU MUA (Purchasers)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Phạm Văn Thành', 'pvthanh.purchaser@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0902222001', 'Trung tâm thu mua Vĩnh Kim, Châu Thành, Tiền Giang', 'purchaser1.jpg', '1982-05-25', 'male', 3, '82822001', 82, 822, 82201, TRUE),
('Nguyễn Thị Hoa', 'nthoa.purchaser@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0902222002', 'Hợp tác xã Vĩnh Kim, Châu Thành, Tiền Giang', 'purchaser2.jpg', '1987-09-12', 'female', 3, '82822001', 82, 822, 82201, TRUE);

-- 6.4. NGƯỜI VẬN CHUYỂN (Transporters)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Hoàng Văn Tú', 'hvtu.transporter@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0903333001', 'Công ty TNHH Vận tải Tiền Giang', 'transporter1.jpg', '1988-12-08', 'male', 6, '82822001', 82, 822, 82201, TRUE),
('Võ Thị Kim', 'vtkim.transporter@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0903333002', 'Đội xe lạnh Vĩnh Kim', 'transporter2.jpg', '1990-04-18', 'female', 6, '82822001', 82, 822, 82201, TRUE);

-- 6.5. CƠ SỞ SƠ CHẾ (Processors)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Đặng Văn Nam', 'dvnam.processor@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0904444001', 'Nhà máy sơ chế Vĩnh Kim, Châu Thành, Tiền Giang', 'processor1.jpg', '1975-06-30', 'male', 4, '82822001', 82, 822, 82201, TRUE),
('Trương Thị Ngọc', 'ttngoc.processor@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0904444002', 'Xưởng đóng gói Vĩnh Kim Export', 'processor2.jpg', '1983-02-14', 'female', 4, '82822001', 82, 822, 82201, TRUE);

-- 6.6. KIỂM NGHIỆM VIÊN (Quality Inspectors)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Phan Thị Thanh', 'ptthanh.qualityinspector@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0905555002', 'Phòng kiểm định chất lượng Vĩnh Kim', 'inspector2.jpg', '1989-11-05', 'female', 5, '82822001', 82, 822, 82201, TRUE);

-- 6.7. NHÀ KHO (Warehouses)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Lý Văn Dũng', 'lvdung.warehouse@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0906666001', 'Kho lạnh Vĩnh Kim, Châu Thành, Tiền Giang', 'warehouse1.jpg', '1981-01-17', 'male', 8, '82822001', 82, 822, 82201, TRUE),
('Huỳnh Thị Mai', 'htmai.warehouse@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0906666002', 'Khu bảo quản xuất khẩu Tiền Giang', 'warehouse2.jpg', '1984-10-28', 'female', 8, '82822001', 82, 822, 82201, TRUE);

-- 6.8. NHÀ PHÂN PHỐI (Distributors)
INSERT INTO users (name, email, passwd, phone, address, avatar, dob, gender, role_id, region_id, province_id, district_id, ward_id, is_approved) VALUES
('Đinh Văn Khoa', 'dvkhoa.distributor@nckh.vn', '$2b$10$kNWD.gIKARLvubCVyhWKIeClf2it6oQl2oYnyxbI8P5BntaO4QMa2', '0907777001', 'Công ty phân phối trái cây Miền Nam', 'distributor1.jpg', '1979-03-09', 'male', 7, '82822001', 82, 822, 82201, TRUE);

-- =====================================================
-- 7. PRODUCTS - LOẠI SẢN PHẨM
-- =====================================================
INSERT INTO products (product_id, product_name, price, description, img, uses, process) VALUES
(1, 'Sầu Riêng Ri6 VietGAP', 180000, 'Sầu riêng Ri6 Vĩnh Kim chuẩn VietGAP, cơm vàng óng, hạt lép, vị béo ngọt. Xuất khẩu sang Trung Quốc, Thái Lan.', '/uploads/products/ri6_vietgap.jpg', 'Trồng tại vùng TXNG Vĩnh Kim, Tiền Giang theo tiêu chuẩn VietGAP', 'Thu hoạch chín 80%, sơ chế tiệt trùng, đóng gói chân không, bảo quản 13-15°C'),

(2, 'Sầu Riêng Monthong Premium', 220000, 'Sầu riêng Monthong lai Thái Lan, cơm dày, múi to, ngọt bùi, ít xơ. Phù hợp xuất khẩu cao cấp.', '/uploads/products/monthong_premium.jpg', 'Trồng tại vùng TXNG Vĩnh Kim theo quy trình hữu cơ', 'Tưới nhỏ giọt, bón phân hữu cơ, thu hoạch chín cây, kiểm nghiệm trước xuất khẩu'),

(3, 'Sầu Riêng Chuồng Bò Truyền Thống', 160000, 'Sầu riêng Chuồng Bò đặc sản Vĩnh Kim, múi nhỏ, vị thơm nồng, đặc trưng vùng sông nước miền Tây.', '/uploads/products/chuongbo_traditional.jpg', 'Trồng truyền thống tại Vĩnh Kim, không hóa chất', 'Chăm sóc gia đình, thu hoạch chín tự nhiên, đóng gói thủ công'),

(4, 'Sầu Riêng Chín Hóa Xuất Khẩu', 195000, 'Sầu riêng Chín Hóa - thương hiệu Vĩnh Kim, cơm vàng óng, béo ngậy, hương thơm đặc trưng đất phù sa.', '/uploads/products/chinhoa_export.jpg', 'Đặc sản vùng TXNG Vĩnh Kim, đất phù sa cổ', 'Chăm sóc thủ công, thu hoạch theo lịch âm, kiểm nghiệm chất lượng xuất khẩu');

-- =====================================================
-- 8. DEMO DATA - MỘT QUY TRÌNH HOÀN CHỈNH 7 BƯỚC
-- =====================================================

-- NOTE: Các dữ liệu blockchain sẽ được tạo tự động khi:
-- - Backend listener bắt events từ smart contract
-- - Sync vào các bảng blockchain_batches, blockchain_products, etc.

-- Dữ liệu dưới đây chỉ là DEMO để test giao diện
-- Trong thực tế, dữ liệu sẽ được tạo từ blockchain events

-- 8.1. BATCH DEMO (sẽ được thay bằng blockchain_batches)
INSERT INTO batch (id, batch_name, actor_id, created_on, approved_by, approved_on) VALUES
(1, 'Lô Ri6 Vĩnh Kim - Xuân 2025', 1, '2025-01-15 08:00:00', 2, '2025-01-15 10:00:00'),
(2, 'Lô Monthong VietGAP - Xuân 2025', 2, '2025-01-16 09:00:00', 2, '2025-01-16 11:00:00');

-- 8.2. REGISTER DEMO
INSERT INTO register (actor_id, created_on, content) VALUES
(1, '2025-01-10 08:00:00', 'Đăng ký vùng trồng Ri6 tại Ấp 1, Vĩnh Kim theo Quyết định 5272'),
(2, '2025-01-11 09:00:00', 'Đăng ký vùng trồng Monthong tại Ấp 2, Vĩnh Kim theo tiêu chuẩn VietGAP'),
(4, '2025-01-12 10:00:00', 'Đăng ký làm người thu mua tại vùng TXNG Vĩnh Kim'),
(7, '2025-01-13 11:00:00', 'Đăng ký cơ sở sơ chế đạt chuẩn HACCP tại Vĩnh Kim');

-- 8.3. NOTIFICATION DEMO
INSERT INTO notification_object (entity_type_id, entity_id, created_on) VALUES
(1, 1, '2025-01-10 08:30:00'), -- Đăng ký vùng trồng
(3, 1, '2025-01-15 08:30:00'), -- Tạo lô hàng
(4, 1, '2025-01-15 10:30:00'), -- Phê duyệt lô hàng
(6, 1, '2025-01-16 14:00:00'); -- Xác nhận thu mua

INSERT INTO notification_change (notification_object_id, actor_id) VALUES
(1, 1), (2, 1), (3, 2), (4, 4);

INSERT INTO notification (notification_object_id, admin_id, user_id, recipient_type, status, created_at) VALUES
(1, NULL, 1, 'user', 'read', '2025-01-10 08:30:00'),
(2, 2, NULL, 'admin', 'pending', '2025-01-15 08:30:00'),
(3, NULL, 1, 'user', 'sent', '2025-01-15 10:30:00'),
(4, NULL, 1, 'user', 'sent', '2025-01-16 14:00:00');

-- =====================================================
-- 9. DEMO TREES (Sẽ sync từ blockchain qua trees table)
-- =====================================================
-- NOTE: Trong production, data này sẽ được tạo tự động từ blockchain events
-- Đây chỉ là demo data cho testing

INSERT INTO trees (tree_id, tree_qr_code, farmer_id, region_id, tree_type, variety, planted_date, planted_date_iso, coordinates, is_active) VALUES
(1, 'TREE-VK-001-2020', 1, '82822001', 'Sầu riêng', 'Ri6', 1577836800, '2020-01-01 00:00:00', '10.354123, 106.234567', TRUE),
(2, 'TREE-VK-002-2020', 1, '82822001', 'Sầu riêng', 'Ri6', 1577836800, '2020-01-01 00:00:00', '10.354156, 106.234589', TRUE),
(3, 'TREE-VK-003-2019', 2, '82822002', 'Sầu riêng', 'Monthong', 1546300800, '2019-01-01 00:00:00', '10.355234, 106.235678', TRUE),
(4, 'TREE-VK-004-2019', 2, '82822002', 'Sầu riêng', 'Monthong', 1546300800, '2019-01-01 00:00:00', '10.355267, 106.235701', TRUE);

-- =====================================================
-- 10. DEMO TREE ACTIVITY LOGS
-- =====================================================
INSERT INTO tree_activity_logs (log_id, tree_id, participant_id, timestamp, timestamp_iso, category, activity_name, description, fertilizer, pesticide, is_system_activity) VALUES
(1, 1, 1, 1577836800, '2020-01-01 08:00:00', 'TreeManagement', 'Trồng cây', 'Trồng cây Ri6 tại Ấp 1, Vĩnh Kim', NULL, NULL, TRUE),
(2, 1, 1, 1609459200, '2021-01-01 09:00:00', 'Farming', 'Bón phân hữu cơ', 'Bón phân chuồng hoai mục 20kg/gốc', 'Phân chuồng bò', NULL, FALSE),
(3, 1, 1, 1640995200, '2022-01-01 10:00:00', 'Farming', 'Tưới nước', 'Tưới nhỏ giọt 2 lần/ngày', NULL, NULL, FALSE),
(4, 1, 1, 1672531200, '2023-01-01 11:00:00', 'Farming', 'Phun thuốc bảo vệ', 'Phun thuốc sinh học phòng bệnh', NULL, 'Trichoderma', FALSE);

-- =====================================================
-- 11. DEMO BLOCKCHAIN_BATCHES (Từ smart contract)
-- =====================================================
-- NOTE: Dữ liệu này sẽ được backend listener tự động sync từ blockchain
-- Khi smart contract emit BatchCreated event -> listener ghi vào bảng này

INSERT INTO blockchain_batches (
    batch_id, batch_name, sscc, producer_id, quantity, 
    production_date, production_date_iso, 
    start_date, start_date_iso, 
    end_date, end_date_iso,
    status, current_stage, product_type_id, 
    farm_plot_number, total_products
) VALUES
(1, 'Lô Ri6 Vĩnh Kim - Xuân 2025', '00000001000000001', 1, '500 kg', 
 1736899200, '2025-01-15 08:00:00', 
 1704067200, '2024-01-01 00:00:00', 
 1735660800, '2024-12-31 23:59:59',
 'Approved', 'Created', 1, 
 'Ấp 1, Lô A, Vĩnh Kim', 0);

-- =====================================================
-- 12. DEMO PURCHASE_RECORDS (Bước 2: Thu mua)
-- =====================================================
INSERT INTO purchase_records (
    purchase_id, batch_id, purchaser_id, farmer_id,
    purchase_date, purchase_date_iso,
    total_quantity, price_per_unit, total_price,
    quality_grade, notes, is_confirmed
) VALUES
(1, 1, 4, 1,
 1737052800, '2025-01-16 14:00:00',
 500, 180000, 90000000,
 'A', 'Sầu riêng đạt chuẩn VietGAP, chín 80%, không sâu bệnh', TRUE);

-- =====================================================
-- 13. DEMO TRANSPORT_EVENTS (Bước 3: Vận chuyển 1)
-- =====================================================
INSERT INTO transport_events (
    batch_id, participant_id, timestamp, timestamp_iso,
    action, participant_type, location, temperature, humidity
) VALUES
(1, 7, 1737081600, '2025-01-16 22:00:00', 'Bắt đầu vận chuyển', 'Transporter', 'Vĩnh Kim, Châu Thành', 15, 75),
(1, 7, 1737099600, '2025-01-17 03:00:00', 'Dừng nghỉ', 'Transporter', 'Trạm dừng Mỹ Tho', 16, 78),
(1, 7, 1737106800, '2025-01-17 05:00:00', 'Tiếp tục vận chuyển', 'Transporter', 'Trạm dừng Mỹ Tho', 15, 76),
(1, 7, 1737129600, '2025-01-17 11:20:00', 'Hoàn thành vận chuyển', 'Transporter', 'Nhà máy sơ chế Vĩnh Kim', 14, 74);

-- =====================================================
-- 14. DEMO PROCESSING_RECORDS (Bước 4: Sơ chế)
-- =====================================================
INSERT INTO processing_records (
    processing_id, batch_id, processor_id, 
    processing_date, processing_date_iso,
    method, method_description, 
    input_weight, output_weight, notes
) VALUES
(1, 1, 9, 
1737172800, '2025-01-17 23:20:00',
 'Washing', 'Rửa sạch bằng nước Ozone, làm khô tự nhiên',
 500, 480, 'Loại bỏ 20kg sầu riêng không đạt tiêu chuẩn');

-- =====================================================
-- 15. DEMO PROCESSING_ADDITIVES (Phụ gia sơ chế)
-- =====================================================
INSERT INTO processing_additives (processing_id, additive) VALUES
(1, 'Nước Ozone tiệt trùng'),
(1, 'Khí CO2 bảo quản');

-- =====================================================
-- 16. DEMO QUALITY_TESTS (Bước 5: Kiểm nghiệm)
-- =====================================================
INSERT INTO quality_tests (
    test_id, batch_id, inspector_id,
    test_date, test_date_iso,
    test_type, test_method, result, passed, standard, notes
) VALUES
(1, 1, 11, 
 1737187200, '2025-01-18 03:20:00',
 'Kiểm tra độ ngọt', 'Đo Brix bằng khúc xạ kế',
 'Brix: 28.5%, đạt chuẩn xuất khẩu', TRUE, 
 'VietGAP: Brix ≥ 25%', 'Mẫu lấy ngẫu nhiên 10 quả'),

(2, 1, 11,
 1737190800, '2025-01-18 04:20:00', 
 'Kiểm tra vi sinh', 'Nuôi cấy khuẩn lạc',
 'E.coli: 0 CFU/g, Salmonella: âm tính', TRUE,
 'TCVN 7705:2007', 'Đạt chuẩn an toàn thực phẩm'),

(3, 1, 12,
 1737194400, '2025-01-18 05:20:00',
 'Kiểm tra hóa học', 'Sắc ký khối phổ GC-MS', 
 'Không phát hiện thuốc trừ sâu cấm, tồn dư ≤ MRL', TRUE,
 'EU MRL Standards', 'Đạt chuẩn xuất khẩu EU');

-- =====================================================
-- 17. DEMO BLOCKCHAIN_PRODUCTS (Sản phẩm đóng gói)
-- =====================================================
-- NOTE: Dữ liệu này sync từ blockchain khi gọi createProductsInBatch()

INSERT INTO blockchain_products (
    product_id, batch_id, product_qr_code,
    packaged_date, packaged_date_iso,
    package_type, weight, is_active
) VALUES
(1, 1, 'P-00000001000000001-0001', 1737201600, '2025-01-18 07:20:00', 'Hộp carton 2kg', 2000, TRUE),
(2, 1, 'P-00000001000000001-0002', 1737201600, '2025-01-18 07:20:00', 'Hộp carton 2kg', 2000, TRUE),
(3, 1, 'P-00000001000000001-0003', 1737201600, '2025-01-18 07:20:00', 'Hộp carton 2kg', 2000, TRUE),
(4, 1, 'P-00000001000000001-0004', 1737201600, '2025-01-18 07:20:00', 'Hộp carton 3kg', 3000, TRUE),
(5, 1, 'P-00000001000000001-0005', 1737201600, '2025-01-18 07:20:00', 'Hộp carton 3kg', 3000, TRUE);

-- =====================================================
-- 18. DEMO PRODUCT_SOURCE_TREES (Liên kết cây nguồn)
-- =====================================================
INSERT INTO product_source_trees (product_id, tree_id) VALUES
(1, 1), (1, 2), -- Product 1 từ cây 1 và 2
(2, 1), (2, 2),
(3, 1), 
(4, 2), (4, 1),
(5, 2);

-- =====================================================
-- 19. DEMO TREE_BATCH_LINKS (Thu hoạch)
-- =====================================================
INSERT INTO tree_batch_links (tree_id, batch_id, harvest_date, harvest_date_iso, harvest_notes) VALUES
(1, 1, 1736956800, '2025-01-15 16:00:00', 'Thu hoạch 50kg sầu riêng Ri6 chín 80%'),
(2, 1, 1736956800, '2025-01-15 16:00:00', 'Thu hoạch 45kg sầu riêng Ri6 chín 80%');

-- =====================================================
-- 20. DEMO TRANSPORT_EVENTS (Bước 5: Vận chuyển 2)
-- =====================================================
-- Vận chuyển từ nhà máy sơ chế đến kho
INSERT INTO transport_events (
    batch_id, participant_id, timestamp, timestamp_iso,
    action, participant_type, location, temperature, humidity
) VALUES
(1, 8, 1737216000, '2025-01-18 11:20:00', 'Bắt đầu vận chuyển đến kho', 'Transporter', 'Nhà máy sơ chế Vĩnh Kim', 13, 72),
(1, 8, 1737230400, '2025-01-18 15:20:00', 'Checkpoint GPS 1', 'Transporter', 'QL1A, Km 85', 14, 73),
(1, 8, 1737244800, '2025-01-18 19:20:00', 'Checkpoint GPS 2', 'Transporter', 'Ngã 3 Cần Thơ', 13, 71),
(1, 8, 1737259200, '2025-01-18 23:20:00', 'Đến kho lạnh', 'Transporter', 'Kho lạnh Vĩnh Kim', 12, 70);

-- =====================================================
-- 21. DEMO WAREHOUSE_CONFIRMATIONS (Bước 6: Xác nhận kho)
-- =====================================================
INSERT INTO warehouse_confirmations (batch_id, warehouse_id, confirmed_at) VALUES
(1, 13, '2025-01-18 23:30:00');

-- =====================================================
-- 22. DEMO BATCH_ACTIVITY_LOGS (Nhật ký hệ thống)
-- =====================================================
-- NOTE: Dữ liệu này sync từ blockchain events
INSERT INTO batch_activity_logs (
    log_id, batch_id, participant_id, 
    timestamp, timestamp_iso,
    category, activity_name, description, is_system_activity
) VALUES
(101, 1, 1, 1736899200, '2025-01-15 08:00:00', 'Farming', 'Tạo lô hàng', 'Tạo lô hàng Ri6 Vĩnh Kim', TRUE),
(102, 1, 2, 1736906400, '2025-01-15 10:00:00', 'Farming', 'Phê duyệt lô hàng', 'Lô hàng đạt chuẩn VietGAP', TRUE),
(103, 1, 4, 1737052800, '2025-01-16 14:00:00', 'Purchase', 'Xác nhận thu mua', 'Thu mua 500kg sầu riêng Ri6', TRUE),
(104, 1, 7, 1737081600, '2025-01-16 22:00:00', 'Transport', 'Bắt đầu vận chuyển', 'Vận chuyển từ vườn đến nhà máy', TRUE),
(105, 1, 9, 1737172800, '2025-01-17 23:20:00', 'Processing', 'Hoàn thành sơ chế', 'Sơ chế và đóng gói 480kg', TRUE),
(106, 1, 11, 1737194400, '2025-01-18 05:20:00', 'QualityControl', 'Kiểm nghiệm đạt', 'Đạt chuẩn xuất khẩu', TRUE),
(107, 1, 8, 1737259200, '2025-01-18 23:20:00', 'Transport', 'Vận chuyển đến kho', 'Vận chuyển từ nhà máy đến kho', TRUE),
(108, 1, 13, 1737259800, '2025-01-18 23:30:00', 'Warehouse', 'Xác nhận nhận hàng', 'Kho xác nhận nhận 480kg', TRUE);

-- =====================================================
-- 23. DEMO BATCH_PRODUCT_IMAGES (Ảnh sản phẩm)
-- =====================================================
INSERT INTO batch_product_images (batch_id, image_url, image_order) VALUES
(1, '/uploads/batches/batch1_image1.jpg', 1),
(1, '/uploads/batches/batch1_image2.jpg', 2),
(1, '/uploads/batches/batch1_image3.jpg', 3);

-- =====================================================
-- 24. DEMO PURCHASE_IMAGES (Ảnh thu mua)
-- =====================================================
INSERT INTO purchase_images (purchase_id, image_url) VALUES
(1, '/uploads/purchases/purchase1_img1.jpg'),
(1, '/uploads/purchases/purchase1_img2.jpg');

-- =====================================================
-- 25. DEMO PROCESSING_IMAGES (Ảnh sơ chế)
-- =====================================================
INSERT INTO processing_images (processing_id, image_url) VALUES
(1, '/uploads/processing/proc1_washing.jpg'),
(1, '/uploads/processing/proc1_drying.jpg'),
(1, '/uploads/processing/proc1_packaging.jpg');

-- =====================================================
-- 26. DEMO QUALITY_TEST_IMAGES (Ảnh kiểm nghiệm)
-- =====================================================
INSERT INTO quality_test_images (test_id, image_url) VALUES
(1, '/uploads/quality/test1_brix_meter.jpg'),
(2, '/uploads/quality/test2_microbiology.jpg'),
(3, '/uploads/quality/test3_pesticide_result.jpg');

-- =====================================================
-- 27. DEMO TREE_ACTIVITY_IMAGES (Ảnh chăm sóc cây)
-- =====================================================
INSERT INTO tree_activity_images (log_id, image_url) VALUES
(2, '/uploads/trees/fertilizer_organic.jpg'),
(3, '/uploads/trees/drip_irrigation.jpg'),
(4, '/uploads/trees/bio_pesticide_spray.jpg');

-- =====================================================
-- 28. UPDATE BLOCKCHAIN_BATCHES STAGE
-- =====================================================
-- Cập nhật trạng thái lô hàng sau khi hoàn thành các bước
UPDATE blockchain_batches 
SET current_stage = 'Warehoused',
    transport_status = 'Delivered',
    detailed_transport_status = 'Delivered',
    purchaser_id = 4,
    processor_id = 9,
    quality_inspector_id = 11,
    last_transporter_id = 8,
    total_products = 5
WHERE batch_id = 1;

-- =====================================================
-- 29. BLOCKCHAIN SYNC STATUS
-- =====================================================
-- Khởi tạo trạng thái sync blockchain
UPDATE blockchain_sync_status 
SET last_synced_block = 0,
    total_blocks_synced = 0,
    total_events_synced = 0,
    last_sync_at = NOW(),
    is_syncing = FALSE
WHERE id = 1;

-- =====================================================
-- COMPLETED INSERT SCRIPT
-- =====================================================
-- Script này tạo DEMO DATA hoàn chỉnh cho quy trình 7 bước:
--
-- 1. ✅ Nông dân tạo lô hàng (Batch Created)
-- 2. ✅ Thu mua xác nhận (Purchase Confirmed)
-- 3. ✅ Vận chuyển 1 (Transport to Processor)
-- 4. ✅ Sơ chế + Đóng gói (Processing Completed)
-- 5. ✅ Kiểm nghiệm (Quality Tests Passed)
-- 6. ✅ Vận chuyển 2 (Transport to Warehouse)
-- 7. ✅ Kho xác nhận (Warehouse Confirmed)
--
-- Người tiêu dùng có thể quét QR code của product để xem:
-- - Thông tin cây nguồn gốc (trees)
-- - Lịch sử chăm sóc (tree_activity_logs)
-- - Thông tin lô hàng (blockchain_batches)
-- - Thu mua (purchase_records)
-- - Vận chuyển (transport_events)
-- - Sơ chế (processing_records)
-- - Kiểm nghiệm (quality_tests)
-- - Kho bãi (warehouse_confirmations)
--
-- =====================================================