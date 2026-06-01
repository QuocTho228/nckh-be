# Dự Án Truy Xuất Nguồn Gốc Sầu Riêng Bằng Blockchain

## Giới Thiệu

Dự án này là một hệ thống truy xuất nguồn gốc sầu riêng sử dụng công nghệ blockchain Ethereum. Hệ thống giúp quản lý quy trình sản xuất, kiểm định, chứng nhận chất lượng, và truy xuất nguồn gốc sản phẩm thông qua mã QR. Mục tiêu chính là tăng cường tính minh bạch và đáng tin cậy trong chuỗi cung ứng sầu riêng.

## Công Nghệ Sử Dụng

- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Blockchain**: Solidity (for smart contracts)
- **Ethereum**: Ethereum (for blockchain network)
- **Authentication**: JWT, Session-based (express-session)
- **Chat & notification**: Socket.io
- **Other**: Web3.js, Multer (file upload), Nodemailer (email verification)
- **Tools**: Truffle, Ganache, MetaMask
- **Storage**: Firebase, AWS S3, IPFS Filebase
- **Testnet** : Sepolia

## Chức Năng Chính

### 1. Quản lý Người Dùng

- Đăng ký tài khoản (nông dân, nhà kiểm duyệt)
- Đăng nhập/Đăng xuất
- Xác minh email
- Quản lý thông tin cá nhân

### 2. Quản lý Lô Sầu Riêng (Nông Dân)

- Tạo lô sầu riêng mới
- Cập nhật thông tin lô sầu riêng
- Xem danh sách lô sầu riêng
- Gửi yêu cầu kiểm định

### 3. Kiểm Định và Chứng Nhận (Nhà Kiểm Duyệt)

- Xem danh sách yêu cầu kiểm định
- Xác minh thông tin và kiểm định chất lượng
- Phê duyệt hoặc từ chối lô sầu riêng
- Cấp chứng nhận chất lượng

### 4. Truy Xuất Nguồn Gốc (Người Tiêu Dùng)

- Quét mã QR để xem thông tin sản phẩm
- Xem chi tiết về nguồn gốc và chất lượng sản phẩm
- Gửi đánh giá và phản hồi

### 5. Quản lý Hoạt Động

- Ghi nhận các hoạt động liên quan đến lô hàng
- Xem nhật ký hoạt động

## Cài Đặt và Chạy Dự Án

1. Clone dự án:

   ```sh
   git clone
   cd nckh-be
   ```

2. Cài đặt dependencies:

   ```sh
   nvm use 18.20.8
   npm install
   ```

3. Cấu hình môi trường:
   - Tạo file `.env` trong thư mục gốc và cấu hình các biến môi trường:

   ```sh
   DB_HOST=
   DB_USER=
   DB_PASSWORD=
   DB_DATABASE=
   SESSION_SECRET=
   PRIVATE_KEY=
   ALCHEMY_API_KEY=
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   BUCKET_NAME=
   # Ganache CLI: Su dung private key cua tai khoan dau tien de trien khai hop dong
   OWNER_PRIVATE_KEY=
   #Deploy on truffle migrate --network development
   #contract address: Deploying 'ActivityLogContract'
   ACTIVITY_LOG_CONTRACT_ADDRESS=
   #contract address: Deploying 'TraceabilityContract'
   TRACEABILITY_CONTRACT_ADDRESS=
   #contract address: Deploying 'CorrectionContract'
   CORRECTION_CONTRACT_ADDRESS=
   NODE_ENV=development
   BASE_URL=http://localhost:3000
   REDIS_URL=redis://localhost:6379
   FIREBASE_ADMIN_TYPE=
   FIREBASE_ADMIN_PROJECT_ID=
   FIREBASE_ADMIN_PRIVATE_KEY_ID=
   FIREBASE_ADMIN_PRIVATE_KEY=
   FIREBASE_ADMIN_CLIENT_EMAIL=
   FIREBASE_ADMIN_CLIENT_ID=
   FIREBASE_ADMIN_AUTH_URI=https://accounts.google.com/o/oauth2/auth
   FIREBASE_ADMIN_TOKEN_URI=https://oauth2.googleapis.com/token
   FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
   FIREBASE_ADMIN_CLIENT_X509_CERT_URL=
   FIREBASE_API_KEY=
   FIREBASE_AUTH_DOMAIN=
   FIREBASE_PROJECT_ID=
   FIREBASE_STORAGE_BUCKET=
   FIREBASE_MESSAGING_SENDER_ID=
   FIREBASE_APP_ID=
   FIREBASE_MEASUREMENT_ID=
   ```

