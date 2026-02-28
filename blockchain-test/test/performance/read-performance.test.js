/**
 * READ PERFORMANCE TEST  —  Web3 v4.x
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  READ PERFORMANCE TEST');
  console.log('='.repeat(60));

  const accounts = await web3.eth.getAccounts();
  const owner    = accounts[0];
  const results  = {};

  const { alInstance, tcInstance } = await H.deployContracts(web3, owner);

  // Seed
  console.log('\n[SETUP] Seeding 10 batches...');
  const batchIds=[], ssccs=[];
  for (let i=1; i<=10; i++) {
    const r   = await H.createBatch(tcInstance, owner, `Lô Musang King ${i}`, 1, `${i*100}`, 1);
    const bid = H.getBatchId(r) || i;
    batchIds.push(bid);
    const batch = await tcInstance.methods.getBatchDetails(H.toBI(bid)).call();
    ssccs.push(batch.sscc);
    await H.approveBatch(tcInstance, owner, bid);
    for (let j=0; j<5; j++)
      await H.addActivityLog(alInstance, owner, bid, `Hoạt động ${j+1}`, `Mô tả ${j+1}`);
    await H.registerTree(alInstance, owner, `TREE-READ-${i}`, 1, 1);
    process.stdout.write(`\r  ${i}/10`);
  }
  console.log('\n  ✅ Done\n');

  const N = 30;
  const measure = async (fn) => { const t0=H.now(); await fn(); return H.now()-t0; };

  // T1
  const t1=[]; for (let i=0;i<N;i++) t1.push(await measure(()=>tcInstance.methods.getBatchDetails(H.toBI(batchIds[i%10])).call()));
  results.getBatchDetails = H.calcStats(t1);
  console.log(`  getBatchDetails    Avg:${results.getBatchDetails.avg.toFixed(1)}ms  P95:${results.getBatchDetails.p95.toFixed(1)}ms`);

  // T2
  const t2=[]; for (let i=0;i<N;i++) t2.push(await measure(()=>tcInstance.methods.getBatchBySSCC(ssccs[i%10]).call()));
  results.getBatchBySSCC = H.calcStats(t2);
  console.log(`  getBatchBySSCC     Avg:${results.getBatchBySSCC.avg.toFixed(1)}ms  P95:${results.getBatchBySSCC.p95.toFixed(1)}ms`);

  // T3
  const t3=[]; for (let i=0;i<N;i++) t3.push(await measure(()=>alInstance.methods.getActivityLogs(H.toBI(batchIds[i%10])).call()));
  results.getActivityLogs = H.calcStats(t3);
  console.log(`  getActivityLogs    Avg:${results.getActivityLogs.avg.toFixed(1)}ms  P95:${results.getActivityLogs.p95.toFixed(1)}ms`);

  // T4
  const t4=[]; for (let i=0;i<N;i++) t4.push(await measure(()=>alInstance.methods.getTreeByQRCode(`TREE-READ-${(i%10)+1}`).call()));
  results.getTreeByQRCode = H.calcStats(t4);
  console.log(`  getTreeByQRCode    Avg:${results.getTreeByQRCode.avg.toFixed(1)}ms  P95:${results.getTreeByQRCode.p95.toFixed(1)}ms`);

  // T5
  const t5=[]; for (let i=0;i<N;i++) t5.push(await measure(()=>alInstance.methods.getSystemActivityLogs(H.toBI(batchIds[i%10])).call()));
  results.getSystemLogs = H.calcStats(t5);
  console.log(`  getSystemLogs      Avg:${results.getSystemLogs.avg.toFixed(1)}ms  P95:${results.getSystemLogs.p95.toFixed(1)}ms`);

  // T6: Concurrent
  const cStart=H.now();
  await Promise.all(batchIds.map(id=>Promise.all([
    tcInstance.methods.getBatchDetails(H.toBI(id)).call(),
    alInstance.methods.getActivityLogs(H.toBI(id)).call(),
    tcInstance.methods.getCurrentStage(H.toBI(id)).call(),
  ])));
  const cMs = H.now()-cStart;
  results.concurrent30 = { totalMs: cMs, avgPerCall: cMs/30 };
  console.log(`  Concurrent 30      Total:${cMs.toFixed(0)}ms  Avg/call:${(cMs/30).toFixed(1)}ms`);

  const rp = path.join(__dirname,'../../test-results/read-performance.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),testType:'read-performance',results},null,2));
  console.log(`\n  💾 ${rp}\n`);
  return results;
}

if (require.main === module) run().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { run };
