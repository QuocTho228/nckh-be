/**
 * END-TO-END FULL LIFECYCLE TEST  —  Web3 v4.x
 * ============================================================
 * Mô phỏng TOÀN BỘ vòng đời 1 lô sầu riêng từ vườn đến kho.
 *
 *  STEP 0  🌱 Đăng ký 3 cây sầu riêng
 *  STEP 1  📦 Tạo lô hàng (Stage: Created)
 *  STEP 2  ✅ Phê duyệt (Status: Approved)
 *  STEP 3  💰 Mua bán (Stage: Purchased)
 *  STEP 4  🚛 Vận chuyển 1 — nông trại → nhà máy (Stage: Transported1)
 *  STEP 5  🏭 Sơ chế (Stage: Processed)
 *  STEP 6  🔬 Kiểm tra chất lượng (Stage: QualityInspected)
 *  STEP 7  🚛 Vận chuyển 2 — nhà máy → kho (Stage: Transported2)
 *  STEP 8  🏪 Nhập kho (Stage: Warehoused)
 *  STEP 9  🔍 Verification tổng hợp cuối vòng đời
 *  STEP 10 🛡️  Invalid transition guards
 *
 * Mỗi bước kiểm tra: tx OK, stage đúng, event đúng, on-chain state đúng.
 * ============================================================
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);

let passed = 0, failed = 0;
const testResults = [];
const timeline    = {};

function chk(ok, label, detail = '') {
  console.log(`    ${ok ? '✅' : '❌'} ${label}${detail ? '  →  ' + detail : ''}`);
  ok ? passed++ : failed++;
  testResults.push({ test: label, status: ok ? 'PASS' : 'FAIL', detail });
}

function step(num, title) {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  STEP ${num}: ${title}`);
  console.log('─'.repeat(62));
}

const ev  = (r, n) => r?.events?.[n]?.returnValues ?? null;
const has = (r, n) => !!r?.events?.[n];
const eqN = (a, b) => Number(a) === Number(b);

const STAGE  = { Created:0, Purchased:1, Transported1:2, Processed:3, QualityInspected:4, Transported2:5, Warehoused:6 };
const STATUS = { PendingApproval:0, Approved:1, Rejected:2 };

// =============================================================================
async function run() {
  console.log('\n' + '='.repeat(62));
  console.log('  END-TO-END: Vòng Đời Lô Sầu Riêng Musang King');
  console.log('  8 bước hoàn chỉnh — nông trại đến kho lạnh');
  console.log('='.repeat(62));

  const accs = await web3.eth.getAccounts();
  const [deployer, farmer, producer, purchaser, transporter, processor, inspector, warehouse] = accs;
  const { alInstance: al, tcInstance: tc } = await H.deployContracts(web3, deployer);

  console.log('\n  Contracts:');
  console.log(`    ActivityLog:  ${al.options.address}`);
  console.log(`    Traceability: ${tc.options.address}`);

  const FARMER_ID=1, PRODUCER_ID=2, PURCHASER_ID=3, TRANSPORT_ID=4,
        PROCESSOR_ID=5, INSPECTOR_ID=6, WAREHOUSE_ID=7;

  let treeIds=[], batchId, sscc;
  const t0 = H.now();

  // ══════════════════════════════════════════════════════════════
  step(0, '🌱 Đăng ký 3 cây sầu riêng Musang King');
  // ══════════════════════════════════════════════════════════════
  const ts = Date.now();
  for (let i = 1; i <= 3; i++) {
    const r = await al.methods
      .registerTree(`MK-TREE-${ts}-${i}`, H.toBI(FARMER_ID), 1n, 'Musang King', 'Premium D197', '10.45,106.32')
      .send({ from: farmer, gas: 600000n });
    const e = ev(r, 'TreeRegistered');
    chk(!!e,                                    `Cây ${i}: TreeRegistered emit`);
    chk(Number(e?.plantedDate) > 0,             `Cây ${i}: plantedDate = block.timestamp`);
    treeIds.push(Number(e?.treeId ?? i));
  }
  chk(treeIds.length === 3, `3 cây đã đăng ký: [${treeIds}]`);

  // Chăm sóc cây — activity log (category=0: TreeManagement)
  for (const tid of treeIds)
    await H.addDetailedLog(al, farmer, tid, 0, 'Bón phân', 'Phân NPK hữu cơ', FARMER_ID);
  chk(true, 'Activity log chăm sóc cây ghi thành công');
  timeline.step0 = H.now() - t0;

  // ══════════════════════════════════════════════════════════════
  step(1, '📦 Tạo lô hàng');
  // ══════════════════════════════════════════════════════════════
  const batchName = 'Musang King Premium D197 — Vụ Hè Thu 2024';
  const batchQty  = '850';
  const nowTs     = BigInt(Math.floor(Date.now() / 1000));

  const createR = await tc.methods
    .createBatch(batchName, H.toBI(PRODUCER_ID), batchQty, 1n, nowTs, nowTs + 2592000n)
    .send({ from: producer, gas: 1200000n });

  const eBC  = ev(createR, 'BatchCreated');
  const eBDS = ev(createR, 'BatchDetailsStored');
  const eSU0 = ev(createR, 'StageUpdated');

  chk(!!eBC,                                    'BatchCreated event emit');
  chk(!!eBDS,                                   'BatchDetailsStored event emit');
  chk(!!eSU0,                                   'StageUpdated event emit');
  chk(eBDS?.name === batchName,                 `name đúng: ${batchName.slice(0,30)}...`);
  chk(eBDS?.quantity === batchQty,              `quantity = ${batchQty}kg`);
  chk(Number(eSU0?.newStage) === STAGE.Created, 'Stage = Created (0)');

  batchId = Number(eBC?.batchId);
  sscc    = eBC?.sscc;
  chk(batchId > 0,                              `batchId = ${batchId}`);
  chk(typeof sscc === 'string' && sscc.length > 0, `SSCC auto-generated: ${sscc}`);

  // Verify on-chain
  const bc0 = await tc.methods.getBatchDetails(H.toBI(batchId)).call();
  chk(Number(bc0.status) === STATUS.PendingApproval, 'status = PendingApproval (0)');
  chk(bc0.sscc === sscc,                         'SSCC on-chain khớp event');
  timeline.step1 = H.now() - t0 - timeline.step0;

  // ══════════════════════════════════════════════════════════════
  step(2, '✅ Phê duyệt lô — reject flow test');
  // ══════════════════════════════════════════════════════════════
  // Test reject flow
  const rbR   = await H.createBatch(tc, deployer, 'Reject This', 3, '100', 1);
  const rbid  = H.getBatchId(rbR);
  const rejR  = await tc.methods.rejectBatch(H.toBI(rbid), 3n, 'Không đạt TCVN').send({ from: deployer, gas: 500000n });
  const eBRej = ev(rejR, 'BatchRejected');
  chk(!!eBRej,                                  'BatchRejected event emit khi reject');
  chk(eBRej?.reason === 'Không đạt TCVN',       'reason đúng trong event');

  // Approve batch chính
  const approveR = await tc.methods
    .approveBatch(H.toBI(batchId), H.toBI(PRODUCER_ID))
    .send({ from: deployer, gas: 500000n });

  const eBA = ev(approveR, 'BatchApproved');
  chk(!!eBA,                                    'BatchApproved event emit');
  chk(eBA?.sscc === sscc,                       'sscc trong BatchApproved khớp sscc gốc');

  const bc2 = await tc.methods.getBatchDetails(H.toBI(batchId)).call();
  chk(Number(bc2.status) === STATUS.Approved,   'status = Approved (1) on-chain');
  timeline.step2 = H.now() - t0 - timeline.step0 - timeline.step1;

  // ══════════════════════════════════════════════════════════════
  step(3, '💰 Ghi nhận mua bán (Stage: Purchased)');
  // ══════════════════════════════════════════════════════════════
  const pQty = 850, pPrice = 95000;  // 95,000 VND/kg

  const purchR = await tc.methods
    .recordPurchase(H.toBI(batchId), H.toBI(PURCHASER_ID), H.toBI(pQty), H.toBI(pPrice))
    .send({ from: purchaser, gas: 500000n });

  const ePR  = ev(purchR, 'PurchaseRecorded');
  const eSU1 = ev(purchR, 'StageUpdated');
  chk(!!ePR,                                    'PurchaseRecorded event emit');
  chk(eqN(ePR?.purchaserId, PURCHASER_ID),      `purchaserId = ${PURCHASER_ID}`);
  chk(eqN(ePR?.totalQuantity, pQty),            `totalQuantity = ${pQty}kg`);
  chk(BigInt(ePR?.totalPrice ?? 0) === BigInt(pQty) * BigInt(pPrice),
    `totalPrice = ${(pQty * pPrice).toLocaleString()} VND`);
  chk(Number(eSU1?.newStage) === STAGE.Purchased, 'Stage = Purchased (1)');

  const bc3 = await tc.methods.getBatchDetails(H.toBI(batchId)).call();
  chk(Number(bc3.currentStage) === STAGE.Purchased, 'currentStage = Purchased on-chain');
  timeline.step3 = H.now() - t0 - timeline.step0 - timeline.step1 - timeline.step2;

  // ══════════════════════════════════════════════════════════════
  step(4, '🚛 Vận chuyển 1: Nông trại → Nhà máy (Stage: Transported1)');
  // ══════════════════════════════════════════════════════════════
  // actionCode: 0=start, 1=pause, 2=resume, 3=complete
  const trActions = [
    [0, 27, 72, 'Start transport'],
    [1, 26, 70, 'Pause (dừng nghỉ)'],
    [2, 27, 71, 'Resume'],
    [3, 25, 68, 'Complete → trigger StageUpdated'],
  ];
  let eSU2 = null;
  for (const [code, temp, hum, note] of trActions) {
    const r = await tc.methods
      .updateTransportStatus(H.toBI(batchId), H.toBI(TRANSPORT_ID), code, temp, hum)
      .send({ from: transporter, gas: 500000n });
    const eT = ev(r, 'TransportStatusUpdated');
    chk(!!eT, `TransportStatusUpdated (${note})`);
    if (code === 0) chk(Number(eT?.newStatus) === 1, 'newStatus = 1 (InTransit) khi start');
    if (code === 3) { eSU2 = ev(r, 'StageUpdated'); chk(Number(eT?.newStatus) === 3, 'newStatus = 3 (Delivered) khi complete'); }
  }
  chk(!!eSU2,                                   'StageUpdated(Transported1) emit khi actionCode=3');
  chk(Number(eSU2?.newStage) === STAGE.Transported1, 'newStage = 2 (Transported1)');

  const trEvents = await tc.methods.getTransportEvents(H.toBI(batchId)).call();
  chk(trEvents.length === 4,                    `Transport history: ${trEvents.length} events (start+pause+resume+complete)`);
  timeline.step4 = H.now() - t0 - timeline.step0 - timeline.step1 - timeline.step2 - timeline.step3;

  // ══════════════════════════════════════════════════════════════
  step(5, '🏭 Sơ chế tại nhà máy (Stage: Processed)');
  // ══════════════════════════════════════════════════════════════
  // Log trước khi xử lý
  await H.addDetailedLog(al, processor, batchId, 5, 'Phân loại', 'Size A: 3-4kg/quả', PROCESSOR_ID);
  await H.addDetailedLog(al, processor, batchId, 5, 'Rửa sạch',  'Nước sạch áp lực',  PROCESSOR_ID);

  const procR = await tc.methods
    .recordProcessing(H.toBI(batchId), H.toBI(PROCESSOR_ID), 0, 850n, 815n)
    .send({ from: processor, gas: 500000n });

  const eProc = ev(procR, 'ProcessingRecorded');
  const eSU3  = ev(procR, 'StageUpdated');
  chk(!!eProc,                                  'ProcessingRecorded event emit');
  chk(eqN(eProc?.processorId, PROCESSOR_ID),    `processorId = ${PROCESSOR_ID}`);
  chk(Number(eProc?.method) === 0,              'method = 0 (Washing)');
  chk(Number(eSU3?.newStage) === STAGE.Processed, 'Stage = Processed (3)');

  const proc = await tc.methods.getProcessingRecord(H.toBI(batchId)).call();
  chk(Number(proc.inputWeight) === 850,         'inputWeight = 850kg on-chain');
  chk(Number(proc.outputWeight) === 815,        'outputWeight = 815kg (hao hụt 4.1%)');
  timeline.step5 = H.now() - t0 - Object.values(timeline).reduce((a,b)=>a+b,0);

  // ══════════════════════════════════════════════════════════════
  step(6, '🔬 Kiểm tra chất lượng (Stage: QualityInspected)');
  // ══════════════════════════════════════════════════════════════
  const qtR = await tc.methods
    .recordQualityTest(H.toBI(batchId), H.toBI(INSPECTOR_ID), true)
    .send({ from: inspector, gas: 500000n });

  const eQT  = ev(qtR, 'QualityTestRecorded');
  const eSU4 = ev(qtR, 'StageUpdated');
  chk(!!eQT,                                    'QualityTestRecorded event emit');
  chk(eqN(eQT?.inspectorId, INSPECTOR_ID),      `inspectorId = ${INSPECTOR_ID}`);
  chk(eQT?.passed === true,                     'passed = true');
  chk(Number(eSU4?.newStage) === STAGE.QualityInspected, 'Stage = QualityInspected (4)');

  const qtArr = await tc.methods.getBatchQualityTests(H.toBI(batchId)).call();
  chk(qtArr.length >= 1,                        `Quality tests on-chain: ${qtArr.length}`);
  chk(qtArr[qtArr.length-1].passed === true,    'Latest QT passed = true on-chain');

  // ══════════════════════════════════════════════════════════════
  step(7, '🚛 Vận chuyển 2: Nhà máy → Kho lạnh (Stage: Transported2)');
  // ══════════════════════════════════════════════════════════════
  await tc.methods.updateTransportStatus(H.toBI(batchId), H.toBI(TRANSPORT_ID), 0, 18, 80)
    .send({ from: transporter, gas: 500000n });
  const tr2R = await tc.methods.updateTransportStatus(H.toBI(batchId), H.toBI(TRANSPORT_ID), 3, 16, 78)
    .send({ from: transporter, gas: 500000n });

  const eSU5 = ev(tr2R, 'StageUpdated');
  chk(!!eSU5,                                   'StageUpdated(Transported2) emit');
  chk(Number(eSU5?.newStage) === STAGE.Transported2, 'Stage = Transported2 (5)');

  // ══════════════════════════════════════════════════════════════
  step(8, '🏪 Xác nhận nhập kho lạnh (Stage: Warehoused)');
  // ══════════════════════════════════════════════════════════════
  const whR = await tc.methods
    .warehouseConfirmation(H.toBI(batchId), H.toBI(WAREHOUSE_ID))
    .send({ from: warehouse, gas: 300000n });

  const eWH  = ev(whR, 'WarehouseConfirmed');
  const eSU6 = ev(whR, 'StageUpdated');
  chk(!!eWH,                                    'WarehouseConfirmed event emit');
  chk(eqN(eWH?.batchId, batchId),              `batchId = ${batchId}`);
  chk(eqN(eWH?.warehouseId, WAREHOUSE_ID),      `warehouseId = ${WAREHOUSE_ID}`);
  chk(Number(eSU6?.newStage) === STAGE.Warehoused, 'Stage = Warehoused (6)');

  const finalBatch = await tc.methods.getBatchDetails(H.toBI(batchId)).call();
  chk(Number(finalBatch.currentStage) === STAGE.Warehoused, 'currentStage = Warehoused on-chain (final)');
  chk(Number(finalBatch.status) === STATUS.Approved,        'status = Approved (vẫn approved)');
  chk(finalBatch.sscc === sscc,                             'SSCC bất biến suốt vòng đời ✓');

  // ══════════════════════════════════════════════════════════════
  step(9, '🔍 Verification tổng hợp cuối vòng đời');
  // ══════════════════════════════════════════════════════════════

  // Hash integrity
  const hashOk = await tc.methods
    .verifyBatchDataHash(H.toBI(batchId), sscc, H.toBI(PRODUCER_ID), batchQty, finalBatch.productionDate, '', 1n, batchName)
    .call();
  chk(hashOk, 'verifyBatchDataHash — on-chain data nguyên vẹn sau toàn bộ vòng đời ✓');

  // Activity logs tích lũy
  const allLogs = await al.methods.getActivityLogs(H.toBI(batchId)).call();
  chk(allLogs.length >= 2, `Activity logs tích lũy: ${allLogs.length} logs (thủ công + system)`);

  // Purchase record
  const pr = await tc.methods.getPurchaseRecord(H.toBI(batchId)).call();
  chk(Number(pr.totalQuantity) === pQty,  `PurchaseRecord.totalQuantity = ${pQty}kg`);
  chk(Number(pr.pricePerUnit)  === pPrice, `PurchaseRecord.pricePerUnit = ${pPrice.toLocaleString()} VND`);

  // SSCC traceability
  const bBySSCC = await tc.methods.getBatchBySSCC(sscc).call();
  chk(Number(bBySSCC.batchId) === batchId, `getBatchBySSCC("${sscc}") → batchId=${batchId} ✓`);

  // Transport history complete
  const trAll = await tc.methods.getTransportEvents(H.toBI(batchId)).call();
  chk(trAll.length >= 4, `Transport history: ${trAll.length} events tổng cộng`);

  // ══════════════════════════════════════════════════════════════
  step(10, '🛡️  Invalid transition guards');
  // ══════════════════════════════════════════════════════════════
  try {
    await tc.methods.approveBatch(H.toBI(batchId), H.toBI(PRODUCER_ID)).send({ from: deployer, gas: 500000n });
    chk(false, 'Block re-approve batch đã approved', 'phải revert');
  } catch { chk(true, 'Block re-approve ✓'); }

  try {
    await tc.methods.recordPurchase(H.toBI(batchId), H.toBI(PURCHASER_ID), 100n, 50000n).send({ from: purchaser, gas: 500000n });
    chk(false, 'Block purchase batch đã qua stage', 'phải revert');
  } catch { chk(true, 'Block purchase batch đã Warehoused ✓'); }

  try {
    await tc.methods.recordQualityTest(H.toBI(batchId), H.toBI(INSPECTOR_ID), true).send({ from: inspector, gas: 500000n });
    chk(false, 'Block quality test batch đã Warehoused', 'phải revert');
  } catch { chk(true, 'Block quality test batch đã Warehoused ✓'); }

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  const total    = passed + failed;
  const totalSec = ((H.now() - t0) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(62));
  console.log('  E2E FULL LIFECYCLE SUMMARY');
  console.log('='.repeat(62));
  console.log(`\n  📦 batchId=${batchId}  SSCC=${sscc}`);
  console.log(`  🌱 Trees: [${treeIds}]  850kg → 815kg (hao hụt 4.1% sơ chế)`);
  console.log(`  💰 ${pQty}kg × ${pPrice.toLocaleString()} VND = ${(pQty * pPrice).toLocaleString()} VND`);
  console.log(`\n  Stage flow:  Created→Approved→Purchased→Transported1`);
  console.log(`               →Processed→QualityInspected→Transported2→Warehoused`);
  console.log(`\n  ✅ Passed: ${passed}/${total}  ❌ Failed: ${failed}/${total}`);
  console.log(`  Score: ${Math.round(passed / total * 100)}%  |  Thời gian: ${totalSec}s`);

  if (failed > 0) {
    console.log('\n  ❌ Bước thất bại:');
    testResults.filter(r => r.status === 'FAIL').forEach(r => console.log(`     • ${r.test}`));
  } else {
    console.log('\n  🎉 Toàn bộ vòng đời lô sầu riêng hoạt động chính xác!');
  }

  const rp = path.join(__dirname, '../../test-results/e2e-full-lifecycle.json');
  fs.mkdirSync(path.dirname(rp), { recursive: true });
  fs.writeFileSync(rp, JSON.stringify({
    timestamp: new Date().toISOString(),
    testType: 'e2e-full-lifecycle',
    summary: { passed, failed, total, score: Math.round(passed / total * 100), totalSec },
    batchInfo: { batchId, sscc, treeIds, batchName, batchQty, producerId: PRODUCER_ID },
    stagesCovered: Object.keys(STAGE),
    testResults
  }, null, 2));
  console.log(`\n  💾 ${rp}\n`);
  return { passed, failed };
}

if (require.main === module)
  run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
module.exports = { run };
