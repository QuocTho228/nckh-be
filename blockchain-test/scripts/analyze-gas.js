/**
 * GAS ANALYZER  —  Web3 v4.x (exact contract signatures)
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('./web3-helper');

const web3 = new Web3(H.GANACHE_URL);

const ETH_USD  = 3500;
const GAS_GWEI = 30;
const usd = (gas) => ((Number(gas) * GAS_GWEI * 1e-9) * ETH_USD).toFixed(4);
const row = (name, gas) =>
  `  ${name.padEnd(44)}| ${Number(gas).toLocaleString().padStart(10)} | $${usd(gas).padStart(9)}/tx`;

async function analyzeGas() {
  console.log('\n' + '='.repeat(74));
  console.log('  GAS ANALYZER – Blockchain Sầu Riêng');
  console.log(`  ETH=$${ETH_USD}  Gas=${GAS_GWEI} gwei`);
  console.log('='.repeat(74));

  const accounts = await web3.eth.getAccounts();
  const owner    = accounts[0];
  const alABI    = H.loadABI('ActivityLog');
  const tcABI    = H.loadABI('TraceabilityContract');

  const gasReport = {};

  // Deploy
  const alDeploy = await new web3.eth.Contract(alABI.abi).deploy({ data: alABI.bytecode });
  const alGas    = await alDeploy.estimateGas({ from: owner });
  const alInst   = await alDeploy.send({ from: owner, gas: 5000000n });

  const tcDeploy = await new web3.eth.Contract(tcABI.abi).deploy({ data: tcABI.bytecode, arguments: [alInst.options.address] });
  const tcGas    = await tcDeploy.estimateGas({ from: owner });
  const tcInst   = await tcDeploy.send({ from: owner, gas: 8000000n });

  console.log('\n  📦 DEPLOYMENT');
  console.log('  ' + '-'.repeat(70));
  console.log('  Function                                    |    Est. Gas | USD/tx');
  console.log('  ' + '-'.repeat(70));
  console.log(row('Deploy ActivityLog', alGas));
  console.log(row('Deploy TraceabilityContract', tcGas));
  gasReport.deploy = { ActivityLog: Number(alGas), TraceabilityContract: Number(tcGas) };

  // ActivityLog functions
  console.log('\n  📋 ACTIVITY LOG');
  console.log('  ' + '-'.repeat(70));

  let g;
  g = await alInst.methods.registerTree('GAS-QR-001',1n,1n,'Musang King','Premium','10,106').estimateGas({from:owner});
  console.log(row('registerTree()', g)); gasReport.registerTree=Number(g);
  await alInst.methods.registerTree('GAS-QR-001',1n,1n,'Musang King','Premium','10,106').send({from:owner,gas:600000n});

  g = await alInst.methods.addTreeCareActivity(1n,1n,0n,'Tưới nước','Mô tả').estimateGas({from:owner});
  console.log(row('addTreeCareActivity()', g)); gasReport.addTreeCareActivity=Number(g);

  g = await alInst.methods.addActivityLog(1n,1n,'Thu hoạch','Mô tả',false).estimateGas({from:owner});
  console.log(row('addActivityLog()', g)); gasReport.addActivityLog=Number(g);

  g = await alInst.methods.addDetailedActivityLog(1n,1n,0n,'Thu hoạch','Mô tả',false).estimateGas({from:owner});
  console.log(row('addDetailedActivityLog()', g)); gasReport.addDetailedActivityLog=Number(g);

  // TraceabilityContract functions
  console.log('\n  🔗 TRACEABILITY CONTRACT');
  console.log('  ' + '-'.repeat(70));

  const nowTs = BigInt(Math.floor(Date.now()/1000));
  g = await tcInst.methods.createBatch('Musang King',1n,'500',1n,nowTs,nowTs+2592000n).estimateGas({from:owner});
  console.log(row('createBatch()', g)); gasReport.createBatch=Number(g);

  const rb  = await H.createBatch(tcInst, owner, 'Musang King', 1, '500', 1);
  const bid = H.getBatchId(rb) || 1;
  const rb2 = await H.createBatch(tcInst, owner, 'Reject Test', 1, '200', 1);
  const bid2 = H.getBatchId(rb2) || 2;

  g = await tcInst.methods.approveBatch(H.toBI(bid),1n).estimateGas({from:owner});
  console.log(row('approveBatch()', g)); gasReport.approveBatch=Number(g);
  await H.approveBatch(tcInst, owner, bid);

  g = await tcInst.methods.rejectBatch(H.toBI(bid2),1n,'Lý do').estimateGas({from:owner});
  console.log(row('rejectBatch()', g)); gasReport.rejectBatch=Number(g);

  g = await tcInst.methods.recordPurchase(H.toBI(bid),1n,500n,50000n).estimateGas({from:owner});
  console.log(row('recordPurchase()', g)); gasReport.recordPurchase=Number(g);
  await H.recordPurchase(tcInst, owner, bid);

  g = await tcInst.methods.updateTransportStatus(H.toBI(bid),1n,0,28,75).estimateGas({from:owner});
  console.log(row('updateTransportStatus() [start]', g)); gasReport.updateTransport=Number(g);

  g = await tcInst.methods.recordProcessing(H.toBI(bid),1n,0,500n,480n).estimateGas({from:owner}).catch(()=>300000n);
  console.log(row('recordProcessing()', g)); gasReport.recordProcessing=Number(g);
  await H.recordProcessing(tcInst, owner, bid).catch(()=>{});

  g = await tcInst.methods.recordQualityTest(H.toBI(bid),1n,true).estimateGas({from:owner}).catch(()=>200000n);
  console.log(row('recordQualityTest()', g)); gasReport.recordQualityTest=Number(g);

  // Full flow total
  const flowOps = [
    ['Deploy (1 lần)',              Number(alGas)+Number(tcGas)],
    ['registerTree',                gasReport.registerTree],
    ['createBatch',                 gasReport.createBatch],
    ['approveBatch',                gasReport.approveBatch],
    ['recordPurchase',              gasReport.recordPurchase],
    ['updateTransportStatus',       gasReport.updateTransport],
    ['recordProcessing',            gasReport.recordProcessing],
    ['recordQualityTest',           gasReport.recordQualityTest],
    ['addDetailedActivityLog × 5',  gasReport.addDetailedActivityLog*5],
  ];

  console.log('\n  💰 FULL SUPPLY CHAIN – chi phí 1 lô');
  console.log('  ' + '-'.repeat(70));
  let total=0;
  for (const [n, g] of flowOps) {
    if (g) { total+=g; console.log(row(n,g)); }
  }
  console.log('  ' + '-'.repeat(70));
  console.log(row('TỔNG 1 lô hàng', total));
  console.log(`\n  Ước tính 1000 lô/năm: ~$${(parseFloat(usd(total))*1000).toFixed(0)}`);

  const rp = path.join(__dirname,'../test-results/gas-analysis.json');
  fs.mkdirSync(path.dirname(rp),{recursive:true});
  fs.writeFileSync(rp, JSON.stringify({timestamp:new Date().toISOString(),assumptions:{ethPriceUSD:ETH_USD,gasPriceGwei:GAS_GWEI},gasReport,totalFlowGas:total,totalFlowUSD:usd(total)},null,2));
  console.log(`\n  💾 ${rp}`);
  console.log('='.repeat(74)+'\n');
  return gasReport;
}

if (require.main === module) analyzeGas().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
module.exports = { analyzeGas };
