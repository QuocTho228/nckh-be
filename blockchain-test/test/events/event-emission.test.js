/**
 * EVENT EMISSION TEST  —  Web3 v4.x
 * ============================================================
 * Lý do cần test event:
 *   Backend sync dữ liệu vào MySQL qua event listener.
 *   Nếu event emit sai params → MySQL lưu sai → UI hiển thị sai.
 *   Smart contract không có cơ chế sửa dữ liệu đã emit.
 *
 * Events được kiểm tra (14 events):
 *   ActivityLog    : TreeRegistered, TreeDetailsStored,
 *                    ActivityLogAdded, ActivityLogDetailsStored, TreeDeactivated
 *   TraceabilityContract: BatchCreated, BatchDetailsStored, BatchApproved,
 *                    BatchRejected, StageUpdated(×5), PurchaseRecorded,
 *                    TransportStatusUpdated, ProcessingRecorded,
 *                    QualityTestRecorded, WarehouseConfirmed
 * ============================================================
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);

let passed = 0, failed = 0;
const results = [];

function assert(ok, name, got = '', expect = '') {
  const icon = ok ? '  ✅' : '  ❌';
  console.log(`${icon} ${name}`);
  if (!ok && (got || expect)) console.log(`       expect: ${expect}  got: ${got}`);
  ok ? passed++ : failed++;
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', got, expect });
}

// Lấy returnValues của event từ receipt
const ev = (receipt, name) => receipt?.events?.[name]?.returnValues ?? null;
const has = (receipt, name) => !!receipt?.events?.[name];
const eqN = (a, b) => Number(a) === Number(b);

async function run() {
  console.log('\n' + '='.repeat(62));
  console.log('  EVENT EMISSION TEST');
  console.log('  Xác minh params của từng event — dữ liệu backend sync');
  console.log('='.repeat(62));

  const accounts = await web3.eth.getAccounts();
  const [owner, user1, user2] = accounts;
  const { alInstance: al, tcInstance: tc } = await H.deployContracts(web3, owner);
  console.log('\n  [SETUP] Deployed ✅\n');

  // ══════════════════════════════════════════════════════════════
  // PHẦN 1: ActivityLog events
  // ══════════════════════════════════════════════════════════════
  console.log('─'.repeat(62));
  console.log('  PHẦN 1: ActivityLog Events');
  console.log('─'.repeat(62));

  // 1.1 TreeRegistered + TreeDetailsStored
  console.log('\n  [1.1] event TreeRegistered + TreeDetailsStored');
  const treeQR = `QR-EV-${Date.now()}`;
  const treeR  = await al.methods
    .registerTree(treeQR, 1n, 1n, 'Musang King', 'Premium D197', '10.45,106.32')
    .send({ from: user1, gas: 600000n });

  const eReg = ev(treeR, 'TreeRegistered');
  assert(!!eReg,                        'TreeRegistered được emit');
  assert(eReg?.treeQRCode === treeQR,   'treeQRCode đúng',          eReg?.treeQRCode, treeQR);
  assert(eqN(eReg?.farmerId, 1),        'farmerId = 1',             String(eReg?.farmerId), '1');
  assert(eqN(eReg?.regionId, 1),        'regionId = 1',             String(eReg?.regionId), '1');
  assert(eReg?.treeType === 'Musang King', 'treeType đúng',         eReg?.treeType, 'Musang King');
  assert(Number(eReg?.plantedDate) > 0, 'plantedDate = block.timestamp (>0)');

  const eDet = ev(treeR, 'TreeDetailsStored');
  assert(!!eDet,                        'TreeDetailsStored được emit');
  assert(eDet?.variety === 'Premium D197', 'variety đúng',          eDet?.variety, 'Premium D197');
  assert(eDet?.coordinates === '10.45,106.32', 'coordinates đúng',  eDet?.coordinates, '10.45,106.32');

  const treeId = Number(eReg?.treeId ?? 1n);

  // 1.2 ActivityLogAdded + ActivityLogDetailsStored
  console.log('\n  [1.2] event ActivityLogAdded + ActivityLogDetailsStored');
  const bR  = await H.createBatch(tc, owner, 'Event Batch', 1, '500', 1);
  const bid = H.getBatchId(bR) || 1;

  const actName = 'Thu hoạch lô Musang King';
  const actDesc = 'Đạt chuẩn VietGAP, thu hoạch thủ công';
  const logR = await al.methods
    .addActivityLog(H.toBI(bid), 1n, actName, actDesc, false)
    .send({ from: user1, gas: 300000n });

  const eLog = ev(logR, 'ActivityLogAdded');
  assert(!!eLog,                        'ActivityLogAdded được emit');
  assert(eqN(eLog?.batchId, bid),       `batchId = ${bid}`,         String(eLog?.batchId), String(bid));
  assert(eqN(eLog?.participantId, 1),   'participantId = 1',        String(eLog?.participantId), '1');
  assert(Number(eLog?.logId) > 0,       'logId > 0 (auto-increment)');
  assert(Number(eLog?.timestamp) > 0,   'timestamp = block.timestamp (>0)');
  assert(eLog?.isSystemGenerated === false, 'isSystemGenerated = false');

  const eLogDet = ev(logR, 'ActivityLogDetailsStored');
  assert(!!eLogDet,                     'ActivityLogDetailsStored được emit');
  assert(eLogDet?.activityName === actName, 'activityName đúng',    eLogDet?.activityName, actName);
  assert(eLogDet?.description === actDesc,  'description đúng',     eLogDet?.description, actDesc);

  // 1.3 TreeDeactivated
  console.log('\n  [1.3] event TreeDeactivated');
  const reason = 'Hết vòng đời kinh tế 20 năm';
  const deR = await al.methods
    .deactivateTree(H.toBI(treeId), 1n, reason)
    .send({ from: user1, gas: 300000n });

  const eDea = ev(deR, 'TreeDeactivated');
  assert(!!eDea,                        'TreeDeactivated được emit');
  assert(eqN(eDea?.treeId, treeId),     `treeId = ${treeId}`,       String(eDea?.treeId), String(treeId));
  assert(eqN(eDea?.farmerId, 1),        'farmerId = 1');
  assert(eDea?.reason === reason,       'reason đúng',              eDea?.reason, reason);

  // ══════════════════════════════════════════════════════════════
  // PHẦN 2: TraceabilityContract events
  // ══════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(62));
  console.log('  PHẦN 2: TraceabilityContract Events');
  console.log('─'.repeat(62));

  // 2.1 BatchCreated + BatchDetailsStored + StageUpdated(Created)
  console.log('\n  [2.1] BatchCreated + BatchDetailsStored + StageUpdated(Created)');
  const bName = 'Musang King Premium — Vụ Hè Thu';
  const bQty  = '850';
  const now   = BigInt(Math.floor(Date.now() / 1000));

  const cR = await tc.methods
    .createBatch(bName, 2n, bQty, 1n, now, now + 2592000n)
    .send({ from: user1, gas: 1200000n });

  const eBC  = ev(cR, 'BatchCreated');
  const eBDS = ev(cR, 'BatchDetailsStored');
  const eSU0 = ev(cR, 'StageUpdated');

  assert(!!eBC,                         'BatchCreated được emit');
  assert(eqN(eBC?.producerId, 2),       'producerId = 2',           String(eBC?.producerId), '2');
  assert(eqN(eBC?.productTypeId, 1),    'productTypeId = 1');
  assert(typeof eBC?.sscc === 'string' && eBC.sscc.length > 0, 'sscc auto-generated (không rỗng)');
  assert(Number(eBC?.batchId) > 0,      'batchId > 0');
  assert(Number(eBC?.productionDate) > 0, 'productionDate = block.timestamp');
  // dataHash phải là bytes32 hợp lệ, không phải 0x000...
  const dhash = eBC?.dataHash ?? '';
  assert(dhash.length === 66 && dhash !== '0x' + '0'.repeat(64),
    'dataHash là bytes32 hợp lệ (non-zero)');

  assert(!!eBDS,                        'BatchDetailsStored được emit');
  assert(eBDS?.name === bName,          'name đúng',                eBDS?.name, bName);
  assert(eBDS?.quantity === bQty,       'quantity đúng',            eBDS?.quantity, bQty);
  assert(eqN(eBDS?.startDate, now),     'startDate đúng');

  assert(!!eSU0,                        'StageUpdated(Created) được emit');
  assert(Number(eSU0?.newStage) === 0,  'newStage = 0 (Created)',   String(eSU0?.newStage), '0');

  const testBid  = Number(eBC?.batchId);
  const testSSCC = eBC?.sscc;

  // 2.2 BatchApproved
  console.log('\n  [2.2] BatchApproved');
  const aR = await tc.methods
    .approveBatch(H.toBI(testBid), 2n)
    .send({ from: owner, gas: 500000n });

  const eBA = ev(aR, 'BatchApproved');
  assert(!!eBA,                         'BatchApproved được emit');
  assert(eqN(eBA?.batchId, testBid),    `batchId = ${testBid}`);
  assert(eqN(eBA?.producerId, 2),       'producerId = 2');
  assert(eBA?.sscc === testSSCC,        'sscc = sscc gốc khi tạo batch');

  // 2.3 BatchRejected
  console.log('\n  [2.3] BatchRejected');
  const rbR  = await H.createBatch(tc, owner, 'Reject Batch', 3, '100', 2);
  const rbid = H.getBatchId(rbR);
  const rejReason = 'Không đạt tiêu chuẩn TCVN 1857:2009';
  const rjR = await tc.methods
    .rejectBatch(H.toBI(rbid), 3n, rejReason)
    .send({ from: owner, gas: 500000n });

  const eBR = ev(rjR, 'BatchRejected');
  assert(!!eBR,                         'BatchRejected được emit');
  assert(eqN(eBR?.batchId, rbid),       `batchId = ${rbid}`);
  assert(eBR?.reason === rejReason,     'reason đúng',              eBR?.reason, rejReason);

  // 2.4 PurchaseRecorded + StageUpdated(Purchased)
  console.log('\n  [2.4] PurchaseRecorded + StageUpdated(Purchased)');
  const pQty   = 850;
  const pPrice = 95000;
  const pR = await tc.methods
    .recordPurchase(H.toBI(testBid), 3n, H.toBI(pQty), H.toBI(pPrice))
    .send({ from: user2, gas: 500000n });

  const ePR  = ev(pR, 'PurchaseRecorded');
  const eSU1 = ev(pR, 'StageUpdated');
  assert(!!ePR,                         'PurchaseRecorded được emit');
  assert(eqN(ePR?.batchId, testBid),    `batchId = ${testBid}`);
  assert(eqN(ePR?.purchaserId, 3),      'purchaserId = 3');
  assert(eqN(ePR?.totalQuantity, pQty), `totalQuantity = ${pQty}`);
  assert(Number(ePR?.purchaseId) > 0,   'purchaseId > 0');
  // totalPrice = qty × price tính trong contract
  assert(BigInt(ePR?.totalPrice ?? 0) === BigInt(pQty) * BigInt(pPrice),
    `totalPrice = ${pQty} × ${pPrice} = ${(pQty * pPrice).toLocaleString()}`);
  assert(!!eSU1,                        'StageUpdated(Purchased) được emit');
  assert(Number(eSU1?.newStage) === 1,  'newStage = 1 (Purchased)',  String(eSU1?.newStage), '1');

  // 2.5 TransportStatusUpdated + StageUpdated(Transported1)
  console.log('\n  [2.5] TransportStatusUpdated + StageUpdated(Transported1)');
  const trStartR = await tc.methods
    .updateTransportStatus(H.toBI(testBid), 4n, 0, 27, 72)
    .send({ from: accounts[4], gas: 500000n });

  const eTrStart = ev(trStartR, 'TransportStatusUpdated');
  assert(!!eTrStart,                    'TransportStatusUpdated (start) được emit');
  assert(eqN(eTrStart?.batchId, testBid), `batchId = ${testBid}`);
  assert(Number(eTrStart?.actionCode) === 0, 'actionCode = 0 (start)');
  assert(Number(eTrStart?.newStatus) === 1,  'newStatus = 1 (InTransit)');

  const trEndR = await tc.methods
    .updateTransportStatus(H.toBI(testBid), 4n, 3, 25, 68)
    .send({ from: accounts[4], gas: 500000n });

  const eSU2 = ev(trEndR, 'StageUpdated');
  assert(!!eSU2,                        'StageUpdated(Transported1) được emit');
  assert(Number(eSU2?.newStage) === 2,  'newStage = 2 (Transported1)', String(eSU2?.newStage), '2');
  const eTrEnd = ev(trEndR, 'TransportStatusUpdated');
  assert(Number(eTrEnd?.newStatus) === 3, 'newStatus = 3 (Delivered) khi actionCode=3');

  // 2.6 ProcessingRecorded + StageUpdated(Processed)
  console.log('\n  [2.6] ProcessingRecorded + StageUpdated(Processed)');
  const prR = await tc.methods
    .recordProcessing(H.toBI(testBid), 5n, 0, 850n, 815n)
    .send({ from: accounts[5], gas: 500000n });

  const eProc = ev(prR, 'ProcessingRecorded');
  const eSU3  = ev(prR, 'StageUpdated');
  assert(!!eProc,                       'ProcessingRecorded được emit');
  assert(eqN(eProc?.batchId, testBid),  `batchId = ${testBid}`);
  assert(eqN(eProc?.processorId, 5),    'processorId = 5');
  assert(Number(eProc?.method) === 0,   'method = 0 (Washing)');
  assert(Number(eProc?.processingId) > 0, 'processingId > 0');
  assert(!!eSU3,                        'StageUpdated(Processed) được emit');
  assert(Number(eSU3?.newStage) === 3,  'newStage = 3 (Processed)',  String(eSU3?.newStage), '3');

  // 2.7 QualityTestRecorded pass + StageUpdated(QualityInspected)
  console.log('\n  [2.7] QualityTestRecorded (passed=true) + StageUpdated(QualityInspected)');
  const qtR = await tc.methods
    .recordQualityTest(H.toBI(testBid), 6n, true)
    .send({ from: accounts[6], gas: 500000n });

  const eQT  = ev(qtR, 'QualityTestRecorded');
  const eSU4 = ev(qtR, 'StageUpdated');
  assert(!!eQT,                         'QualityTestRecorded được emit');
  assert(eqN(eQT?.batchId, testBid),    `batchId = ${testBid}`);
  assert(eqN(eQT?.inspectorId, 6),      'inspectorId = 6');
  assert(eQT?.passed === true,          'passed = true',             String(eQT?.passed), 'true');
  assert(Number(eQT?.testId) > 0,       'testId > 0');
  assert(!!eSU4,                        'StageUpdated(QualityInspected) được emit');
  assert(Number(eSU4?.newStage) === 4,  'newStage = 4 (QualityInspected)', String(eSU4?.newStage), '4');

  // 2.7b QualityTestRecorded passed=false → KHÔNG emit StageUpdated
  console.log('\n  [2.7b] QualityTestRecorded (passed=false) — không emit StageUpdated');
  const fb  = await H.createBatch(tc, owner, 'Fail QT', 1, '200', 1);
  const fid = H.getBatchId(fb);
  await H.approveBatch(tc, owner, fid);
  await H.recordPurchase(tc, owner, fid);
  await tc.methods.updateTransportStatus(H.toBI(fid),1n,0,28,75).send({from:owner,gas:500000n});
  await tc.methods.updateTransportStatus(H.toBI(fid),1n,3,25,70).send({from:owner,gas:500000n});
  await tc.methods.recordProcessing(H.toBI(fid),1n,0,200n,190n).send({from:owner,gas:500000n});
  const qtFailR = await tc.methods.recordQualityTest(H.toBI(fid), 6n, false).send({from:accounts[6],gas:500000n});
  const eQTF = ev(qtFailR, 'QualityTestRecorded');
  assert(eQTF?.passed === false,        'passed = false khi không đạt ✓');
  assert(!has(qtFailR, 'StageUpdated'), 'KHÔNG emit StageUpdated khi failed ✓');

  // 2.8 WarehouseConfirmed + StageUpdated(Transported2 & Warehoused)
  console.log('\n  [2.8] WarehouseConfirmed + StageUpdated(Transported2 → Warehoused)');
  // Transport lần 2: QualityInspected → Transported2
  const tr2StartR = await tc.methods.updateTransportStatus(H.toBI(testBid),4n,0,18,80).send({from:accounts[4],gas:500000n});
  const tr2EndR   = await tc.methods.updateTransportStatus(H.toBI(testBid),4n,3,16,78).send({from:accounts[4],gas:500000n});
  const eSU5 = ev(tr2EndR, 'StageUpdated');
  assert(!!eSU5,                        'StageUpdated(Transported2) được emit');
  assert(Number(eSU5?.newStage) === 5,  'newStage = 5 (Transported2)', String(eSU5?.newStage), '5');

  const whR = await tc.methods
    .warehouseConfirmation(H.toBI(testBid), 7n)
    .send({ from: accounts[7], gas: 300000n });

  const eWH  = ev(whR, 'WarehouseConfirmed');
  const eSU6 = ev(whR, 'StageUpdated');
  assert(!!eWH,                         'WarehouseConfirmed được emit');
  assert(eqN(eWH?.batchId, testBid),    `batchId = ${testBid}`);
  assert(eqN(eWH?.warehouseId, 7),      'warehouseId = 7');
  assert(!!eSU6,                        'StageUpdated(Warehoused) được emit');
  assert(Number(eSU6?.newStage) === 6,  'newStage = 6 (Warehoused)', String(eSU6?.newStage), '6');

  // ══════════════════════════════════════════════════════════════
  // PHẦN 3: getPastEvents — kiểm tra indexed params
  // ══════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(62));
  console.log('  PHẦN 3: getPastEvents — indexed param filter');
  console.log('─'.repeat(62));

  const toBlock = await web3.eth.getBlockNumber();

  const pastBC = await tc.getPastEvents('BatchCreated',
    { filter: { producerId: 2n }, fromBlock: 0n, toBlock });
  assert(pastBC.length >= 1,
    `getPastEvents BatchCreated filter producerId=2 → ${pastBC.length} kết quả ✓`);

  const pastApproved = await tc.getPastEvents('BatchApproved',
    { fromBlock: 0n, toBlock });
  assert(pastApproved.length >= 1,
    `getPastEvents BatchApproved → ${pastApproved.length} kết quả ✓`);

  const pastTree = await al.getPastEvents('TreeRegistered',
    { filter: { farmerId: 1n }, fromBlock: 0n, toBlock });
  assert(pastTree.length >= 1,
    `getPastEvents TreeRegistered filter farmerId=1 → ${pastTree.length} kết quả ✓`);

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  const total = passed + failed;
  console.log('\n' + '='.repeat(62));
  console.log('  EVENT EMISSION SUMMARY');
  console.log('='.repeat(62));
  console.log(`\n  ✅ Passed: ${passed}/${total}  ❌ Failed: ${failed}/${total}`);
  console.log(`  Score: ${Math.round(passed / total * 100)}%`);

  if (failed > 0) {
    console.log('\n  ❌ Lỗi cần fix (backend sync sẽ sai MySQL):');
    results.filter(r => r.status === 'FAIL').forEach(r =>
      console.log(`     • ${r.test}  expect: ${r.expect}  got: ${r.got}`));
  } else {
    console.log('\n  🎉 Tất cả events emit đúng params — backend sync an toàn!');
  }

  const rp = path.join(__dirname, '../../test-results/event-emission.json');
  fs.mkdirSync(path.dirname(rp), { recursive: true });
  fs.writeFileSync(rp, JSON.stringify({
    timestamp: new Date().toISOString(),
    testType: 'event-emission',
    summary: { passed, failed, total, score: Math.round(passed / total * 100) },
    eventsCovered: [
      'TreeRegistered', 'TreeDetailsStored', 'ActivityLogAdded',
      'ActivityLogDetailsStored', 'TreeDeactivated',
      'BatchCreated', 'BatchDetailsStored', 'BatchApproved', 'BatchRejected',
      'StageUpdated(×5 transitions)', 'PurchaseRecorded',
      'TransportStatusUpdated', 'ProcessingRecorded',
      'QualityTestRecorded(pass+fail)', 'WarehouseConfirmed'
    ],
    results
  }, null, 2));
  console.log(`\n  💾 ${rp}\n`);
  return { passed, failed };
}

if (require.main === module)
  run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
module.exports = { run };
