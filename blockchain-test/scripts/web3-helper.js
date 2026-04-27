/**
 * web3-helper.js  —  Web3 v4.x  (contracts thực tế)
 *
 * THAY ĐỔI SO VỚI PHIÊN BẢN CŨ:
 *   - Thêm getBatchIdsByStage / getBatchIdsByProducer / getPendingIds   ← IDs only
 *   - Thêm getBatchesByStagesPaged / getBatchesByProducerPaged           ← pagination
 *   - Thêm getBatchSummariesByStage                                      ← summary fields
 *   - Thêm fetchBatchDetails (parallel getBatchDetails cho mảng IDs)
 *
 * API HIERARCHY (nhanh nhất → chậm nhất):
 *   1. getBatchCountByStage / getBatchCountByStatus             O(1) count — ~1ms
 *   2. getBatchIdsByStage / getPendingIds                       IDs only  — ~5ms/1000
 *   3. getBatchSummariesByStage (5 fields, paginated)           ~5ms/50
 *   4. getBatchesByStagesPaged (đầy đủ Batch, paginated)        ~10ms/50
 *   5. getBatchesByStage [LEGACY] (không dùng khi >100 batch)   ~15s/1000 ← TRÁNH
 */

const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");

const GANACHE_URL = "http://127.0.0.1:8545";

function getWeb3() {
  return new Web3(GANACHE_URL);
}

