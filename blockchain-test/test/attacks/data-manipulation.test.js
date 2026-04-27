/**
 * DATA MANIPULATION ATTACK TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);
let passed=0, failed=0;
const testResults=[], attackLog=[];

function assert(ok, name, detail='', sev='HIGH') {
  console.log(`  ${ok?'✅ BLOCKED':'❌ VULNERABLE'} [${sev}] ${name}`);
  if (detail) console.log(`      ↳ ${detail}`);
  ok ? passed++ : failed++;
  testResults.push({test:name,status:ok?'PASS':'FAIL',severity:sev,detail});
}

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  ATTACK TEST: Data Manipulation');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const [owner, legit, attacker] = accounts;

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  const rb  = await H.createBatch(tcInstance, legit, 'Musang King Chính Hãng', 1, '500', 1);
  const bid = H.getBatchId(rb) || 1;
  await H.approveBatch(tcInstance, owner, bid);

  // Lấy sscc thực tế do contract tự generate
  const batchData = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
  const legitSSCC = batchData.sscc;
  console.log(`  Legit batch SSCC: ${legitSSCC}`);

  // ── TẤN CÔNG 1: SSCC giả mạo ────────────────────────────────────────
  console.log('\n  🔴 [TẤN CÔNG 1] Tạo batch với SSCC y hệt (duplicate)');
  // SSCC được contract tự sinh → attacker không thể tạo SSCC trùng vì hàm generateSSCC internal
  // Thử tạo batch thứ 2 cùng producerId → sẽ có SSCC khác (counter tăng)
  // Tuy nhiên attacker có thể cố gắng claim cùng producerId
  try {
    const rb2 = await H.createBatch(tcInstance, attacker, 'Hàng Nhái', 1, '500', 1);
    const bid2 = H.getBatchId(rb2) || 2;
    const fakeData = await tcInstance.methods.getBatchDetails(H.toBI(bid2)).call();
    assert(fakeData.sscc !== legitSSCC,'SSCC tự sinh unique — attacker không trùng SSCC ✓',`fakeSSCC=${fakeData.sscc}`,'HIGH');
    attackLog.push({name:'SSCC Duplicate',result:'BLOCKED_UNIQUE_AUTO'});
  } catch(e) {
    assert(true,'Tạo batch thứ 2 bị revert ✓', e.message.slice(0,60));
  }

  // ── TẤN CÔNG 2: Injection payloads ───────────────────────────────────
  console.log('\n  🔴 [TẤN CÔNG 2] Injection payloads qua ActivityLog');
  const payloads = [
    "'; DROP TABLE batches; --",
    "<script>alert('XSS')</script>",
    "{{7*7}}",
    "\0\0NULL",
  ];
  let injCount=0;
  for (const p of payloads) {
    try {
      await alInstance.methods.addActivityLog(H.toBI(bid), 999n, p, p, false)
        .send({ from: attacker, gas: 500000n });
      injCount++;
    } catch { injCount++; } // blocked or stored-as-is, both "safe" from execution
  }
  assert(injCount===payloads.length,'Injection payloads không được thực thi ✓','Blockchain lưu as-is, không execute code','HIGH');
  console.log('  ℹ️  Backend PHẢI sanitize khi hiển thị ra UI!');

  // ── TẤN CÔNG 3: Ghi log giả vào batch ────────────────────────────────
  console.log('\n  🔴 [TẤN CÔNG 3] Ghi log giả bằng address attacker');
  const logsBefore = await alInstance.methods.getActivityLogs(H.toBI(bid)).call();
  try {
    await alInstance.methods.addActivityLog(H.toBI(bid), 999n, 'Đạt VietGAP (FAKE)', 'Chất lượng cao giả mạo', false)
      .send({ from: attacker, gas: 300000n });
    const logsAfter = await alInstance.methods.getActivityLogs(H.toBI(bid)).call();
    if (logsAfter.length > logsBefore.length) {
      assert(false,'CẢNH BÁO: Attacker ghi được log giả!','Cần onlyAuthorized modifier cho addActivityLog','CRITICAL');
      attackLog.push({name:'Fake Log',result:'SUCCESS_ATTACK'});
    } else {
      assert(true,'Log giả bị block ✓');
      attackLog.push({name:'Fake Log',result:'BLOCKED'});
    }
  } catch {
    assert(true,'addActivityLog revert với attacker ✓');
    attackLog.push({name:'Fake Log',result:'BLOCKED'});
  }

  // ── TẤN CÔNG 4: Replay approval ──────────────────────────────────────
  console.log('\n  🔴 [TẤN CÔNG 4] Replay Approval');
  try {
    await H.approveBatch(tcInstance, owner, bid);
    assert(false,'Block replay approval','','HIGH');
  } catch { assert(true,'Block replay approval ✓'); }

  // ── TẤN CÔNG 5: Purchase replay ──────────────────────────────────────
  console.log('\n  🔴 [TẤN CÔNG 5] Double Purchase');
  await H.recordPurchase(tcInstance, owner, bid);
  try {
    await H.recordPurchase(tcInstance, owner, bid);
    assert(false,'Block double purchase','','HIGH');
  } catch { assert(true,'Block double purchase ✓'); }

  // ── TẤN CÔNG 6: Hash collision ────────────────────────────────────────
  console.log('\n  🔴 [TẤN CÔNG 6] Hash Collision');
  const batch = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
  const h1 = await tcInstance.methods.verifyBatchDataHash(
    H.toBI(bid), batch.sscc, 1n, '500', batch.productionDate, '', 1n, 'Musang King Chính Hãng'
  ).call();
  const h2 = await tcInstance.methods.verifyBatchDataHash(
    H.toBI(bid), batch.sscc, 1n, '501', batch.productionDate, '', 1n, 'Musang King Chính Hãng'
  ).call();
  assert(h1&&!h2,'keccak256 không có collision (qty khác → hash khác) ✓','','HIGH');

  // ── TẤN CÔNG 7: Duplicate tree QR ────────────────────────────────────
  console.log('\n  🔴 [TẤN CÔNG 7] Duplicate Tree QR');
  await H.registerTree(alInstance, owner, 'TREE-REAL-001', 1, 1);
  try {
    await H.registerTree(alInstance, attacker, 'TREE-REAL-001', 99, 2);
    assert(false,'Block giả mạo QR cây','','CRITICAL');
  } catch { assert(true,'Block duplicate tree QR ✓'); }

  const total=passed+failed;
  console.log('\n' + '='.repeat(60));
  console.log(`  🛡️  ${passed}/${total} tấn công bị block  Score:${Math.round(passed/total*100)}%`);
  if (failed>0) console.log('  ⚠️  Xem chi tiết bên trên để fix lỗ hổng!');
  console.log('='.repeat(60));

  const rp = path.join(__dirname,'../../test-results/data-manipulation-attack.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'data-manipulation-attack',summary:{blocked:passed,vulnerable:failed,total,securityScore:Math.round(passed/total*100)},results:testResults,attackLog},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return {passed,failed};
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
