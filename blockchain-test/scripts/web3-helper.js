/**
 * web3-helper.js  —  Web3 v4.x  (contracts thực tế)
 *
 * createBatch(name, producerId, quantity, productTypeId, startDate, endDate)
 * addActivityLog(batchId, participantId, activityName, description, isSystemActivity)
 * addDetailedActivityLog(batchId, participantId, category, activityName, description, isSystemActivity)
 * registerTree(treeQRCode, farmerId, regionId, treeType, variety, coordinates)
 * approveBatch(batchId, approverId)
 * rejectBatch(batchId, approverId, reason)
 * recordPurchase(batchId, purchaserId, totalQuantity, pricePerUnit)
 * updateTransportStatus(batchId, participantId, actionCode, temperature, humidity)
 * recordProcessing(batchId, processorId, method, inputWeight, outputWeight)
 * recordQualityTest(batchId, inspectorId, passed)
 * warehouseConfirmation(batchId, warehouseId)
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

  // Đăng ký TC là authorized caller trong ActivityLog
  await al.methods
    .addAuthorizedCaller(tc.options.address)
    .send({ from: owner, gas: 100000n });

  return { alInstance: al, tcInstance: tc };
}

// ─── BigInt helpers ────────────────────────────────────────────────────────
// Web3 v4 trả BigInt; dùng toN() để ép về Number an toàn
const toN = (v) => Number(v);
const toBI = (v) => BigInt(v);
// Tổng mảng BigInt an toàn
const sumBI = (arr) => arr.reduce((a, b) => a + toN(b), 0);

// ─── Wrappers theo đúng signature contract ─────────────────────────────────

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
      String(quantity), // quantity là string
      toBI(productTypeId),
      now,
      now + 2592000n,
    )
    .send({ from, gas: 1200000n });
}

async function approveBatch(tc, from, batchId, approverId = 1) {
  return tc.methods
    .approveBatch(toBI(batchId), toBI(approverId))
    .send({ from, gas: 500000n });
}

async function rejectBatch(
  tc,
  from,
  batchId,
  approverId = 1,
  reason = "Rejected",
) {
  return tc.methods
    .rejectBatch(toBI(batchId), toBI(approverId), reason)
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

// actionCode: 0=start, 1=checkpoint, 2=delay, 3=delivered
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

// ─── Stats helper (BigInt-safe) ───────────────────────────────────────────
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

// ─── hrtime timer (Node 10+) ──────────────────────────────────────────────
function now() {
  if (typeof performance !== "undefined") return performance.now();
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1e6;
}

// ─── Ganache time manipulation ────────────────────────────────────────────
async function increaseTime(web3, seconds) {
  // Web3 v4: currentProvider.request (EIP-1193)
  try {
    await web3.currentProvider.request({
      method: "evm_increaseTime",
      params: [seconds],
    });
    await web3.currentProvider.request({ method: "evm_mine", params: [] });
  } catch {
    // fallback send style
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
  // fallback: scan logs
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  GANACHE_URL,
  getWeb3,
  loadABI,
  deployContracts,
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
  calcStats,
  now,
  increaseTime,
  getBatchId,
  sleep,
  toN,
  toBI,
  sumBI,
};