function loadABI(name) {
  const roots = [
    path.join(__dirname, "../blockchain/build/contracts"),
    path.join(__dirname, "../../blockchain/build/contracts"),
    path.join(process.cwd(), "blockchain/build/contracts"),
  ];
  for (const r of roots) {
    const p = path.join(r, `${name}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  throw new Error(
    `ABI không tìm thấy: ${name}.json  →  cd blockchain && truffle compile`,
  );
}

async function deployContracts(web3, owner) {
  const alABI = loadABI("ActivityLog");
  const tcABI = loadABI("TraceabilityContract");
  const al = await new web3.eth.Contract(alABI.abi)
    .deploy({ data: alABI.bytecode })
    .send({ from: owner, gas: 5000000n });
  const tc = await new web3.eth.Contract(tcABI.abi)
    .deploy({ data: tcABI.bytecode, arguments: [al.options.address] })
    .send({ from: owner, gas: 8000000n });

  await al.methods
    .addAuthorizedCaller(tc.options.address)
    .send({ from: owner, gas: 100000n });

  const accounts = await web3.eth.getAccounts();
  for (const acc of accounts) {
    if (acc.toLowerCase() === owner.toLowerCase()) continue;
    await al.methods
      .addAuthorizedCaller(acc)
      .send({ from: owner, gas: 100000n });
  }

  return { alInstance: al, tcInstance: tc };
}

// ─── BigInt helpers ────────────────────────────────────────────────────────
const toN = (v) => Number(v);
const toBI = (v) => BigInt(v);
const sumBI = (arr) => arr.reduce((a, b) => a + toN(b), 0);

// ─── Write wrappers ────────────────────────────────────────────────────────

async function createBatch(
  tc,
  from,
  name,
  producerId,
  quantity,
  productTypeId,
) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return tc.methods
    .createBatch(
      name,
      toBI(producerId),
      String(quantity),
      toBI(productTypeId),
      now,
      now + 2592000n,
    )
    .send({ from, gas: 1200000n });
}

async function approveBatch(tc, from, batchId) {
  return tc.methods.approveBatch(toBI(batchId)).send({ from, gas: 500000n });
}

async function rejectBatch(tc, from, batchId, reason = "Rejected") {
  return tc.methods
    .rejectBatch(toBI(batchId), reason)
    .send({ from, gas: 500000n });
}

async function recordPurchase(
  tc,
  from,
  batchId,
  purchaserId = 1,
  qty = 500,
  price = 50000,
) {
  return tc.methods
    .recordPurchase(toBI(batchId), toBI(purchaserId), toBI(qty), toBI(price))
    .send({ from, gas: 500000n });
}

async function updateTransport(
  tc,
  from,
  batchId,
  participantId = 1,
  actionCode = 0,
) {
  return tc.methods
    .updateTransportStatus(
      toBI(batchId),
      toBI(participantId),
      actionCode,
      28,
      75,
    )
    .send({ from, gas: 500000n });
}

async function recordProcessing(tc, from, batchId, processorId = 1) {
  return tc.methods
    .recordProcessing(toBI(batchId), toBI(processorId), 0, 500n, 480n)
    .send({ from, gas: 500000n });
}

async function recordQualityTest(
  tc,
  from,
  batchId,
  inspectorId = 1,
  passed = true,
) {
  return tc.methods
    .recordQualityTest(toBI(batchId), toBI(inspectorId), passed)
    .send({ from, gas: 500000n });
}

async function warehouseConfirmation(tc, from, batchId, warehouseId = 1) {
  return tc.methods
    .warehouseConfirmation(toBI(batchId), toBI(warehouseId))
    .send({ from, gas: 300000n });
}

async function registerTree(al, from, qrCode, farmerId = 1, regionId = 1) {
  return al.methods
    .registerTree(
      qrCode,
      toBI(farmerId),
      toBI(regionId),
      "Musang King",
      "Premium",
      "10.45,106.32",
    )
    .send({ from, gas: 600000n });
}

async function addActivityLog(
  al,
  from,
  batchId,
  actName,
  desc,
  participantId = 1,
) {
  return al.methods
    .addActivityLog(toBI(batchId), toBI(participantId), actName, desc, false)
    .send({ from, gas: 300000n });
}

async function addDetailedLog(
  al,
  from,
  batchId,
  cat,
  actName,
  desc,
  participantId = 1,
  isSystem = false,
) {
  return al.methods
    .addDetailedActivityLog(
      toBI(batchId),
      toBI(participantId),
      toBI(cat),
      actName,
      desc,
      isSystem,
    )
    .send({ from, gas: 300000n });
}

// ─── NEW: Read helpers — IDs only ─────────────────────────────────────────

/**
 * Trả về uint256[] batchId ở một stage — payload tối thiểu
 * Với 1000 batch: ~32KB thay vì ~352KB → nhanh hơn ~11x so với getBatchesByStage
 */
async function getBatchIdsByStage(tc, stage) {
  return tc.methods.getBatchIdsByStage(toBI(stage)).call();
}

/**
 * Trả về uint256[] batchId của producer
 */
async function getBatchIdsByProducer(tc, producerId) {
  return tc.methods.getBatchIdsByProducer(toBI(producerId)).call();
}

/**
 * Trả về uint256[] batchId đang pending
 */
async function getPendingBatchIds(tc) {
  return tc.methods.getPendingBatchIds().call();
}

// ─── NEW: Read helpers — Pagination ───────────────────────────────────────

/**
 * Lấy trang Batch đầy đủ theo stage
 * @param {number} stage   - enum SupplyChainStage (0=Created, ...)
 * @param {number} offset  - vị trí bắt đầu
 * @param {number} limit   - số lượng (khuyên dùng 20–50)
 * @returns {{ batches, total }}
 */
async function getBatchesByStagesPaged(tc, stage, offset = 0, limit = 20) {
  return tc.methods
    .getBatchesByStagesPaged(toBI(stage), toBI(offset), toBI(limit))
    .call();
}

/**
 * Lấy trang BatchSummary (5 fields) theo stage — nhỏ nhất, nhanh nhất cho list view
 * @returns {{ summaries, total }}
 */
async function getBatchSummariesByStage(tc, stage, offset = 0, limit = 20) {
  return tc.methods
    .getBatchSummariesByStage(toBI(stage), toBI(offset), toBI(limit))
    .call();
}

/**
 * Lấy trang Batch của producer
 * @returns {{ batches, total }}
 */
async function getBatchesByProducerPaged(
  tc,
  producerId,
  offset = 0,
  limit = 20,
) {
  return tc.methods
    .getBatchesByProducerPaged(toBI(producerId), toBI(offset), toBI(limit))
    .call();
}

/**
 * Lấy trang batch pending
 * @returns {{ batches, total }}
 */
async function getPendingBatchesPaged(tc, offset = 0, limit = 20) {
  return tc.methods.getPendingBatchesPaged(toBI(offset), toBI(limit)).call();
}

/**
 * Fetch chi tiết song song cho mảng batchIds — dùng sau khi có IDs
 * @param {bigint[]} ids
 * @returns {Promise<Batch[]>}
 */
async function fetchBatchDetails(tc, ids) {
  return Promise.all(
    ids.map((id) => tc.methods.getBatchDetails(toBI(id)).call()),
  );
}

// ─── Stats helper ─────────────────────────────────────────────────────────
function calcStats(times) {
  if (!times.length)
    return { min: 0, max: 0, avg: 0, median: 0, p95: 0, count: 0 };
  const nums = times.map(Number);
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
    count: sorted.length,
  };
}

// ─── hrtime timer ─────────────────────────────────────────────────────────
function now() {
  if (typeof performance !== "undefined") return performance.now();
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1e6;
}

// ─── Ganache time manipulation ────────────────────────────────────────────
async function increaseTime(web3, seconds) {
  try {
    await web3.currentProvider.request({
      method: "evm_increaseTime",
      params: [seconds],
    });
    await web3.currentProvider.request({ method: "evm_mine", params: [] });
  } catch {
    await new Promise((res, rej) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [seconds],
          id: Date.now(),
        },
        (err) => (err ? rej(err) : res()),
      );
    });
    await new Promise((res, rej) => {
      web3.currentProvider.send(
        { jsonrpc: "2.0", method: "evm_mine", params: [], id: Date.now() + 1 },
        (err) => (err ? rej(err) : res()),
      );
    });
  }
}

// ─── Get batchId from tx receipt ─────────────────────────────────────────
function getBatchId(receipt) {
  const ev = receipt?.events?.BatchCreated?.returnValues;
  if (ev) return Number(ev.batchId);
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  GANACHE_URL,
  getWeb3,
  loadABI,
  deployContracts,
  // write
  createBatch,
  approveBatch,
  rejectBatch,
  recordPurchase,
  updateTransport,
  recordProcessing,
  recordQualityTest,
  warehouseConfirmation,
  registerTree,
  addActivityLog,
  addDetailedLog,
  // read — IDs only (khuyên dùng khi cần list lớn)
  getBatchIdsByStage,
  getBatchIdsByProducer,
  getPendingBatchIds,
  // read — paginated (khuyên dùng cho UI)
  getBatchesByStagesPaged,
  getBatchSummariesByStage,
  getBatchesByProducerPaged,
  getPendingBatchesPaged,
  fetchBatchDetails,
  // utils
  calcStats,
  now,
  increaseTime,
  getBatchId,
  sleep,
  toN,
  toBI,
  sumBI,
};