4. Khởi tạo cơ sở dữ liệu:
   - Tạo database MySQL
   - Import schema từ file `database.sql` (nếu có)

5. Terminal
   - Khởi chạy ganache không lưu dữ liệu:
     `ganache --gasLimit 1000000000 --defaultBalanceEther 1000`

   - Khởi chạy ganache có lưu dữ liệu trên blockchain:
     `ganache --gasLimit 1000000000 --defaultBalanceEther 1000 --deterministic --db ./ganache-data`

6. Triển khai smart contract:
   - Cài đặt Truffle: `npm install -g truffle`
   - Di chuyển vào thư mục blockchain: `cd blockchain`
   - Triển khai contract: `truffle migrate --network <your_network>`

7. Lấy 4 giá trị:
   - PRIVATE_KEY tai khoan dau tien
   - contract address: Deploying 'ActivityLogContract'
   - contract address: Deploying 'TraceabilityContract'
   - contract address: Deploying 'CorrectionContract'
   - Dán vào `.env`

8. Mở terminal
   - khởi chạy server redis: `redis-server`

9. Chạy dự án:

- Môi trường phát triển: `npm run dev`
- Môi trường sản xuất: `npm start`

## Cấu Trúc Dự Án

```
.
├── .babelrc
├── .gitignore
├── .vscode/
├── blockchain/
│   ├── build/
│   │   └── contracts/
│   │       ├── ActivityLog.json
│   │       └── TraceabilityContract.json
│   ├── contracts/
│   │   ├── .gitkeep
│   │   ├── ActivityLog.sol
│   │   └── supplychain.sol
│   ├── migrations/
│   │   ├── .gitkeep
│   │   ├── 2_deploy_contracts.js
│   │   └── 3_deploy_contracts.js
│   ├── src/
│   │   ├── app.js
│   │   ├── backend.js
│   │   ├── blockchainLogger.js
│   │   ├── components/
│   │   │   ├── tieu-dung/
│   │   │   │   └── trang-chu.js
│   │   │   └── user/
│   │   │       ├── batch/
│   │   │       │   └── createBatch.js
│   │   │       ├── dangky.js
│   │   │       ├── dangnhap.js
│   │   │       ├── data.json
│   │   │       └── sendmail.js
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   └── redis.js
│   │   ├── database/
│   │   │   ├── blockchain_schema.sql
│   │   │   └── data.sql
│   │   ├── firebase.js
│   │   ├── manage.js
│   │   ├── middleware/
│   │   │   └── roleAuth.js
│   │   ├── notification.js
│   │   ├── public/
│   │   │   ├── account/
│   │   │   │   ├── dangky.html
│   │   │   │   ├── dangnhap.html
│   │   │   │   ├── quenmatkhau.html
│   │   │   │   └── xacthuc.html
│   │   │   ├── admin/
│   │   │   │   ├── addadmin.html
│   │   │   │   ├── addproduct.html
│   │   │   │   ├── addregion.html
│   │   │   │   ├── admintest.html
│   │   │   │   ├── caidat.html
│   │   │   │   ├── css/
│   │   │   │   │   ├── animation.css
│   │   │   │   │   ├── header.css
│   │   │   │   │   ├── main.css
│   │   │   │   │   ├── reply.css
│   │   │   │   │   ├── responsive.css
│   │   │   │   │   ├── stat.css
│   │   │   │   │   ├── style.css
│   │   │   │   │   └── theme.css
│   │   │   │   ├── editproduct.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── addregion.js
│   │   │   │   │   ├── admin-auth.js
│   │   │   │   │   ├── admin.js
│   │   │   │   │   ├── editproduct.js
│   │   │   │   │   ├── feature.js
│   │   │   │   │   ├── product.js
│   │   │   │   │   ├── region.js
│   │   │   │   │   ├── reply.js
│   │   │   │   │   ├── settings.js
│   │   │   │   │   ├── stats.js
│   │   │   │   │   ├── unread-count.js
│   │   │   │   │   └── user.js
│   │   │   │   ├── product.html
│   │   │   │   ├── region.html
│   │   │   │   ├── reply.html
│   │   │   │   ├── stats.html
│   │   │   │   └── user.html
│   │   │   ├── assets/
│   │   │   │   ├── data/
│   │   │   │   │   └── categories.json
│   │   │   │   ├── images/
│   │   │   │   │   ├── icons/
│   │   │   │   │   └── logo.png
│   │   │   ├── chatbox/
│   │   │   │   └── chatbox.js
│   │   │   ├── css/
│   │   │   │   ├── card.css
│   │   │   │   ├── chatbox.css
│   │   │   │   ├── footer.css
│   │   │   │   ├── lo-hang.css
│   │   │   │   ├── nav-bar.css
│   │   │   │   ├── nav-bar2.css
│   │   │   │   ├── nha-kho.css
│   │   │   │   ├── nhakiemduyet.css
│   │   │   │   ├── profile.css
│   │   │   │   ├── san-xuat.css
│   │   │   │   ├── sanpham.css
│   │   │   │   └── style.css
│   │   │   ├── distributor/
│   │   │   │   ├── index.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── dashboard.js
│   │   │   │   │   ├── product-list.js
│   │   │   │   │   ├── sales-history.js
│   │   │   │   │   ├── scan-sell-enhanced.js
│   │   │   │   │   └── scan-sell.js
│   │   │   │   ├── lich-su-ban.html
│   │   │   │   ├── san-pham-co-san.html
│   │   │   │   └── scan-ban-hang.html
│   │   │   ├── farmer/
│   │   │   │   ├── chi-tiet-lo.html
│   │   │   │   ├── css/
│   │   │   │   │   └── farmer.css
│   │   │   │   ├── index.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── batch-creator.js
│   │   │   │   │   ├── batch-detail.js
│   │   │   │   │   ├── dashboard.js
│   │   │   │   │   ├── qr-scanner.js
│   │   │   │   │   ├── tree-form.js
│   │   │   │   │   └── tree-manager.js
│   │   │   │   ├── quan-ly-cay.html
│   │   │   │   └── tao-lo-hang.html
│   │   │   ├── government/
│   │   │   │   ├── quan-ly-tem-qr.html
│   │   │   │   └── quan-ly-tem-qr.js
│   │   │   ├── hinhanh/
│   │   │   ├── inspector/
│   │   │   │   ├── danh-sach-lo.html
│   │   │   │   ├── index.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── approval-form.js
│   │   │   │   │   ├── batch-list.js
│   │   │   │   │   └── dashboard.js
│   │   │   │   └── phe-duyet-lo.html
│   │   │   ├── kiem-duyet/
│   │   │   │   ├── nhakiemduyet.html
│   │   │   │   └── thongbaoNKD.html
│   │   │   ├── nha-kho/
│   │   │   │   ├── nha-kho.html
│   │   │   │   └── nha-kho.js
│   │   │   ├── processor/
│   │   │   │   ├── danh-sach-lo-can-so-che.html
│   │   │   │   ├── danh-sach-san-pham.html
│   │   │   │   ├── dong-goi-san-pham.html
│   │   │   │   ├── ghi-nhan-so-che.html
│   │   │   │   ├── index.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── batch-list.js
│   │   │   │   │   ├── dashboard.js
│   │   │   │   │   ├── packaging-form.js
│   │   │   │   │   ├── processing-form.js
│   │   │   │   │   └── product-list.js
│   │   │   │   └── lich-su-so-che.html
│   │   │   ├── purchaser/
│   │   │   │   ├── danh-sach-lo-duyet.html
│   │   │   │   ├── ghi-nhan-mua.html
│   │   │   │   ├── index.html
│   │   │   │   └── lich-su-mua.html
│   │   │   ├── quality-inspector/
│   │   │   │   ├── danh-sach-lo-can-kiem.html
│   │   │   │   ├── ghi-nhan-test.html
│   │   │   │   ├── index.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── batch-list.js
│   │   │   │   │   ├── dashboard.js
│   │   │   │   │   └── test-form.js
│   │   │   │   └── lich-su-test.html
│   │   │   ├── san-xuat/
│   │   │   │   ├── nhatky-hoatdong.html
│   │   │   │   ├── sanxuat.html
│   │   │   │   ├── them-lo-hang.html
│   │   │   │   ├── thongbao-pheduyet.html
│   │   │   │   └── thongbao-tuchoi.html
│   │   │   ├── shared/
│   │   │   │   ├── components/
│   │   │   │   │   ├── loading.html
│   │   │   │   │   └── navbar.html
│   │   │   │   ├── css/
│   │   │   │   │   ├── reset.css
│   │   │   │   │   └── theme.css
│   │   │   │   └── js/
│   │   │   │       ├── api.js
│   │   │   │       ├── auth.js
│   │   │   │       ├── config.js
│   │   │   │       ├── durian-ai.js
│   │   │   │       └── utils.js
│   │   │   ├── tieu-dung/
│   │   │   │   ├── allnhakiemduyet.html
│   │   │   │   ├── allnongdan.html
│   │   │   │   ├── allsanpham.html
│   │   │   │   ├── batch-direct.html
│   │   │   │   ├── cay-nguon-goc.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── cay-nguon-goc.js
│   │   │   │   │   ├── loaditem.js
│   │   │   │   │   ├── nav-bar.js
│   │   │   │   │   ├── profile.js
│   │   │   │   │   ├── san-xuat.js
│   │   │   │   │   ├── sanpham.js
│   │   │   │   │   ├── thongbaoNKD.js
│   │   │   │   │   ├── thongbaoNSX.js
│   │   │   │   │   ├── truy-xuat-camera.js
│   │   │   │   │   └── truy-xuat.js
│   │   │   │   ├── lo-hang.html
│   │   │   │   ├── sanpham.html
│   │   │   │   ├── trangcanhan.html
│   │   │   │   ├── trangchu.html
│   │   │   │   └── truy-xuat.html
│   │   │   ├── trangcanhan_caidat.html
│   │   │   ├── transporter/
│   │   │   │   ├── cap-nhat-trang-thai.html
│   │   │   │   ├── danh-sach-lo-can-van.html
│   │   │   │   ├── index.html
│   │   │   │   ├── js/
│   │   │   │   │   ├── dashboard.js
│   │   │   │   │   ├── status-update.js
│   │   │   │   │   └── transport-list.js
│   │   │   ├── van-chuyen/
│   │   │   │   ├── van-chuyen.html
│   │   │   │   └── van-chuyen.js
│   │   │   └── warehouse/
│   │   │       ├── index.html
│   │   │       ├── js/
│   │   │       │   ├── confirm-receipt.js
│   │   │       │   ├── dashboard.js
│   │   │       │   └── incoming-list.js
│   │   │       ├── lo-dang-den.html
│   │   │       ├── ton-kho.html
│   │   │       └── xac-nhan-nhan-hang.html
│   │   ├── scripts/
│   │   │   ├── resetLogger.js
│   │   │   ├── setupDatabase.js
│   │   │   ├── showStats.js
│   │   │   ├── testLogger.js
│   │   │   └── verifyChain.js
│   │   ├── templates/
│   │   │   ├── password-changed-confirmation.html
│   │   │   └── reset-password.html
│   │   ├── util.js
│   │   └── websocket.js
│   └── truffle-config.js
├── brcypt.js
├── docker-compose.yml
├── Dockerfile
├── nginx/
│   └── nginx.conf
├── nginx.conf
├── package-lock.json
├── package.json
├── Procfile
├── README.md
├── SECURITY.md
├── truffle-config.js
└── webpack.config.js
```

