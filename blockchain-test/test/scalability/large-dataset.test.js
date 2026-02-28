/**
 * LARGE DATASET SCALABILITY TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  SCALABILITY TEST: Large Dataset');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const owner    = accounts[0];
  const results  = {};

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  const BATCHES=40, LOGS_EACH=3, TREES=12;

  // ── PHASE 1: Seed ────────────────────────────────────────────────────
  console.log(`\n[PHASE 1] Seeding ${TREES} trees + ${BATCHES} batches × ${LOGS_EACH} logs`);
  const seedStart=H.now();
  const batchIds=[];

  for (let i=1;i<=TREES;i++) {
    await H.registerTree(alInstance, accounts[i%accounts.length], `TREE-SCALE-${i}`, (i%5)+1, (i%3)+1);
    process.stdout.write(`\r  Trees: ${i}/${TREES}`);
  }
  console.log('');

  for (let i=1;i<=BATCHES;i++) {
    const acc = accounts[i%accounts.length];
    const rb  = await H.createBatch(tcInstance, acc, `Scale Batch ${i}`, (i%5)+1, `${i*50}`, (i%3)+1);
    const bid = H.getBatchId(rb) || i;
    batchIds.push(bid);
    await H.approveBatch(tcInstance, owner, bid);
    for (let j=0;j<LOGS_EACH;j++)
      await H.addDetailedLog(alInstance, acc, bid, j%5, `Hoạt động ${j+1}`, `Mô tả ${j+1}`);
    process.stdout.write(`\r  Batches: ${i}/${BATCHES}`);
  }
  const seedMs=H.now()-seedStart;
  results.seedTime = { totalMs:seedMs, batches:BATCHES, treesCount:TREES };
  console.log(`\n  ✅ Seeded in ${(seedMs/1000).toFixed(1)}s\n`);

  const measure = async (fn) => { const t0=H.now(); await fn(); return H.now()-t0; };
  const avg5 = async (fn) => {
    const ts=[]; for (let i=0;i<5;i++) ts.push(await measure(fn));
    return H.calcStats(ts).avg;
  };

  // ── PHASE 2: Read Scalability ─────────────────────────────────────────
  console.log('[PHASE 2] Read Scalability');

  const avgStage0 = await avg5(()=>tcInstance.methods.getBatchesByStage(1n).call());
  results.getBatchesByStage = { avgMs:avgStage0, n:BATCHES };
  console.log(`  getBatchesByStage (${BATCHES}): ${avgStage0.toFixed(0)}ms`);

  const avgLog = await avg5(()=>alInstance.methods.getActivityLogs(H.toBI(batchIds[0])).call());
  results.getActivityLogs = { avgMs:avgLog };
  console.log(`  getActivityLogs (${LOGS_EACH} logs): ${avgLog.toFixed(0)}ms`);

  const avgPend = await avg5(()=>tcInstance.methods.getAllPendingBatches().call());
  results.getAllPending = { avgMs:avgPend };
  console.log(`  getAllPendingBatches: ${avgPend.toFixed(0)}ms`);

  // getBatchesByProducer
  const avgProd = await avg5(()=>tcInstance.methods.getBatchesByProducer(1n).call());
  results.getBatchesByProducer = { avgMs:avgProd };
  console.log(`  getBatchesByProducer: ${avgProd.toFixed(0)}ms`);

  // ── PHASE 3: Thêm 20 batches và so sánh ──────────────────────────────
  console.log('\n[PHASE 3] Thêm 20 batches và so sánh');
  for (let i=BATCHES+1;i<=BATCHES+20;i++) {
    await H.createBatch(tcInstance, owner, `Scale2 ${i}`, 1, `${i*30}`, 1);
    process.stdout.write(`\r  Adding ${i-BATCHES}/20`);
  }
  console.log('');

  const avgStage2 = await avg5(()=>tcInstance.methods.getBatchesByStage(0n).call());
  results.getBatchesByStage_60 = { avgMs:avgStage2, n:BATCHES+20 };
  console.log(`  getBatchesByStage (${BATCHES+20}): ${avgStage2.toFixed(0)}ms`);

  const growth = avgStage0>0 ? avgStage2/avgStage0 : 1;
  const proj1k = avgStage0 * (1000/BATCHES);
  console.log(`  Growth factor: ${growth.toFixed(2)}x  →  ~${proj1k.toFixed(0)}ms/1000 batches`);
  if (proj1k>10000) console.log('  ⚠️  Cần off-chain index (TheGraph) khi scale 1000+!');

  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('  SCALABILITY SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Seed ${BATCHES} batches:           ${(seedMs/1000).toFixed(1)}s`);
  console.log(`  getBatchesByStage (${BATCHES}):   ${avgStage0.toFixed(0)}ms`);
  console.log(`  getBatchesByStage (${BATCHES+20}):   ${avgStage2.toFixed(0)}ms`);
  console.log(`  getActivityLogs:                ${avgLog.toFixed(0)}ms`);
  console.log(`  Projected 1000 batches:         ~${proj1k.toFixed(0)}ms`);

  const rp = path.join(__dirname,'../../test-results/large-dataset.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'large-dataset',config:{BATCHES,LOGS_EACH,TREES},results,projections:{per1000ms:proj1k.toFixed(0),needsIndex:proj1k>10000}},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return results;
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
