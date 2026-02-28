/**
 * DoS ATTACK TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);
let passed=0, failed=0;
const testResults=[], metrics={};

function assert(ok, name, detail='', sev='HIGH') {
  console.log(`  ${ok?'✅':'❌'} [${sev}] ${name}`);
  if (detail) console.log(`      ↳ ${detail}`);
  ok ? passed++ : failed++;
  testResults.push({test:name,status:ok?'PASS':'FAIL',severity:sev,detail});
}

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  ATTACK TEST: Denial of Service (DoS)');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const [owner, attacker] = accounts;

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  // Seed 1 batch để đọc
  const rb  = await H.createBatch(tcInstance, owner, 'DoS Seed', 1, '100', 1);
  const bid = H.getBatchId(rb) || 1;

  // ── TEST 1: Block stuffing ───────────────────────────────────────────
  console.log('\n  [TEST 1] Block Stuffing (20 spam tx parallel)');
  const sStart=H.now();
  const sRes = await Promise.allSettled(Array.from({length:20},(_,i)=>
    H.createBatch(tcInstance, accounts[i%accounts.length], `Spam ${i}`, 99, '1', 1)
  ));
  const sDur=(H.now()-sStart)/1000;
  const sOk =sRes.filter(r=>r.status==='fulfilled').length;
  metrics.blockStuffing = { attempted:20, ok:sOk, durationSec:sDur.toFixed(2), tps:(sOk/sDur).toFixed(2) };
  console.log(`  ${sOk}/20 spam tx  ${sDur.toFixed(2)}s`);
  assert(sDur<60,'Block stuffing không block hệ thống ✓',`${sDur.toFixed(1)}s`,'MEDIUM');

  // ── TEST 2: Array growth ─────────────────────────────────────────────
  console.log('\n  [TEST 2] Array Growth (30 batches → scan)');
  for (let i=0;i<30;i++) {
    await H.createBatch(tcInstance, owner, `Growth ${i}`, 1, '50', 1);
    process.stdout.write(`\r  Seeding ${i+1}/30`);
  }
  console.log('');
  const scanTimes=[];
  for (let i=0;i<5;i++) {
    const t0=H.now();
    await tcInstance.methods.getBatchesByStage(0n).call();
    scanTimes.push(H.now()-t0);
  }
  const avgScan=H.calcStats(scanTimes).avg;
  metrics.arrayGrowth = { batchCount:31, avgScanMs:avgScan };
  console.log(`  getBatchesByStage (31 batches): ${avgScan.toFixed(0)}ms avg`);
  assert(avgScan<5000,'O(n) scan <5s ✓',`${avgScan.toFixed(0)}ms`,'MEDIUM');
  if (avgScan>1000) console.log('  ⚠️  Cần index mapping khi scale 1000+ batches');

  // ── TEST 3: Log spam ─────────────────────────────────────────────────
  console.log('\n  [TEST 3] Log Spam (30 logs → batch 1)');
  const logSpam = await Promise.allSettled(Array.from({length:30},(_,i)=>
    alInstance.methods.addActivityLog(H.toBI(bid), 99n, `Spam ${i}`, `Desc ${i}`, false)
      .send({ from: attacker, gas: 300000n })
  ));
  const logOk=logSpam.filter(r=>r.status==='fulfilled').length;
  const t0r=H.now();
  const allLogs=await alInstance.methods.getActivityLogs(H.toBI(bid)).call();
  const logReadMs=H.now()-t0r;
  metrics.logSpam = { spamOk:logOk, totalLogs:allLogs.length, readMs:logReadMs };
  console.log(`  ${logOk}/30 spam logs  getActivityLogs(${allLogs.length}): ${logReadMs.toFixed(0)}ms`);
  assert(logReadMs<3000,`getActivityLogs read <3s ✓`,`${logReadMs.toFixed(0)}ms`,'MEDIUM');
  if (logOk>0) console.log(`  ⚠️  ${logOk} spam logs ghi thành công → cần access control!`);

  // ── TEST 4: Concurrent heavy reads ──────────────────────────────────
  console.log('\n  [TEST 4] 15 concurrent getBatchesByStage');
  const hStart=H.now();
  await Promise.allSettled(Array.from({length:15},()=>tcInstance.methods.getBatchesByStage(0n).call()));
  const hDur=H.now()-hStart;
  metrics.heavyRead = { requests:15, durationMs:hDur };
  console.log(`  15 concurrent scans: ${hDur.toFixed(0)}ms`);
  assert(hDur<30000,'15 concurrent scans <30s ✓',`${hDur.toFixed(0)}ms`,'MEDIUM');

  const total=passed+failed;
  console.log('\n' + '='.repeat(60));
  console.log(`  DoS SUMMARY  ✅ ${passed}/${total} resistant`);
  console.log('\n  KHUYẾN NGHỊ:');
  console.log('  1. Rate limiting ở backend trước khi gửi tx');
  console.log('  2. Index mapping cho getBatchesByStage()');
  console.log('  3. Access control cho addActivityLog()');
  console.log('='.repeat(60));

  const rp = path.join(__dirname,'../../test-results/dos-attack.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'dos-attack',summary:{resistant:passed,vulnerable:failed,total},results:testResults,metrics},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return {passed,failed};
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
