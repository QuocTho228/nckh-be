/**
 * WRITE PERFORMANCE TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  WRITE PERFORMANCE TEST');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const owner    = accounts[0];
  const results  = {};

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);
  console.log('\n[SETUP] Deployed ✅\n');

  // helper: average gas from receipts (BigInt-safe)
  const avgGas = (arr) => Math.round(arr.reduce((s, v) => s + H.toN(v), 0) / arr.length);

  // ── TEST 1: registerTree ─────────────────────────────────────────────
  console.log('[TEST 1] registerTree()  n=15');
  const treeTimes=[], treeGas=[];
  for (let i=0; i<15; i++) {
    const t0 = H.now();
    const r  = await H.registerTree(alInstance, owner, `TREE-WP-${Date.now()}-${i}`);
    treeTimes.push(H.now()-t0);
    treeGas.push(r.gasUsed);
    process.stdout.write(`\r  ${i+1}/15`);
    await H.sleep(30);
  }
  results.registerTree = { stats: H.calcStats(treeTimes), gasAvg: avgGas(treeGas) };
  const s1 = results.registerTree.stats;
  console.log(`\n  Avg:${s1.avg.toFixed(0)}ms  P95:${s1.p95.toFixed(0)}ms  Gas:${results.registerTree.gasAvg.toLocaleString()}`);

  // ── TEST 2: createBatch ──────────────────────────────────────────────
  console.log('\n[TEST 2] createBatch()  n=15');
  const batchTimes=[], batchGas=[], batchIds=[];
  for (let i=0; i<15; i++) {
    const t0 = H.now();
    const r  = await H.createBatch(tcInstance, owner, `Lô Sầu Riêng ${i}`, 1, `${(i+1)*100}`, 1);
    batchTimes.push(H.now()-t0);
    batchGas.push(r.gasUsed);
    batchIds.push(H.getBatchId(r) || (i+1));
    process.stdout.write(`\r  ${i+1}/15`);
    await H.sleep(30);
  }
  results.createBatch = { stats: H.calcStats(batchTimes), gasAvg: avgGas(batchGas) };
  const s2 = results.createBatch.stats;
  console.log(`\n  Avg:${s2.avg.toFixed(0)}ms  P95:${s2.p95.toFixed(0)}ms  Gas:${results.createBatch.gasAvg.toLocaleString()}`);

  // ── TEST 3: addDetailedActivityLog ───────────────────────────────────
  console.log('\n[TEST 3] addDetailedActivityLog()  n=20');
  const logTimes=[], logGas=[];
  const cats = [0,1,2,3,4]; // Farming, Processing, Transport, Quality, TreeManagement
  for (let i=0; i<20; i++) {
    const t0 = H.now();
    const r  = await H.addDetailedLog(alInstance, owner, batchIds[0], cats[i%cats.length], `Hoạt động ${i}`, `Mô tả ${i}`);
    logTimes.push(H.now()-t0);
    logGas.push(r.gasUsed);
    process.stdout.write(`\r  ${i+1}/20`);
    await H.sleep(20);
  }
  results.addDetailedLog = { stats: H.calcStats(logTimes), gasAvg: avgGas(logGas) };
  const s3 = results.addDetailedLog.stats;
  console.log(`\n  Avg:${s3.avg.toFixed(0)}ms  P95:${s3.p95.toFixed(0)}ms  Gas:${results.addDetailedLog.gasAvg.toLocaleString()}`);

  // ── TEST 4: approveBatch ─────────────────────────────────────────────
  console.log('\n[TEST 4] approveBatch()  n=10');
  const appTimes=[], appGas=[];
  for (let i=0; i<10; i++) {
    const t0 = H.now();
    const r  = await H.approveBatch(tcInstance, owner, batchIds[i]);
    appTimes.push(H.now()-t0);
    appGas.push(r.gasUsed);
    process.stdout.write(`\r  ${i+1}/10`);
    await H.sleep(30);
  }
  results.approveBatch = { stats: H.calcStats(appTimes), gasAvg: avgGas(appGas) };
  const s4 = results.approveBatch.stats;
  console.log(`\n  Avg:${s4.avg.toFixed(0)}ms  P95:${s4.p95.toFixed(0)}ms  Gas:${results.approveBatch.gasAvg.toLocaleString()}`);

  // ── SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  WRITE PERFORMANCE SUMMARY');
  console.log('='.repeat(60));
  console.log('\n  Operation           | Avg ms | P95 ms |     Gas');
  console.log('  ' + '-'.repeat(50));
  for (const [op, d] of Object.entries(results)) {
    const s = d.stats;
    console.log(`  ${op.padEnd(20)}| ${s.avg.toFixed(0).padStart(6)} | ${s.p95.toFixed(0).padStart(6)} | ${d.gasAvg.toLocaleString().padStart(9)}`);
  }

  const rp = path.join(__dirname, '../../test-results/write-performance.json');
  fs.mkdirSync(path.dirname(rp), { recursive: true });
  fs.writeFileSync(rp, JSON.stringify({ timestamp: new Date().toISOString(), testType: 'write-performance', results }, null, 2));
  console.log(`\n  💾 ${rp}\n`);
  return results;
}

if (require.main === module) run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
module.exports = { run };
