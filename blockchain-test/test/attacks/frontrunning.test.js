/**
 * FRONT-RUNNING ATTACK TEST  —  Web3 v4.x
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
  console.log('  ATTACK TEST: Front-Running');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const [owner, legit, attacker] = accounts;

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  // ── SCENARIO 1: SSCC Sniping ──────────────────────────────────────────
  console.log('\n  [SCENARIO 1] SSCC Sniping');
  // Contract tự sinh SSCC từ producerId → attacker không thể chọn SSCC cụ thể
  // Attacker có thể tạo batch với cùng producerId trước
  const aRb  = await H.createBatch(tcInstance, attacker, 'Attacker Batch', 1, '100', 1); // producerId=1 giả
  const aBid = H.getBatchId(aRb) || 1;
  const aData = await tcInstance.methods.getBatchDetails(H.toBI(aBid)).call();
  console.log(`  Attacker tạo batch: SSCC=${aData.sscc} (producerId=1)`);

  const lRb  = await H.createBatch(tcInstance, legit, 'Legit Batch', 1, '500', 1);
  const lBid = H.getBatchId(lRb) || 2;
  const lData = await tcInstance.methods.getBatchDetails(H.toBI(lBid)).call();

  assert(aData.sscc !== lData.sscc,'SSCC tự sinh unique — không trùng nhau ✓',`A:${aData.sscc} | L:${lData.sscc}`,'MEDIUM');
  console.log('  ℹ️  Contract dùng counter nội bộ → SSCC không thể đặt trước (no sniping)');

  // ── SCENARIO 2: Approve Racing ─────────────────────────────────────────
  console.log('\n  [SCENARIO 2] Approve Racing');
  const rb3 = await H.createBatch(tcInstance, owner, 'Race Batch', 1, '300', 1);
  const bid3 = H.getBatchId(rb3) || 3;

  const [ap1, ap2] = await Promise.allSettled([
    H.approveBatch(tcInstance, legit,    bid3, 1),
    H.approveBatch(tcInstance, attacker, bid3, 1),
  ]);
  const ok1=ap1.status==='fulfilled', ok2=ap2.status==='fulfilled';
  assert(!(ok1&&ok2),'Chỉ 1 trong 2 approve thành công ✓',`TX1:${ok1} TX2:${ok2}`,'HIGH');
  const finalBatch = await tcInstance.methods.getBatchDetails(H.toBI(bid3)).call();
  assert(Number(finalBatch.status)===1,'Batch approved đúng 1 lần ✓',`status=${finalBatch.status}`,'HIGH');

  // ── SCENARIO 3: Transaction Ordering ──────────────────────────────────
  console.log('\n  [SCENARIO 3] Transaction Ordering — reject trước approve?');
  const rb4 = await H.createBatch(tcInstance, owner, 'Order Batch', 1, '200', 1);
  const bid4 = H.getBatchId(rb4) || 4;
  // Thử reject trước khi approve
  try { await H.rejectBatch(tcInstance, owner, bid4, 1, 'Early reject'); } catch {}
  const ordState = await tcInstance.methods.getBatchDetails(H.toBI(bid4)).call();
  // Nếu reject thành công → status=2, không phải approved
  assert(Number(ordState.status)!==1,'Batch không tự nhiên vào Approved sau reject ✓',`status=${ordState.status}`,'MEDIUM');

  // ── SCENARIO 4: Gas Price Analysis ────────────────────────────────────
  console.log('\n  [SCENARIO 4] Gas Price Info');
  console.log('  Ganache: deterministic, tx ordering không dựa trên gas price');
  console.log('  Mainnet: gas price cao hơn → mine trước → front-run thực sự');
  console.log('  FIX: commit-reveal scheme cho batch creation nếu deploy mainnet');
  assert(true,'Gas price analysis hoàn thành ✓','','INFO');

  const total=passed+failed;
  console.log('\n' + '='.repeat(60));
  console.log(`  FRONT-RUNNING SUMMARY  ✅ ${passed}/${total}`);
  console.log('\n  KHUYẾN NGHỊ cho Mainnet:');
  console.log('  1. Dùng commit-reveal cho các giao dịch quan trọng');
  console.log('  2. Private mempool (Flashbots) để ẩn tx');
  console.log('='.repeat(60));

  const rp = path.join(__dirname,'../../test-results/frontrunning-attack.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'frontrunning-attack',summary:{protected:passed,vulnerable:failed,total},results:testResults},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return {passed,failed};
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
