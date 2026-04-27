/**
 * LOAD TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  LOAD TEST');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const results  = {};

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner = accounts[0]);
  console.log('\n[SETUP] Deployed ✅\n');

  // ── TEST 1: Sequential 30 tx ─────────────────────────────────────────
  console.log('[TEST 1] Sequential (30 createBatch)');
  let ok=0, err=0;
  const seqStart=H.now();
  for (let i=0;i<30;i++) {
    try {
      await H.createBatch(tcInstance, accounts[i%accounts.length], `Seq ${i}`, 1, `${(i+1)*50}`, 1);
      ok++;
    } catch { err++; }
    process.stdout.write(`\r  ${ok+err}/30`);
  }
  const seqDur=(H.now()-seqStart)/1000;
  results.sequential = { total:30, ok, err, durationSec:seqDur.toFixed(2), tps:(ok/seqDur).toFixed(2) };
  console.log(`\n  OK:${ok}/30  TPS:${results.sequential.tps}`);

  // ── TEST 2: Burst 15 parallel ────────────────────────────────────────
  console.log('\n[TEST 2] Burst (15 parallel createBatch)');
  const bStart=H.now();
  const bRes = await Promise.all(Array.from({length:15},(_,i)=>
    H.createBatch(tcInstance, accounts[i%accounts.length], `Burst ${i}`, 1, `${(i+1)*50}`, 1)
      .then(()=>true).catch(()=>false)
  ));
  const bDur=(H.now()-bStart)/1000;
  const bOk=bRes.filter(Boolean).length;
  results.burst = { total:15, ok:bOk, err:15-bOk, durationSec:bDur.toFixed(2), tps:(bOk/bDur).toFixed(2) };
  console.log(`  OK:${bOk}/15  TPS:${results.burst.tps}`);

  // ── TEST 3: Mixed 70% read / 30% write ──────────────────────────────
  console.log('\n[TEST 3] Mixed 20 concurrent (70% read / 30% write)');
  let rOk=0, wOk=0, mErr=0;
  const mStart=H.now();
  await Promise.allSettled(Array.from({length:20},(_,i)=>{
    if (i%3 !== 0) {
      return tcInstance.methods.getBatchDetails(1n).call().then(()=>rOk++).catch(()=>mErr++);
    } else {
      return H.addActivityLog(alInstance, accounts[i%accounts.length], 1, `Mix ${i}`, `Desc ${i}`)
        .then(()=>wOk++).catch(()=>mErr++);
    }
  }));
  const mDur=(H.now()-mStart)/1000;
  results.mixed = { reads:rOk, writes:wOk, errors:mErr, rps:((rOk+wOk)/mDur).toFixed(2) };
  console.log(`  Reads:${rOk}  Writes:${wOk}  Errors:${mErr}  RPS:${results.mixed.rps}`);

  // ── TEST 4: Sustained 8s ─────────────────────────────────────────────
  console.log('\n[TEST 4] Sustained 8s');
  let sTx=0, sOk=0; const lat=[];
  const sLimit=H.now()+8000;
  while (H.now()<sLimit) {
    const t0=H.now();
    try {
      await H.createBatch(tcInstance, accounts[sTx%accounts.length], `Sus ${sTx}`, 1, '50', 1);
      lat.push(H.now()-t0); sOk++;
    } catch {}
    sTx++;
  }
  const sStats=H.calcStats(lat);
  results.sustained = { durationSec:8, total:sTx, ok:sOk, tps:(sOk/8).toFixed(2), avgMs:sStats.avg.toFixed(0), p95Ms:sStats.p95.toFixed(0) };
  console.log(`  TPS:${results.sustained.tps}  Avg:${results.sustained.avgMs}ms  P95:${results.sustained.p95Ms}ms`);

  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log(`  Sequential TPS: ${results.sequential.tps}`);
  console.log(`  Burst TPS:      ${results.burst.tps}`);
  console.log(`  Mixed RPS:      ${results.mixed.rps}`);
  console.log(`  Sustained TPS:  ${results.sustained.tps}`);
  console.log('='.repeat(60));

  const rp = path.join(__dirname,'../../test-results/load-test.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'load-test',results},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return results;
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
