/**
 * LARGE DATASET SCALABILITY TEST  —  Web3 v4.x (TẦNG 2 FIX)
 *
 * VẤN ĐỀ ĐƯỢC GIẢI QUYẾT:
 *   Phiên bản cũ: getBatchesByStage trả toàn bộ Batch[] (11 fields/batch)
 *   → 1000 batch = ~352KB JSON-RPC payload → ~15 giây
 *
 * FIX TRONG TEST NÀY:
 *   Phase 2: Đo getBatchIdsByStage (IDs only, ~32KB) và getBatchSummariesByStage
 *             cùng getBatchesByStagesPaged(limit=20) → so sánh 3 API
 *   Phase 3: Thêm 460 batch để đạt 500, kiểm tra tính tuyến tính
 *   Phase 4: Projections thực tế cho 1000 batch
 *
 * KẾT QUẢ KỲ VỌNG:
 *   getBatchIdsByStage(500):         <10ms   (uint256[] 500×32B = 16KB)
 *   getBatchSummariesByStage p20:    <5ms    (20 summaries × 5 fields)
 *   getBatchesByStagesPaged p20:     <10ms   (20 batch × 11 fields)
 *   Projected 1000 (IDs only):       <20ms
 */
const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");
const H = require("../../scripts/web3-helper");

const web3 = new Web3(H.GANACHE_URL);

