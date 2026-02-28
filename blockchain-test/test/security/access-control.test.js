/**
 * ACCESS CONTROL TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);
let passed=0, failed=0, warnings=0;
const testResults=[];

function assert(ok, name, detail='', sev='HIGH') {
  console.log(`  ${ok?'✅':'❌'} [${sev}] ${name}`);
  if (!ok && detail) console.log(`      ↳ ${detail}`);
  ok ? passed++ : failed++;
  testResults.push({test:name, status:ok?'PASS':'FAIL', severity:sev, detail});
}
function warn(name, detail='') {
  console.log(`  ⚠️  [WARN] ${name}`);
  if (detail) console.log(`      ↳ ${detail}`);
  warnings++;
  testResults.push({test:name, status:'WARN', severity:'MEDIUM', detail});
}

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  SECURITY TEST: Access Control');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const [owner, farmer1, farmer2, attacker] = accounts;

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  // Setup: 1 tree, 1 batch
  await H.registerTree(alInstance, owner, 'TREE-AC-001', 1, 1);
  const rb  = await H.createBatch(tcInstance, owner, 'AC Batch', 1, '500', 1);
  const bid = H.getBatchId(rb) || 1;

  // NHÓM 1: Tree owner
  console.log('\n  [NHÓM 1] Tree Owner Authorization');

  try {
    // farmer2 (farmerId=2) cố sửa cây của farmer1 (farmerId=1)
    await alInstance.methods.addTreeCareActivity(1n, 2n, 0n, 'Fake', 'X')
      .send({ from: farmer2, gas: 300000n });
    assert(false,'Farmer2 không được sửa cây farmer1','Không revert!','CRITICAL');
  } catch { assert(true,'Farmer2 không được sửa cây farmer1 ✓'); }

  try {
    await alInstance.methods.deactivateTree(1n, 2n, 'attack')
      .send({ from: farmer2, gas: 300000n });
    assert(false,'Farmer2 không được deactivate cây farmer1','','CRITICAL');
  } catch { assert(true,'Farmer2 không được deactivate cây farmer1 ✓'); }

  try {
    await alInstance.methods.deactivateTree(1n, 1n, 'Own decision')
      .send({ from: owner, gas: 300000n });
    assert(true,'Owner/farmer1 được deactivate cây của mình ✓');
  } catch(e) { assert(false,'Owner deactivate cây của mình', e.message.slice(0,80)); }

  // NHÓM 2: Batch approval
  console.log('\n  [NHÓM 2] Batch Approval');

  try {
    await H.approveBatch(tcInstance, attacker, bid, 999); // producerId sai
    assert(false,'Block approve producerId sai','','CRITICAL');
  } catch { assert(true,'Block approve producerId sai ✓'); }

  try {
    await H.approveBatch(tcInstance, owner, bid, 1);
    assert(true,'Owner approve batch hợp lệ ✓');
  } catch(e) { assert(false,'Owner approve batch hợp lệ', e.message.slice(0,80)); }

  try {
    await H.approveBatch(tcInstance, owner, bid, 1);
    assert(false,'Block double approval','','HIGH');
  } catch { assert(true,'Block double approval ✓'); }

  // NHÓM 3: Purchase on unapproved
  console.log('\n  [NHÓM 3] Purchase Authorization');
  const rb2 = await H.createBatch(tcInstance, owner, 'Unapproved', 1, '100', 1);
  const bid2 = H.getBatchId(rb2) || 2;

  try {
    await H.recordPurchase(tcInstance, owner, bid2);
    assert(false,'Block mua batch chưa approve','','HIGH');
  } catch { assert(true,'Block mua batch chưa approve ✓'); }

  // NHÓM 4: Duplicate QR
  console.log('\n  [NHÓM 4] QR Code Uniqueness');
  try {
    await H.registerTree(alInstance, owner, 'TREE-DUP', 1, 1);
    await H.registerTree(alInstance, owner, 'TREE-DUP', 2, 1); // duplicate
    assert(false,'Block duplicate QR cây','','HIGH');
  } catch { assert(true,'Block duplicate QR cây ✓'); }

  // NHÓM 5: ActivityLog access control
  console.log('\n  [NHÓM 5] ActivityLog – bất kỳ ai có thể ghi?');
  const logsBefore = await alInstance.methods.getActivityLogs(H.toBI(bid)).call();
  try {
    await alInstance.methods.addActivityLog(H.toBI(bid), 999n, 'Fake Log', 'By attacker', false)
      .send({ from: attacker, gas: 300000n });
    const logsAfter = await alInstance.methods.getActivityLogs(H.toBI(bid)).call();
    if (logsAfter.length > logsBefore.length)
      warn('Bất kỳ địa chỉ nào đều ghi được ActivityLog!','Cần thêm onlyAuthorized modifier');
    else
      assert(true,'ActivityLog có access control ✓');
  } catch { assert(true,'ActivityLog revert với attacker ✓'); }

  // NHÓM 6: Non-existent batch
  console.log('\n  [NHÓM 6] Non-existent Resource');
  try {
    await tcInstance.methods.getBatchDetails(99999n).call();
    assert(false,'Block truy cập batch không tồn tại','','MEDIUM');
  } catch { assert(true,'Block truy cập batch không tồn tại ✓'); }

  const total=passed+failed;
  console.log('\n' + '='.repeat(60));
  console.log(`  ✅ Passed:${passed}/${total}  ❌ Failed:${failed}  ⚠️ Warnings:${warnings}  Score:${Math.round(passed/total*100)}%`);
  console.log('='.repeat(60));

  const rp = path.join(__dirname,'../../test-results/access-control.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'access-control',summary:{passed,failed,warnings,total,score:Math.round(passed/total*100)},results:testResults},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return {passed,failed,warnings};
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