## API Endpoints

- `/api/register`: Đăng ký người dùng mới
- `/api/login`: Đăng nhập
- `/api/logout`: Đăng xuất
- `/api/batches`: CRUD operations cho lô hàng
- `/api/inspection`: Yêu cầu và xử lý kiểm định
- `/api/qr`: Tạo và quét mã QR
- `/api/activities`: Quản lý nhật ký hoạt động
- `/api/products`: Lấy danh sách sản phẩm

## Quy Trình Làm Việc

1. Nông dân đăng ký tài khoản và đăng nhập.
2. Nông dân tạo lô sầu riêng mới và nhập thông tin chi tiết.
3. Nông dân gửi yêu cầu kiểm định cho lô sầu riêng.
4. Nhà kiểm duyệt đăng nhập và xem danh sách yêu cầu kiểm định.
5. Nhà kiểm duyệt thực hiện kiểm định và cập nhật kết quả.
6. Nếu được phê duyệt, hệ thống tạo mã QR cho lô sầu riêng.
7. Người vận chuyển quét mã QR để bắt đầu vận chuyển.
8. Sau khi vận chuyển hàng thành công, nhà kho sẽ tiếp nhận đơn hàng.
9. Nhà kho quét mã QR để tiếp nhận đơn hàng.
10. Người tiêu dùng quét mã QR để xem thông tin và đánh giá sản phẩm.

## Bảo Mật

- Sử dụng bcrypt để mã hóa mật khẩu
- Xác thực người dùng thông qua session
- Sử dụng HTTPS cho môi trường sản xuất
- Xử lý và validate input từ người dùng

## Đóng Góp

Nếu bạn muốn đóng góp vào dự án, vui lòng tạo pull request hoặc báo cáo issues trên GitHub.