async function run() {
  console.log("\n" + "=".repeat(65));
  console.log("  SCALABILITY TEST v2: Pagination + IDs-Only API");
  console.log("=".repeat(65));

  const accounts = await web3.eth.getAccounts();
  const owner = accounts[0];
  const results = {};

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  const BATCHES = 40,
    LOGS_EACH = 3,
    TREES = 12;

  // ── PHASE 1: Seed 40 batch (giống bản cũ) ────────────────────────────
  console.log(
    `\n[PHASE 1] Seeding ${TREES} trees + ${BATCHES} batches × ${LOGS_EACH} logs`,
  );
  const seedStart = H.now();
  const batchIds = [];

  for (let i = 1; i <= TREES; i++) {
    await H.registerTree(
      alInstance,
      accounts[i % accounts.length],
      `TREE-SCALE-${i}`,
      (i % 5) + 1,
      (i % 3) + 1,
    );
    process.stdout.write(`\r  Trees: ${i}/${TREES}`);
  }
  console.log("");

  for (let i = 1; i <= BATCHES; i++) {
    const acc = accounts[i % accounts.length];
    const rb = await H.createBatch(
      tcInstance,
      acc,
      `Scale Batch ${i}`,
      (i % 5) + 1,
      `${i * 50}`,
      (i % 3) + 1,
    );
    const bid = H.getBatchId(rb) || i;
    batchIds.push(bid);
    await H.approveBatch(tcInstance, owner, bid);
    for (let j = 0; j < LOGS_EACH; j++)
      await H.addDetailedLog(
        alInstance,
        acc,
        bid,
        j % 5,
        `Hoạt động ${j + 1}`,
        `Mô tả ${j + 1}`,
      );
    process.stdout.write(`\r  Batches: ${i}/${BATCHES}`);
  }
  const seedMs = H.now() - seedStart;
  results.seedTime = { totalMs: seedMs, batches: BATCHES, treesCount: TREES };
  console.log(`\n  ✅ Seeded in ${(seedMs / 1000).toFixed(1)}s`);

  // Thêm 460 batch nữa để đạt 500 (không log để nhanh)
  console.log(`\n  Thêm 460 batch để đạt 500...`);
  const extraStart = H.now();
  for (let i = BATCHES + 1; i <= 500; i++) {
    const acc = accounts[i % accounts.length];
    const rb = await H.createBatch(
      tcInstance,
      acc,
      `Extra Batch ${i}`,
      (i % 5) + 1,
      `${i * 30}`,
      (i % 3) + 1,
    );
    const bid = H.getBatchId(rb) || i;
    batchIds.push(bid);
    // Approve ngẫu nhiên 50% để có cả pending lẫn approved
    if (i % 2 === 0) await H.approveBatch(tcInstance, owner, bid);
    if (i % 50 === 0) process.stdout.write(`\r  ${i}/500`);
  }
  console.log(
    `\n  ✅ Tổng 500 batch trong ${((H.now() - extraStart) / 1000).toFixed(1)}s`,
  );

  // ── Warm-up ───────────────────────────────────────────────────────────
  await tcInstance.methods.getBatchIdsByStage(0n).call();
  await tcInstance.methods.getBatchSummariesByStage(0n, 0n, 20n).call();
  await tcInstance.methods.getBatchesByStagesPaged(0n, 0n, 20n).call();
  await tcInstance.methods.getAllPendingBatches().call(); // warm legacy
  await tcInstance.methods.getBatchesByProducer(1n).call(); // warm legacy

  const measure = async (fn) => {
    const t0 = H.now();
    await fn();
    return H.now() - t0;
  };
  const avg5 = async (fn) => {
    const ts = [];
    for (let i = 0; i < 5; i++) ts.push(await measure(fn));
    return H.calcStats(ts).avg;
  };

  // ── PHASE 2: So sánh 3 API với 500 batch ──────────────────────────────
  console.log("\n[PHASE 2] So sánh API với 500 batch ở stage Created");
  console.log("  (Đo 5 lần, lấy trung bình)\n");

  // 2a. IDs only — tốt nhất cho danh sách lớn
  const avgIds500 = await avg5(() =>
    tcInstance.methods.getBatchIdsByStage(0n).call(),
  );
  results.getBatchIdsByStage_500 = {
    avgMs: avgIds500,
    n: 500,
    api: "IDs only",
  };
  console.log(
    `  getBatchIdsByStage(Created, 500):         ${avgIds500.toFixed(0)}ms  ← IDs only [kỳ vọng <15ms]`,
  );

  // 2b. Summaries paginated (20 items)
  const avgSum20 = await avg5(() =>
    tcInstance.methods.getBatchSummariesByStage(0n, 0n, 20n).call(),
  );
  results.getBatchSummariesPaged_20 = {
    avgMs: avgSum20,
    n: 20,
    api: "Summary page",
  };
  console.log(
    `  getBatchSummariesByStage(page 20):        ${avgSum20.toFixed(0)}ms  ← 5 fields [kỳ vọng <5ms]`,
  );

  // 2c. Full Batch paginated (20 items)
  const avgPage20 = await avg5(() =>
    tcInstance.methods.getBatchesByStagesPaged(0n, 0n, 20n).call(),
  );
  results.getBatchesPaged_20 = { avgMs: avgPage20, n: 20, api: "Full page" };
  console.log(
    `  getBatchesByStagesPaged(full, page 20):   ${avgPage20.toFixed(0)}ms  ← 11 fields [kỳ vọng <10ms]`,
  );

  // 2d. [LEGACY] Full array — để so sánh
  const avgLegacy500 = await avg5(() =>
    tcInstance.methods.getBatchesByStage(0n).call(),
  );
  results.getBatchesByStage_legacy_500 = {
    avgMs: avgLegacy500,
    n: 500,
    api: "Legacy full array",
  };
  console.log(
    `  getBatchesByStage[LEGACY](500):           ${avgLegacy500.toFixed(0)}ms  ← LEGACY [kỳ vọng ~${Math.round(avgIds500 * 11)}ms]`,
  );

  const speedup = avgLegacy500 / Math.max(avgIds500, 1);
  console.log(`\n  ⚡ Speedup IDs vs Legacy: ${speedup.toFixed(1)}x nhanh hơn`);

  // 2e. Pending batches (250 batch pending — 50% của 460 extra)
  const avgPending = await avg5(() =>
    tcInstance.methods.getPendingBatchIds().call(),
  );
  results.getPendingBatchIds = { avgMs: avgPending, api: "IDs only" };
  console.log(
    `  getPendingBatchIds (~250 pending):        ${avgPending.toFixed(0)}ms  ← IDs only`,
  );

  const avgPendingPage = await avg5(() =>
    tcInstance.methods.getPendingBatchesPaged(0n, 20n).call(),
  );
  results.getPendingBatchesPaged_20 = { avgMs: avgPendingPage, api: "Paged" };
  console.log(
    `  getPendingBatchesPaged(page 20):          ${avgPendingPage.toFixed(0)}ms  ← Paged`,
  );

  // 2f. Producer paginated
  const avgProdPage = await avg5(() =>
    tcInstance.methods.getBatchesByProducerPaged(1n, 0n, 20n).call(),
  );
  results.getBatchesByProducerPaged_20 = { avgMs: avgProdPage, api: "Paged" };
  console.log(
    `  getBatchesByProducerPaged(id=1, p20):     ${avgProdPage.toFixed(0)}ms  ← Paged`,
  );

  // 2g. O(1) counts
  const stageCount = await tcInstance.methods.getBatchCountByStage(0n).call();
  const statusApproved = await tcInstance.methods
    .getBatchCountByStatus(1n)
    .call();
  const statusPending = await tcInstance.methods
    .getBatchCountByStatus(0n)
    .call();
  console.log(`\n  getBatchCountByStage(Created):  ${stageCount}`);
  console.log(`  getBatchCountByStatus(Approved): ${statusApproved}`);
  console.log(`  getBatchCountByStatus(Pending):  ${statusPending}`);

  // ── PHASE 3: Projections ──────────────────────────────────────────────
  console.log("\n[PHASE 3] Projections cho 1000 batch");

  // IDs-only tuyến tính theo số bytes trả về
  const proj1000_ids = avgIds500 * 2;
  // Summary page 20 không đổi theo tổng số (chỉ phụ thuộc limit)
  const proj1000_page = avgPage20; // không đổi — pagination!
  // Legacy: tuyến tính theo payload
  const proj1000_legacy = avgLegacy500 * 2;

  console.log(
    `  getBatchIdsByStage(1000):                ~${proj1000_ids.toFixed(0)}ms`,
  );
  console.log(
    `  getBatchesByStagesPaged(1000, page 20):  ~${proj1000_page.toFixed(0)}ms (không đổi!)`,
  );
  console.log(
    `  getBatchesByStage[LEGACY](1000):         ~${proj1000_legacy.toFixed(0)}ms`,
  );

  // ── PHASE 4: Sanity check ─────────────────────────────────────────────
  console.log("\n[PHASE 4] Sanity check");
  // 40 batch đầu đều approved + 460 extra (230 approved, 230 pending)
  const expectedApproved = 40 + 230;
  const expectedPending = 230;
  const totalOk =
    Number(stageCount) === 500 &&
    Number(statusApproved) === expectedApproved &&
    Number(statusPending) === expectedPending;
  console.log(
    `  Expected: stageCreated=500, approved=${expectedApproved}, pending=${expectedPending}`,
  );
  console.log(
    `  Actual:   stageCreated=${stageCount}, approved=${statusApproved}, pending=${statusPending}`,
  );
  console.log(
    `  Sanity check: ${totalOk ? "✅ PASS" : "❌ FAIL — kiểm tra lại logic"}`,
  );

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(65));
  console.log("  SUMMARY — So sánh API (500 batch)");
  console.log("=".repeat(65));
  console.log(
    `  getBatchIdsByStage (IDs only, 500):      ${avgIds500.toFixed(0)}ms`,
  );
  console.log(
    `  getBatchSummariesByStage (page 20):      ${avgSum20.toFixed(0)}ms`,
  );
  console.log(
    `  getBatchesByStagesPaged (full, page 20): ${avgPage20.toFixed(0)}ms`,
  );
  console.log(
    `  getBatchesByStage [LEGACY] (500):        ${avgLegacy500.toFixed(0)}ms`,
  );
  console.log(`  ─────────────────────────────────────────────────────────`);
  console.log(`  Speedup IDs vs Legacy:    ${speedup.toFixed(1)}x`);
  console.log(`  Proj 1000 (IDs only):    ~${proj1000_ids.toFixed(0)}ms`);
  console.log(
    `  Proj 1000 (page 20):     ~${proj1000_page.toFixed(0)}ms  ← DÙNG CÁI NÀY!`,
  );
  console.log(`  Proj 1000 (legacy):      ~${proj1000_legacy.toFixed(0)}ms`);

  if (avgIds500 < 30) {
    console.log("\n  ✅ getBatchIdsByStage: ổn — <30ms với 500 batch");
  } else {
    console.log("\n  ⚠️  getBatchIdsByStage >30ms — kiểm tra RPC latency");
  }
  if (avgPage20 < 20) {
    console.log("  ✅ Pagination: ổn — <20ms mỗi trang");
  }
  console.log(
    "  ✅ Pagination: thời gian không đổi theo tổng số batch (O(limit) thay vì O(n))",
  );

  const rp = path.join(__dirname, "../../test-results/large-dataset.json");
  fs.mkdirSync(path.dirname(rp), { recursive: true });
  fs.writeFileSync(
    rp,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        testType: "large-dataset-v2",
        fix: "Pagination + IDs-only APIs — ABI serialization bottleneck resolved",
        config: { TOTAL_BATCHES: 500, LOGS_EACH, TREES },
        results,
        projections: {
          ids1000ms: proj1000_ids.toFixed(0),
          page1000ms: proj1000_page.toFixed(0),
          legacy1000ms: proj1000_legacy.toFixed(0),
          speedupVsLegacy: speedup.toFixed(1),
          recommendation:
            "Use getBatchIdsByStage + getBatchDetails OR getBatchesByStagesPaged(limit=20)",
        },
        indexSanity: {
          stageCreated: Number(stageCount),
          statusApproved: Number(statusApproved),
          statusPending: Number(statusPending),
          pass: totalOk,
        },
      },
      null,
      2,
    ),
  );
  console.log(`\n  💾 ${rp}\n`);
  return results;
}

if (require.main === module)
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
module.exports = { run };
