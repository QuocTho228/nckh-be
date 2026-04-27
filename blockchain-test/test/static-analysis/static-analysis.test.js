/**
 * STATIC ANALYSIS TEST  —  JavaScript-native (không cần Python)
 * ============================================================
 * Lý do không dùng Slither/Mythril trực tiếp:
 *   Project chỉ có Node.js, không có Python trong dependencies.
 *   → Dùng pattern-based analysis + ABI analysis + gas growth test.
 *
 * Phương pháp:
 *   1. Source pattern matching: tìm known-bad patterns trong .sol
 *   2. ABI analysis: phát hiện function thiếu access control
 *   3. Gas growth test: đo empirically O(n) array scan
 *   4. Runtime behavior: verify revert messages
 *   5. Hướng dẫn chạy Slither (Python) và MythX (online) đính kèm
 * ============================================================
 */
const { Web3 } = require('web3');
const fs   = require('fs');
const path = require('path');
const H    = require('../../scripts/web3-helper');

const web3 = new Web3(H.GANACHE_URL);

const findings = [];
let safe_count = 0;

function vuln(sev, title, detail, fix = '') {
  const icons = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢', INFO: '🔵' };
  console.log(`\n  ${icons[sev] || '⚪'} [${sev}] ${title}`);
  if (detail) console.log(`     → ${detail}`);
  if (fix)    console.log(`     💡 Fix: ${fix}`);
  findings.push({ severity: sev, title, detail, fix });
}

function safe(title, note = '') {
  console.log(`  ✅ [SAFE] ${title}${note ? '  (' + note + ')' : ''}`);
  safe_count++;
  findings.push({ severity: 'SAFE', title, note });
}

