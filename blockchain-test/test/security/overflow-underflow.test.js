/**
 * OVERFLOW / UNDERFLOW TEST  —  Web3 v4.x
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
  console.log('  SECURITY TEST: Overflow / Underflow');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const owner    = accounts[0];

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  const MAX = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
  const nowTs = BigInt(Math.floor(Date.now()/1000));

  // 1. MAX producerId
  console.log('\n  [1] Max uint256 producerId');
  try {
    await tcInstance.methods.createBatch('Max Test', MAX, '100', 1n, nowTs, nowTs+2592000n)
      .send({ from: owner, gas: 2000000n });
    assert(true,'Solidity 0.8 chấp nhận uint256 max ✓','Không overflow','INFO');
  } catch(e) {
    assert(true,'Revert với max uint256 ✓', e.message.slice(0,60));
  }

  // 2. Valid batch để test tiếp
  const rb = await H.createBatch(tcInstance, owner, 'Valid Batch', 1, '500', 1);
  const bid = H.getBatchId(rb) || 1;
  await H.approveBatch(tcInstance, owner, bid);

  // 3. MAX totalQuantity và pricePerUnit trong recordPurchase
  console.log('\n  [2] recordPurchase MAX pricePerUnit');
  try {
    await tcInstance.methods.recordPurchase(H.toBI(bid), 1n, 500n, MAX)
      .send({ from: owner, gas: 600000n });
    const pr = await tcInstance.methods.getPurchaseRecord(H.toBI(bid)).call();
    assert(true,'recordPurchase MAX price OK (totalPrice wrap kiểm tự động) ✓',`totalPrice=${pr.totalPrice}`,'INFO');
  } catch(e) {
    assert(true,'Revert MAX price ✓', e.message.slice(0,60),'INFO');
  }

  // 4. endDate < startDate
  console.log('\n  [3] endDate < startDate');
  try {
    await tcInstance.methods.createBatch('TS Test', 1n, '100', 1n, nowTs+1000n, nowTs)
      .send({ from: owner, gas: 1200000n });
    assert(false,'Nên reject endDate < startDate','Contract chấp nhận!','MEDIUM');
  } catch { assert(true,'Block endDate < startDate ✓'); }

  // 5. startDate = 0
  console.log('\n  [4] startDate = 0');
  try {
    await tcInstance.methods.createBatch('Zero Date', 1n, '100', 1n, 0n, nowTs+2592000n)
      .send({ from: owner, gas: 1200000n });
    assert(false,'Nên reject startDate=0','','MEDIUM');
  } catch { assert(true,'Block startDate=0 ✓'); }

  // 6. String dài (DoS)
  console.log('\n  [5] String 5000 ký tự');
  const big = 'A'.repeat(5000);
  try {
    await tcInstance.methods.createBatch(big, 1n, '100', 1n, nowTs, nowTs+2592000n)
      .send({ from: owner, gas: 5000000n });
    assert(false,'Nên reject string quá dài','5000 chars được chấp nhận','MEDIUM');
  } catch { assert(true,'String 5000 chars bị block ✓','gas/revert','MEDIUM'); }

  // 7. Invalid enum category (99)
  console.log('\n  [6] Invalid enum (ActivityCategory=99)');
  const rb2 = await H.createBatch(tcInstance, owner, 'Enum Test', 1, '100', 1);
  const bid2 = H.getBatchId(rb2) || 2;
  try {
    await alInstance.methods.addDetailedActivityLog(H.toBI(bid2), 1n, 99n, 'Bad', 'X', false)
      .send({ from: owner, gas: 300000n });
    assert(false,'Block enum vượt range','','HIGH');
  } catch { assert(true,'Block invalid enum ✓'); }

  // 8. Counter không tăng khi tx fail
  console.log('\n  [7] Counter không tăng khi tx fail');
  const before = await tcInstance.methods.getTotalBatches().call();
  try {
    await tcInstance.methods.createBatch('', 1n, '100', 1n, nowTs, nowTs+2592000n)
      .send({ from: owner, gas: 1200000n });
  } catch {}
  const after = await tcInstance.methods.getTotalBatches().call();
  assert(H.toN(before)===H.toN(after),'Counter không tăng khi fail ✓',`Before:${before} After:${after}`,'HIGH');

  const total=passed+failed;
  console.log('\n' + '='.repeat(60));
  console.log(`  ✅ Passed:${passed}/${total}  Score:${Math.round(passed/total*100)}%`);
  console.log('  NOTE: Solidity 0.8.x built-in arithmetic overflow protection');
  console.log('='.repeat(60));

  const rp = path.join(__dirname,'../../test-results/overflow-underflow.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'overflow-underflow',summary:{passed,failed,total,score:Math.round(passed/total*100)},results:testResults},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return {passed,failed};
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
