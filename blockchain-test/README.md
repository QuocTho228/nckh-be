## Cấu trúc thư mục

```
blockchain-test/               ← Thư mục này (thêm vào root project)
├── contracts/test/
│   ├── MaliciousReentrancy.sol
│   └── MaliciousInteraction.sol
├── test/
│   ├── performance/
│   │   ├── write-performance.test.js       ✍️  Đo tốc độ ghi blockchain
│   │   ├── read-performance.test.js        📖  Đo tốc độ đọc/truy xuất
│   │   └── load-test.test.js               💥  Kiểm thử tải cao
│   ├── security/
│   │   ├── access-control.test.js          🔐  Kiểm soát truy cập
│   │   ├── data-integrity.test.js          🔒  Tính bất biến dữ liệu
│   │   ├── overflow-underflow.test.js      🔢  Tràn số nguyên
│   │   └── timestamp-manipulation.test.js  ⏰  Thao túng timestamp
│   ├── attacks/
│   │   ├── data-manipulation.test.js       🎭  Giả mạo dữ liệu
│   │   ├── dos-attack.test.js              💣  Tấn công DoS
│   │   └── frontrunning.test.js            🏃  Front-running
│   └── scalability/
│       └── large-dataset.test.js           📈  Kiểm thử dữ liệu lớn
├── scripts/
│   ├── run-all-tests.js                    🚀  Chạy toàn bộ
│   └── analyze-gas.js                      ⛽  Phân tích chi phí gas
└── test-results/                           📊  Kết quả (auto-generated)
```

---

## BƯỚC 1: Chuẩn bị môi trường

### 1.1 Cài đặt dependencies

```bash
# Tại root project
npm install

# Cài ganache CLI toàn cục (nếu chưa có)
npm install -g ganache
```

### 1.2 Copy thư mục blockchain-test vào project

```
your-project/
├── blockchain/
│   ├── contracts/
│   │   ├── ActivityLog.sol
│   │   └── supplychain.sol
│   └── build/                    ← Cần compile trước
├── blockchain-test/              ← ✅ Thêm thư mục này vào đây
├── package.json
└── truffle-config.js
```

---

## BƯỚC 2: Compile Contracts

```bash
# Đảm bảo contracts đã được compile
cd blockchain
truffle compile

# Kiểm tra file ABI đã tồn tại
ls build/contracts/
# → ActivityLog.json
# → TraceabilityContract.json
```

---

## BƯỚC 3: Khởi động Ganache

Mở terminal riêng và chạy:

```bash
# Từ root project
ganache \
  --gasLimit 1000000000 \
  --defaultBalanceEther 1000 \
  --deterministic \
  --db ./ganache-data

# Output sẽ hiển thị:
# Ganache CLI v7.x
# Accounts: 10 accounts với 1000 ETH mỗi tài khoản
# Listening on 127.0.0.1:8545
```

**Kiểm tra Ganache đang chạy:**

```bash
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## BƯỚC 4: Cài đặt dependencies cho test suite

```bash
cd blockchain-test
npm install
```

---

## BƯỚC 5: Chạy kiểm thử

### 5.1 Chạy toàn bộ (khuyến nghị)

```bash
cd blockchain-test
node scripts/run-all-tests.js
```

### 5.2 Chạy từng category

```bash
# Chỉ chạy performance tests
node scripts/run-all-tests.js --only=performance

# Chỉ chạy security tests
node scripts/run-all-tests.js --only=security

# Chỉ chạy attack tests
node scripts/run-all-tests.js --only=attacks

# Chỉ chạy scalability tests
node scripts/run-all-tests.js --only=scalability
```

### 5.3 Chạy từng test riêng lẻ

```bash
# Performance
node test/performance/write-performance.test.js
node test/performance/read-performance.test.js
node test/performance/load-test.test.js

# Security
node test/security/access-control.test.js
node test/security/data-integrity.test.js
node test/security/overflow-underflow.test.js
node test/security/timestamp-manipulation.test.js

# Attacks
node test/attacks/data-manipulation.test.js
node test/attacks/dos-attack.test.js
node test/attacks/frontrunning.test.js

# Scalability
node test/scalability/large-dataset.test.js

# Gas analysis
node scripts/analyze-gas.js
```

---

## BƯỚC 6: Đọc kết quả

### Kết quả trong terminal

Mỗi test hiển thị màu:

- ✅ **PASS** (xanh) = An toàn / Đạt
- ❌ **FAIL** (đỏ) = Lỗ hổng / Không đạt
- ⚠️ **WARN** (vàng) = Cảnh báo cần xem xét

### File kết quả JSON

```
test-results/
├── write-performance.json
├── read-performance.json
├── load-test.json
├── access-control.json
├── data-integrity.json
├── overflow-underflow.json
├── timestamp-manipulation.json
├── data-manipulation-attack.json
├── dos-attack.json
├── frontrunning-attack.json
├── large-dataset.json
├── gas-analysis.json
├── final-report.json     ← Tổng hợp tất cả
└── report.html           ← Báo cáo dạng web
```

### Xem báo cáo HTML

```bash
# Mở report.html trong browser
# Windows:
start test-results/report.html