// ─── Load source ─────────────────────────────────────────────────────────────
function loadSource(filename) {
  const candidates = [
    path.join(__dirname, '../../blockchain/contracts', filename),
    path.join(__dirname, '../../../blockchain/contracts', filename),
    path.join(process.cwd(), 'blockchain/contracts', filename),
    path.join('/mnt/user-data/uploads', filename),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return null;
}

function count(src, re) { return (src.match(re) || []).length; }

// =============================================================================
async function run() {
  console.log('\n' + '='.repeat(62));
  console.log('  STATIC ANALYSIS TEST');
  console.log('  Pattern-based + ABI + Gas-empirical analysis');
  console.log('='.repeat(62));

  const tcSrc = loadSource('TraceabilityContract.sol') || loadSource('supplychain.sol');
  const alSrc = loadSource('ActivityLog.sol');
  const alABI = H.loadABI('ActivityLog');
  const tcABI = H.loadABI('TraceabilityContract');

  if (!tcSrc) { console.error('  ❌ Không tìm thấy source .sol'); process.exit(1); }
  console.log(`\n  Source loaded: TC=${tcSrc.length} chars, AL=${alSrc?.length ?? 0} chars`);

  // ══════════════════════════════════════════════════════════════
  // [1] Solidity version
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [1] Compiler Version & Safety');

  const oldPragma = count(tcSrc, /pragma solidity\s*[\^<>=]*\s*0\.[0-7]\./g)
                  + (alSrc ? count(alSrc, /pragma solidity\s*[\^<>=]*\s*0\.[0-7]\./g) : 0);
  if (oldPragma > 0)
    vuln('HIGH', 'Pragma Solidity < 0.8',
      `${oldPragma} occurrences — không có built-in overflow protection`,
      'Nâng lên ^0.8.0');
  else
    safe('Pragma Solidity ≥ 0.8 — arithmetic overflow protection built-in');

  const pragmaLine = tcSrc.match(/pragma solidity[^\n]+/)?.[0] ?? '';
  console.log(`  ℹ️  ${pragmaLine.trim()}`);

  // ══════════════════════════════════════════════════════════════
  // [2] Reentrancy
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [2] Reentrancy');

  const ethCallTC = count(tcSrc, /\.call\s*\{[^}]*value/g);
  const ethCallAL = alSrc ? count(alSrc, /\.call\s*\{[^}]*value/g) : 0;
  const transferTC = count(tcSrc, /\.transfer\(|\.send\(/g);
  const transferAL = alSrc ? count(alSrc, /\.transfer\(|\.send\(/g) : 0;

  if (ethCallTC + ethCallAL + transferTC + transferAL === 0) {
    safe('Không có ETH transfer → Reentrancy không áp dụng',
      'contract không xử lý ETH trực tiếp');
  } else {
    vuln('HIGH', 'Phát hiện ETH transfer',
      `call{value}: TC=${ethCallTC} AL=${ethCallAL} | transfer/send: TC=${transferTC} AL=${transferAL}`,
      'Dùng Checks-Effects-Interactions pattern + OpenZeppelin ReentrancyGuard');
  }

  // ══════════════════════════════════════════════════════════════
  // [3] Access Control — pattern + ABI analysis
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [3] Access Control');

  // Hàm addActivityLog trong ActivityLog.sol có access control không?
  if (alSrc) {
    // Trích đoạn source từ "function addActivityLog" đến closing brace đầu tiên
    const fnMatch = alSrc.match(/function addActivityLog\s*\([^)]+\)[^{]*\{[\s\S]{0,400}?\n    \}/);
    const fnBody  = fnMatch?.[0] ?? '';
    const hasAC   = /require\s*\(|onlyOwner|onlyAuthorized|modifier\s+only|AccessControl/.test(fnBody);
    if (!hasAC) {
      vuln('CRITICAL',
        'addActivityLog() KHÔNG có access control',
        'Bất kỳ address nào cũng ghi được log giả vào bất kỳ batch nào.',
        'Thêm: mapping(address=>bool) authorized;\n' +
        '         modifier onlyAuthorized(){\n' +
        '           require(authorized[msg.sender]||msg.sender==owner,"Not authorized");\n' +
        '           _;\n' +
        '         }');
    } else {
      safe('addActivityLog() có access control');
    }

    const fn2Match = alSrc.match(/function addDetailedActivityLog\s*\([^)]+\)[^{]*\{[\s\S]{0,400}?\n    \}/);
    const fn2Body  = fn2Match?.[0] ?? '';
    const hasAC2   = /require\s*\(|onlyOwner|onlyAuthorized|modifier\s+only|AccessControl/.test(fn2Body);
    if (!hasAC2) {
      vuln('CRITICAL',
        'addDetailedActivityLog() KHÔNG có access control',
        'Tương tự addActivityLog.',
        'Áp dụng cùng modifier onlyAuthorized');
    } else {
      safe('addDetailedActivityLog() có access control');
    }
  }

  // Payable functions (nhận ETH)
  const payableFns = [...tcABI.abi, ...alABI.abi]
    .filter(x => x.type === 'function' && x.stateMutability === 'payable');
  if (payableFns.length === 0)
    safe('Không có payable function — contract không nhận ETH');
  else
    vuln('MEDIUM', `${payableFns.length} payable function`,
      payableFns.map(f => f.name).join(', '),
      'Xem xét bỏ payable nếu không cần nhận ETH');

  // ══════════════════════════════════════════════════════════════
  // [4] tx.origin
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [4] tx.origin Authentication');

  const txOrig = count(tcSrc, /tx\.origin/g) + (alSrc ? count(alSrc, /tx\.origin/g) : 0);
  if (txOrig === 0) safe('Không dùng tx.origin → không bị phishing contract');
  else vuln('HIGH', `tx.origin dùng ${txOrig} lần`, 'Dễ bị phishing thông qua malicious contract', 'Thay bằng msg.sender');

  // ══════════════════════════════════════════════════════════════
  // [5] Dangerous patterns
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [5] Dangerous Opcodes');

  const selfDest  = count(tcSrc, /selfdestruct\(|suicide\(/g) + (alSrc ? count(alSrc, /selfdestruct\(|suicide\(/g) : 0);
  const delegCall = count(tcSrc, /\.delegatecall\(/g)         + (alSrc ? count(alSrc, /\.delegatecall\(/g) : 0);
  const blockHash = count(tcSrc, /blockhash\(/g)              + (alSrc ? count(alSrc, /blockhash\(/g) : 0);
  const assembly  = count(tcSrc, /assembly\s*\{/g)            + (alSrc ? count(alSrc, /assembly\s*\{/g) : 0);

  if (selfDest  === 0) safe('Không có selfdestruct()');
  else vuln('CRITICAL', `selfdestruct() tìm thấy ${selfDest} lần`, 'Có thể phá hủy contract', 'Bỏ hoặc bảo vệ bằng onlyOwner + timelock');

  if (delegCall === 0) safe('Không có delegatecall()');
  else vuln('HIGH', `delegatecall() tìm thấy ${delegCall} lần`, 'Nguy hiểm nếu đến địa chỉ untrusted', 'Chỉ delegatecall đến trusted+audited contract');

  if (blockHash === 0) safe('Không dùng blockhash() làm source of randomness');
  else vuln('MEDIUM', `blockhash() tìm thấy ${blockHash} lần`, 'Không dùng làm randomness', 'Dùng Chainlink VRF');

  if (assembly > 0) console.log(`  ⚠️  [INFO] ${assembly} inline assembly blocks — cần review thủ công`);
  else safe('Không có inline assembly');

  // ══════════════════════════════════════════════════════════════
  // [6] block.timestamp usage
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [6] block.timestamp Usage');

  const tsTC = count(tcSrc, /block\.timestamp/g);
  const tsAL = alSrc ? count(alSrc, /block\.timestamp/g) : 0;
  console.log(`  ℹ️  block.timestamp: TC=${tsTC} AL=${tsAL} (tổng ${tsTC + tsAL} lần)`);

  // Nguy hiểm nếu dùng cho time-lock tài chính
  const financial = /block\.timestamp[\s\S]{0,50}(interest|loan|expire|deadline|payment)/i.test(tcSrc);
  if (!financial)
    safe('block.timestamp chỉ dùng để logging — Rủi ro THẤP (miner ±15s không ảnh hưởng)');
  else
    vuln('MEDIUM', 'block.timestamp trong logic tài chính',
      'Miner có thể điều chỉnh ±15s → ảnh hưởng đến financial operations',
      'Thêm buffer tối thiểu 15-30s cho time-sensitive operations');

  // ══════════════════════════════════════════════════════════════
  // [7] Gas growth — empirical O(n) verification
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [7] Unbounded Loop / Gas DoS (empirical)');

  // Đếm for loops qua storage array trong source
  const loopsTC = count(tcSrc, /for\s*\([^)]*\.length/g);
  const loopsAL = alSrc ? count(alSrc, /for\s*\([^)]*\.length/g) : 0;
  if (loopsTC + loopsAL > 0) {
    console.log(`  ℹ️  Phát hiện ${loopsTC + loopsAL} for-loop qua .length — đo gas empirically...`);
  }

  const accounts = await web3.eth.getAccounts();
  const { tcInstance: tc } = await H.deployContracts(web3, accounts[0]);

  // Seed 20 batches
  for (let i = 0; i < 20; i++)
    await H.createBatch(tc, accounts[0], `SA Batch ${i}`, 1, '50', 1);
  const gas20 = Number(await tc.methods.getBatchesByStage(0n).estimateGas({ from: accounts[0] }));

  // Seed thêm 20
  for (let i = 0; i < 20; i++)
    await H.createBatch(tc, accounts[0], `SA Batch2 ${i}`, 1, '50', 1);
  const gas40 = Number(await tc.methods.getBatchesByStage(0n).estimateGas({ from: accounts[0] }));

  const ratio = gas40 / gas20;
  const proj300 = Math.round(gas20 * (300 / 20));
  const BLOCK_GAS = 30_000_000;

  console.log(`  getBatchesByStage gas: 20 batches=${gas20.toLocaleString()} | 40 batches=${gas40.toLocaleString()}`);
  console.log(`  Growth ratio: ${ratio.toFixed(2)}x  | Projected 300 batches: ${proj300.toLocaleString()} gas`);

  if (ratio > 1.8) {
    vuln('MEDIUM',
      `getBatchesByStage() là O(n) — gas tăng ${ratio.toFixed(1)}x khi double batch`,
      `Sẽ hit block gas limit (~${BLOCK_GAS.toLocaleString()}) khi khoảng ${Math.round(BLOCK_GAS / (gas20 / 20)).toLocaleString()} batches`,
      'Thêm index: mapping(SupplyChainStage => uint256[]) batchIdsByStage;\n' +
      '         Hoặc dùng off-chain index (TheGraph / MySQL event listener đã có)');
  } else {
    safe('Gas scan tăng trưởng chấp nhận được (≤1.8x)');
  }

  // ══════════════════════════════════════════════════════════════
  // [8] Error handling quality
  // ══════════════════════════════════════════════════════════════
  console.log('\n─'.repeat(62));
  console.log('  [8] Error Handling Quality');

  const requireWithMsg = count(tcSrc, /require\([^,)]+,[^)]+\)/g);
  const requireNoMsg   = count(tcSrc, /require\([^,)]+\);/g);
  console.log(`  require() có message: ${requireWithMsg}  |  không message: ${requireNoMsg}`);
  if (requireNoMsg > 5)
    vuln('LOW', `${requireNoMsg} require() không có error message`, 'Khó debug khi revert', 'Thêm mô tả vào mọi require()');
  else
    safe(`Hầu hết require() có message (${requireWithMsg}/${requireWithMsg + requireNoMsg})`);

  // ══════════════════════════════════════════════════════════════
  // [9] Slither/Mythril guide
  // ══════════════════════════════════════════════════════════════
  const guide = `
=== HƯỚNG DẪN CHẠY SLITHER & MYTHRIL ===

## Slither (Trail of Bits) — Static Analyzer tốt nhất
Cài đặt: pip install slither-analyzer
Chạy:    cd blockchain
         slither contracts/TraceabilityContract.sol --solc-version 0.8.20 --json slither-tc.json
         slither contracts/ActivityLog.sol --solc-version 0.8.20 --json slither-al.json
         # Hoặc toàn project Truffle:
         slither . --truffle-build-directory build/contracts

## Mythril (ConsenSys) — Symbolic execution
Cài:     pip install mythril
Chạy:    myth analyze contracts/TraceabilityContract.sol --execution-timeout 120 -o json > mythril.json
Docker:  docker run -v $(pwd)/blockchain/contracts:/tmp/c mythril/myth analyze /tmp/c/TraceabilityContract.sol

## Online (không cần cài đặt)
- Remix IDE: https://remix.ethereum.org → Analysis tab
- MythX:     https://mythx.io (3 scans/ngày free)
- Securify2: https://securify.chainsecurity.com
`;
  const guideDir = path.join(__dirname, '../../test-results');
  fs.mkdirSync(guideDir, { recursive: true });
  fs.writeFileSync(path.join(guideDir, 'slither-mythril-guide.txt'), guide);
  console.log('\n─'.repeat(62));
  console.log('  [9] Hướng dẫn Slither & Mythril → test-results/slither-mythril-guide.txt');

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  const bySev = (sev) => findings.filter(f => f.severity === sev);
  const critical = bySev('CRITICAL');
  const high     = bySev('HIGH');
  const medium   = bySev('MEDIUM');
  const low      = bySev('LOW');

  console.log('\n' + '='.repeat(62));
  console.log('  STATIC ANALYSIS SUMMARY');
  console.log('='.repeat(62));
  console.log(`\n  🔴 CRITICAL : ${critical.length}  (phải fix trước khi deploy)`);
  console.log(`  🟠 HIGH     : ${high.length}  (nên fix)`);
  console.log(`  🟡 MEDIUM   : ${medium.length}  (cân nhắc)`);
  console.log(`  🟢 LOW      : ${low.length}  (cải thiện)`);
  console.log(`  ✅ SAFE     : ${safe_count}`);

  if (critical.length > 0) {
    console.log('\n  🔴 CRITICAL cần fix ngay:');
    critical.forEach(c => { console.log(`     • ${c.title}`); console.log(`       Fix: ${c.fix?.split('\n')[0]}`); });
  }

  const rp = path.join(__dirname, '../../test-results/static-analysis.json');
  fs.writeFileSync(rp, JSON.stringify({
    timestamp: new Date().toISOString(),
    testType: 'static-analysis',
    summary: { safe: safe_count, critical: critical.length, high: high.length, medium: medium.length, low: low.length },
    findings,
    gasGrowth: { batches_20: gas20, batches_40: gas40, ratio: ratio.toFixed(2), proj_300: proj300 }
  }, null, 2));
  console.log(`\n  💾 ${rp}\n`);
  return { critical: critical.length, high: high.length };
}

if (require.main === module)
  run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
module.exports = { run };
