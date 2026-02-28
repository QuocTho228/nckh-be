/**
 * MASTER TEST RUNNER  —  Web3 v4.x
 */
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http = require('http');

const TEST_SUITES = [
  { name:'Write Performance',      file:'test/performance/write-performance.test.js', category:'performance'  },
  { name:'Read Performance',       file:'test/performance/read-performance.test.js',  category:'performance'  },
  { name:'Load Test',              file:'test/performance/load-test.test.js',         category:'performance'  },
  { name:'Access Control',         file:'test/security/access-control.test.js',       category:'security'     },
  { name:'Data Integrity',         file:'test/security/data-integrity.test.js',       category:'security'     },
  { name:'Overflow/Underflow',     file:'test/security/overflow-underflow.test.js',   category:'security'     },
  { name:'Timestamp Manipulation', file:'test/security/timestamp-manipulation.test.js',category:'security'    },
  { name:'Data Manipulation',      file:'test/attacks/data-manipulation.test.js',     category:'attacks'      },
  { name:'DoS Attack',             file:'test/attacks/dos-attack.test.js',            category:'attacks'      },
  { name:'Front-running',          file:'test/attacks/frontrunning.test.js',          category:'attacks'      },
  { name:'Large Dataset',          file:'test/scalability/large-dataset.test.js',     category:'scalability'  },
];

