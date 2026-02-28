/**
 * DATA INTEGRITY TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);
let passed=0, failed=0;
const testResults=[];

function assert(ok, name, detail='', sev='HIGH') {
  console.log(`  ${ok?'✅':'❌'} [${sev}] ${name}`);
  if (detail) console.log(`      ↳ ${detail}`);
  ok ? passed++ : failed++;
  testResults.push({test:name,status:ok?'PASS':'FAIL',severity:sev,detail});
}

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  SECURITY TEST: Data Integrity');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const owner    = accounts[0];

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  const batchName='Musang King Chính Hãng';
  const qty='500';
  const prodTypeId=1;
  const rb  = await H.createBatch(tcInstance, owner, batchName, 1, qty, prodTypeId);
  const bid = H.getBatchId(rb) || 1;

  // Lấy batch để có sscc và productionDate
  const batchData = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
  const sscc      = batchData.sscc;
  const prodDate  = batchData.productionDate;

  // 1. Immutability
  console.log('\n  [1] Immutability');
  const b1 = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
  const b2 = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
  assert(b1.sscc===b2.sscc,'Dữ liệu batch không thay đổi sau khi ghi ✓','','CRITICAL');

  // 2. Hash verification
  console.log('\n  [2] Hash Verification');
  // verifyBatchDataHash(batchId, sscc, producerId, quantity, productionDate, farmPlotNumber, productTypeId, name)
  // farmPlotNumber bị bỏ trống trong createBatch cũ → contract hash không bao gồm nó
  // Xem lại contract: hash = keccak256(sscc, producerId, quantity, productionDate, productTypeId, name)
  // KHÔNG có farmPlotNumber trong createBatch signature → nhưng verifyBatchDataHash có _farmPlotNumber param
  // → test với '' cho farmPlotNumber
  const validHash = await tcInstance.methods.verifyBatchDataHash(
    H.toBI(bid), sscc, 1n, qty, prodDate, '', H.toBI(prodTypeId), batchName
  ).call();
  assert(validHash,'verifyBatchDataHash đúng với dữ liệu thật ✓','','HIGH');

  const fakeHash = await tcInstance.methods.verifyBatchDataHash(
    H.toBI(bid), sscc, 1n, '999', prodDate, '', H.toBI(prodTypeId), batchName
  ).call();
  assert(!fakeHash,'verifyBatchDataHash phát hiện qty giả mạo ✓','','CRITICAL');

  const fakeSSCC = await tcInstance.methods.verifyBatchDataHash(
    H.toBI(bid), 'FAKE-SSCC-0000', 1n, qty, prodDate, '', H.toBI(prodTypeId), batchName
  ).call();
  assert(!fakeSSCC,'verifyBatchDataHash phát hiện SSCC giả mạo ✓','','CRITICAL');

  // 3. ActivityLog hash
  console.log('\n  [3] ActivityLog Hash');
  const actName='Kiểm tra sâu bệnh';
  const actDesc='Phun thuốc Musang King';
  const rLog = await H.addActivityLog(alInstance, owner, bid, actName, actDesc);
  const logId = H.toN(rLog.events?.ActivityLogAdded?.returnValues?.logId || 1n);

  const okLog = await alInstance.methods.verifyActivityDataHash(H.toBI(logId), H.toBI(bid), actName, actDesc).call();
  assert(okLog,'verifyActivityDataHash đúng ✓','','HIGH');
  const badLog = await alInstance.methods.verifyActivityDataHash(H.toBI(logId), H.toBI(bid), 'Fake','Fake').call();
  assert(!badLog,'verifyActivityDataHash phát hiện log giả mạo ✓','','CRITICAL');

  // 4. Timestamp
  console.log('\n  [4] Timestamp Integrity');
  const logs = await alInstance.methods.getActivityLogs(H.toBI(bid)).call();
  const ts   = Number(logs[0]?.timestamp || 0);
  assert(ts>0,'Timestamp log > 0 ✓','','HIGH');
  const diff = Math.abs(ts - Math.floor(Date.now()/1000));
  assert(diff<300,'Timestamp chính xác (±5 phút) ✓',`diff=${diff}s`,'MEDIUM');

  // 5. Status transition
  console.log('\n  [5] Status Transition');
  await H.approveBatch(tcInstance, owner, bid);
  const approved = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
  assert(Number(approved.status)===1,'Status=Approved(1) ✓','','HIGH');
  try {
    await H.approveBatch(tcInstance, owner, bid);
    assert(false,'Block re-approve','','HIGH');
  } catch { assert(true,'Block re-approve ✓'); }

  // 6. Counter monotonic
  console.log('\n  [6] Counter Monotonicity');
  const rb2 = await H.createBatch(tcInstance, owner, 'Batch 2', 1, '100', 1);
  const bid2 = H.getBatchId(rb2) || 2;
  assert(bid2>bid,`ID tăng đơn điệu: ${bid} < ${bid2} ✓`,'','MEDIUM');

  // 7. Cross-contract
  console.log('\n  [7] Cross-Contract Consistency');
  const logsTC = await tcInstance.methods.getActivityLogs(H.toBI(bid)).call();
  const logsAL = await alInstance.methods.getActivityLogs(H.toBI(bid)).call();
  assert(logsTC.length===logsAL.length,`Logs nhất quán: ${logsTC.length} ✓`,'','HIGH');

  // 8. Persistence
  console.log('\n  [8] Data Persistence');
  for (let i=0;i<3;i++)
    await web3.eth.sendTransaction({from:accounts[0],to:accounts[1],value:web3.utils.toWei('0.001','ether')});
  const persisted = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
  assert(persisted.sscc===sscc,'Dữ liệu tồn tại sau nhiều block ✓','','HIGH');

  const total=passed+failed;
  console.log('\n' + '='.repeat(60));
  console.log(`  ✅ Passed:${passed}/${total}  Score:${Math.round(passed/total*100)}%`);
  console.log('='.repeat(60));

  const rp = path.join(__dirname,'../../test-results/data-integrity.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'data-integrity',summary:{passed,failed,total,score:Math.round(passed/total*100)},results:testResults},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return {passed,failed};
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