# Mac:
open test-results/report.html

# Linux:
xdg-open test-results/report.html
```

---

## Ý nghĩa từng bộ kiểm thử

### 📊 PERFORMANCE TESTS

| Test              | Mục tiêu                          | KPI Tốt     |
| ----------------- | --------------------------------- | ----------- |
| Write Performance | Đo thời gian mỗi tx ghi lên chain | < 500ms avg |
| Read Performance  | Đo thời gian query dữ liệu        | < 50ms avg  |
| Load Test         | TPS (giao dịch/giây) dưới tải     | > 5 TPS     |

**Kết quả mẫu:**

```
createBatch    : 250ms avg | 180,000 gas
addActivityLog :  80ms avg |  70,000 gas
getBatchDetails:   5ms avg | (view - free)
```

### 🔐 SECURITY TESTS

| Test               | Kiểm thử                     |
| ------------------ | ---------------------------- |
| Access Control     | Ai được làm gì - phân quyền  |
| Data Integrity     | Dữ liệu bất biến sau khi ghi |
| Overflow/Underflow | Tràn số Solidity 0.8.x       |
| Timestamp          | Miner không thể backdating   |

### 💥 ATTACK TESTS

| Tấn công          | Mô tả                        | Hậu quả nếu fail    |
| ----------------- | ---------------------------- | ------------------- |
| Data Manipulation | Giả mạo nguồn gốc, injection | Hàng nhái vào chuỗi |
| DoS Attack        | Spam tx, block stuffing      | Hệ thống chậm/nghẽn |
| Front-running     | Snipe SSCC trước farmer      | SSCC bị chiếm       |

### 📈 SCALABILITY TESTS

Đo hiệu năng khi:

- 100+ batches
- 500+ activity logs
- Dự báo hiệu năng cho 1000-10000 batches

---

## Lỗi thường gặp & cách xử lý

### ❌ "Ganache chưa chạy"

```bash
# Đảm bảo Ganache đang chạy trên port 8545
ganache --gasLimit 1000000000 --deterministic --db ./ganache-data
```

### ❌ "ABI không tồn tại"

```bash
cd blockchain
truffle compile
# Đảm bảo TraceabilityContract.json được tạo (đúng tên contract)
```

### ❌ "out of gas"

```bash
# Tăng gas limit trong Ganache
ganache --gasLimit 10000000000 ...
```

### ❌ Timeout

```bash
# Ganache chạy trên máy chậm → tăng timeout trong scripts
# Sửa timeout: 300000 → 600000 (10 phút) trong run-all-tests.js
```

### ❌ "Cannot find module 'web3'"

```bash
cd blockchain-test
npm install web3
```

---

## Cấu trúc ABI cần thiết

Các function được test phải tồn tại trong ABI:

**ActivityLog.sol:**

- `registerTree(qrCode, farmerId, regionId, treeType, variety, coordinates)`
- `addTreeCareActivity(treeId, farmerId, category, activityName, description)`
- `addActivityLog(batchId, participantId, activityName, description, isSystemActivity)`
- `addDetailedActivityLog(batchId, participantId, category, activityName, description, isSystemActivity)`
- `addActivityLogMetadata(...)`
- `deactivateTree(treeId, farmerId, reason)`
- `getTreeDetails(treeId)`, `getTreeByQRCode(qrCode)`, `getFarmerTrees(farmerId)`
- `getActivityLogs(batchId)`, `verifyActivityDataHash(...)`

**TraceabilityContract.sol:**

- `createBatch(sscc, producerId, productTypeId, name, quantity, startDate, endDate, farmPlotNumber)`
- `approveBatch(batchId, producerId)`, `rejectBatch(batchId, producerId, reason)`
- `recordPurchase(batchId, purchaserId, farmerId, totalQuantity, pricePerUnit, totalPrice)`
- `startTransport(batchId, transporterId, temperature, humidity)`
- `completeTransport(batchId, transporterId, temperature, humidity)`
- `recordProcessing(batchId, processorId, method, inputWeight, outputWeight)`
- `recordQualityTest(batchId, inspectorId, passed, resultHash)`
- `createProduct(batchId, governmentQRCode, weight)`
- `confirmWarehouseReceipt(batchId, warehouseId)`
- `getBatchDetails(batchId)`, `getBatchBySSCC(sscc)`, `getBatchesByStage(stage)`
- `getAllPendingBatches()`, `verifyBatchDataHash(...)`

---

## Tích hợp vào CI/CD (GitHub Actions)

```yaml
# .github/workflows/blockchain-test.yml
name: Blockchain Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm install

      - name: Start Ganache
        run: |
          npm install -g ganache
          ganache --gasLimit 1000000000 --deterministic &
          sleep 3

      - name: Compile contracts
        run: cd blockchain && npx truffle compile

      - name: Run blockchain tests
        run: cd blockchain-test && node scripts/run-all-tests.js --only=security

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: blockchain-test/test-results/
```