const C = { reset:'\x1b[0m', green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m', cyan:'\x1b[36m', bold:'\x1b[1m' };
const c = (col, txt) => `${C[col]}${txt}${C.reset}`;

function checkGanache() {
  return new Promise(resolve => {
    const body = JSON.stringify({ jsonrpc:'2.0', method:'eth_blockNumber', params:[], id:1 });
    const req  = http.request(
      { hostname:'127.0.0.1', port:8545, path:'/', method:'POST',
        headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} },
      res => { res.resume(); res.on('end', () => resolve(true)); }
    );
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.write(body); req.end();
  });
}

function checkABIs() {
  const roots = [
    path.join(__dirname,'../blockchain/build/contracts'),
    path.join(__dirname,'../../blockchain/build/contracts'),
    path.join(process.cwd(),'blockchain/build/contracts'),
  ];
  for (const root of roots)
    if (fs.existsSync(path.join(root,'ActivityLog.json')) &&
        fs.existsSync(path.join(root,'TraceabilityContract.json'))) return { ok:true, root };
  return { ok:false, roots };
}

function runSuite(suite, idx, total) {
  return new Promise(resolve => {
    console.log(`\n[${String(idx+1).padStart(2,'0')}/${total}] ${c('cyan','▶')} ${c('bold',suite.name)}`);
    console.log('     ' + '─'.repeat(55));
    const t0 = Date.now();
    exec(`node "${path.join(__dirname,'..',suite.file)}"`, { timeout:360000 }, (err, stdout) => {
      const dur = ((Date.now()-t0)/1000).toFixed(1);
      if (stdout) process.stdout.write(stdout);
      if (err) {
        console.log(`     ${c('red','✗ FAILED')} (${dur}s)`);
        resolve({ suite:suite.name, category:suite.category, status:'FAILED', duration:dur, error:err.message.slice(0,200) });
      } else {
        console.log(`     ${c('green','✓ COMPLETED')} (${dur}s)`);
        resolve({ suite:suite.name, category:suite.category, status:'PASSED', duration:dur });
      }
    });
  });
}

function generateHTML(data, outPath) {
  const rows = data.suiteResults.map(r =>
    `<tr><td>${r.category}</td><td>${r.suite}</td>
     <td class="${r.status==='PASSED'?'pass':'fail'}">${r.status==='PASSED'?'✅ PASSED':'❌ FAILED'}</td>
     <td>${r.duration}s</td><td style="font-size:.8em;color:#f44336">${r.error||'—'}</td></tr>`
  ).join('');
  fs.writeFileSync(outPath, `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<title>Blockchain Test Report</title>
<style>body{font-family:'Segoe UI',sans-serif;background:#0f1117;color:#e0e0e0;padding:24px}
h1{color:#4CAF50;text-align:center}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}
.card{background:#1e2130;border-radius:12px;padding:20px;text-align:center}
.val{font-size:2.4rem;font-weight:bold}.lbl{color:#888;font-size:.82rem}
.g{color:#4CAF50}.r{color:#f44336}.y{color:#FFC107}.b{color:#2196F3}
table{width:100%;border-collapse:collapse;background:#1e2130;border-radius:12px;overflow:hidden;margin:16px 0}
th{background:#2d3250;padding:11px 14px;text-align:left;color:#aaa}
td{padding:11px 14px;border-top:1px solid #2d3250}.pass{color:#4CAF50}.fail{color:#f44336}</style></head>
<body><h1>🍈 Blockchain Test Report – Sầu Riêng</h1>
<p style="text-align:center;color:#888">${data.timestamp}</p>
<div class="cards">
<div class="card"><div class="val b">${data.summary.total}</div><div class="lbl">Total</div></div>
<div class="card"><div class="val g">${data.summary.passed}</div><div class="lbl">Passed</div></div>
<div class="card"><div class="val r">${data.summary.failed}</div><div class="lbl">Failed</div></div>
<div class="card"><div class="val y">${data.summary.totalDurationSec}s</div><div class="lbl">Time</div></div>
</div><table><tr><th>Category</th><th>Suite</th><th>Status</th><th>Duration</th><th>Error</th></tr>${rows}</table>
</body></html>`);
}

async function runAll() {
  console.log('\n' + c('bold','='.repeat(65)));
  console.log(c('bold','  🍈 BLOCKCHAIN TRUY XUẤT SẦU RIÊNG – MASTER TEST RUNNER'));
  console.log(c('bold','='.repeat(65)) + '\n');

  if (!await checkGanache()) {
    console.error(c('red','  ❌ Ganache chưa chạy! Mở terminal mới và chạy:'));
    console.error(c('yellow','  ganache --gasLimit 1000000000 --defaultBalanceEther 1000 --deterministic\n'));
    process.exit(1);
  }
  console.log(c('green','  ✅ Ganache đang chạy'));

  const abiCheck = checkABIs();
  if (!abiCheck.ok) {
    console.error(c('red','  ❌ ABIs chưa compile!\n  cd blockchain && truffle compile'));
    process.exit(1);
  }
  console.log(c('green',`  ✅ ABIs: ${abiCheck.root}\n`));

  const args   = process.argv.slice(2);
  const cat    = args.find(a => a.startsWith('--only='))?.replace('--only=','');
  const toRun  = cat ? TEST_SUITES.filter(s => s.category===cat) : TEST_SUITES;
  if (cat) console.log(c('yellow',`  Chỉ chạy: ${cat} (${toRun.length} suites)\n`));

  const t0 = Date.now();
  const suiteResults = [];
  for (let i=0; i<toRun.length; i++) suiteResults.push(await runSuite(toRun[i], i, toRun.length));

  const totalSec = ((Date.now()-t0)/1000).toFixed(1);
  const passed   = suiteResults.filter(r=>r.status==='PASSED').length;
  const failed   = suiteResults.filter(r=>r.status==='FAILED').length;

  console.log('\n' + c('bold','='.repeat(65)));
  console.log(c('bold','  📊 FINAL REPORT'));
  console.log(c('bold','='.repeat(65)));
  console.log(`\n  ${c('green','✅ Passed:')} ${passed}/${toRun.length}   ${c('red','❌ Failed:')} ${failed}/${toRun.length}   ⏱️  ${totalSec}s\n`);
  console.log('  ' + '─'.repeat(62));
  for (const r of suiteResults) {
    const icon = r.status==='PASSED' ? c('green','✅') : c('red','❌');
    console.log(`  ${icon} ${(r.category+' / '+r.suite).padEnd(48)} ${r.duration}s`);
  }
  console.log('  ' + '─'.repeat(62));

  const dir = path.join(__dirname,'../test-results');
  fs.mkdirSync(dir, { recursive:true });
  const detail = {};
  fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='final-report.json').forEach(f=>{
    try { detail[f.replace('.json','')] = JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); } catch {}
  });
  const report = { timestamp:new Date().toISOString(), summary:{total:toRun.length,passed,failed,totalDurationSec:totalSec}, suiteResults, detailedResults:detail };
  const jPath  = path.join(dir,'final-report.json');
  const hPath  = path.join(dir,'report.html');
  fs.writeFileSync(jPath, JSON.stringify(report,null,2));
  generateHTML(report, hPath);
  console.log(`\n  💾 JSON: ${jPath}\n  📄 HTML: ${hPath}`);
  console.log(failed===0 ? c('green','\n  🎉 Tất cả PASSED!\n') : c('red',`\n  ⚠️  ${failed} suite(s) FAILED\n`));
  console.log('='.repeat(65)+'\n');
  process.exit(failed>0 ? 1 : 0);
}

runAll().catch(err => { console.error('\n  Fatal:', err.message); process.exit(1); });
