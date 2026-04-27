/**
 * MASTER TEST RUNNER  —  Web3 v4.x
 * 14 suites: 11 gốc + 3 bổ sung (events, static-analysis, e2e)
 */
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

// ── 11 suite gốc ─────────────────────────────────────────────────────────────
const ORIGINAL_SUITES = [
  {
    name: "Write Performance",
    file: "test/performance/write-performance.test.js",
    category: "performance",
  },
  {
    name: "Read Performance",
    file: "test/performance/read-performance.test.js",
    category: "performance",
  },
  {
    name: "Load Test",
    file: "test/performance/load-test.test.js",
    category: "performance",
  },
  {
    name: "Access Control",
    file: "test/security/access-control.test.js",
    category: "security",
  },
  {
    name: "Data Integrity",
    file: "test/security/data-integrity.test.js",
    category: "security",
  },
  {
    name: "Overflow/Underflow",
    file: "test/security/overflow-underflow.test.js",
    category: "security",
  },
  {
    name: "Timestamp Manipulation",
    file: "test/security/timestamp-manipulation.test.js",
    category: "security",
  },
  {
    name: "Data Manipulation",
    file: "test/attacks/data-manipulation.test.js",
    category: "attacks",
  },
  {
    name: "DoS Attack",
    file: "test/attacks/dos-attack.test.js",
    category: "attacks",
  },
  {
    name: "Front-running",
    file: "test/attacks/frontrunning.test.js",
    category: "attacks",
  },
  {
    name: "Large Dataset",
    file: "test/scalability/large-dataset.test.js",
    category: "scalability",
  },
];

// ── 3 suite bổ sung ───────────────────────────────────────────────────────────
const EXTENDED_SUITES = [
  {
    name: "Event Emission",
    file: "test/events/event-emission.test.js",
    category: "events",
  },
  {
    name: "Static Analysis",
    file: "test/static-analysis/static-analysis.test.js",
    category: "static-analysis",
  },
  {
    name: "E2E Full Lifecycle",
    file: "test/e2e/full-lifecycle.test.js",
    category: "e2e",
  },
];

const ALL_SUITES = [...ORIGINAL_SUITES, ...EXTENDED_SUITES];

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};
const c = (col, txt) => `${C[col]}${txt}${C.reset}`;

function checkGanache() {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8545,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(true));
      },
    );
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

function checkABIs() {
  const roots = [
    path.join(__dirname, "../blockchain/build/contracts"),
    path.join(__dirname, "../../blockchain/build/contracts"),
    path.join(process.cwd(), "blockchain/build/contracts"),
  ];
  for (const root of roots)
    if (
      fs.existsSync(path.join(root, "ActivityLog.json")) &&
      fs.existsSync(path.join(root, "TraceabilityContract.json"))
    )
      return { ok: true, root };
  return { ok: false };
}

function runSuite(suite, idx, total) {
  return new Promise((resolve) => {
    const label = `[${String(idx + 1).padStart(2, "0")}/${total}]`;
    const tag =
      suite.category === "events"
        ? "🔔"
        : suite.category === "static-analysis"
          ? "🔍"
          : suite.category === "e2e"
            ? "🔄"
            : "▶";
    console.log(`\n${label} ${c("cyan", tag)} ${c("bold", suite.name)}`);
    console.log("     " + "─".repeat(53));
    const t0 = Date.now();
    exec(
      `node "${path.join(__dirname, "..", suite.file)}"`,
      { timeout: 480000 },
      (err, stdout) => {
        const dur = ((Date.now() - t0) / 1000).toFixed(1);
        if (stdout) process.stdout.write(stdout);
        if (err) {
          console.log(`     ${c("red", "✗ FAILED")} (${dur}s)`);
          resolve({
            ...suite,
            status: "FAILED",
            duration: dur,
            error: err.message.slice(0, 200),
          });
        } else {
          console.log(`     ${c("green", "✓ COMPLETED")} (${dur}s)`);
          resolve({ ...suite, status: "PASSED", duration: dur });
        }
      },
    );
  });
}

function generateHTML(report, htmlPath) {
  const categoryColors = {
    performance: "#2196F3",
    security: "#f44336",
    attacks: "#FF9800",
    scalability: "#9C27B0",
    events: "#00BCD4",
    "static-analysis": "#607D8B",
    e2e: "#4CAF50",
  };
  const rows = report.suiteResults
    .map((r) => {
      const cc = categoryColors[r.category] || "#888";
      return `<tr>
      <td><span style="background:${cc};color:#fff;padding:2px 8px;border-radius:4px;font-size:.78em">${r.category}</span></td>
      <td>${r.name}</td>
      <td class="${r.status === "PASSED" ? "pass" : "fail"}">${r.status === "PASSED" ? "✅ PASSED" : "❌ FAILED"}</td>
      <td>${r.duration}s</td>
      <td style="font-size:.8em;color:#f44336;max-width:300px">${r.error || "—"}</td>
    </tr>`;
    })
    .join("");

  const { total, passed, failed, totalDurationSec } = report.summary;
  const pct = Math.round((passed / total) * 100);

  fs.writeFileSync(
    htmlPath,
    `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<title>Blockchain Test Report</title>
<style>
  body{font-family:'Segoe UI',sans-serif;background:#0f1117;color:#e0e0e0;padding:24px;margin:0}
  h1{color:#4CAF50;text-align:center;margin-bottom:4px}
  .sub{text-align:center;color:#666;margin-bottom:24px}
  .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:20px 0}
  .card{background:#1e2130;border-radius:10px;padding:16px;text-align:center}
  .val{font-size:2rem;font-weight:bold}.lbl{color:#888;font-size:.8rem;margin-top:4px}
  .g{color:#4CAF50}.r{color:#f44336}.y{color:#FFC107}.b{color:#2196F3}.c{color:#00BCD4}
  table{width:100%;border-collapse:collapse;background:#1e2130;border-radius:10px;overflow:hidden;margin:16px 0}
  th{background:#2d3250;padding:10px 14px;text-align:left;color:#aaa;font-size:.85rem}
  td{padding:10px 14px;border-top:1px solid #2d3250;font-size:.9rem}
  .pass{color:#4CAF50;font-weight:600}.fail{color:#f44336;font-weight:600}
  .badge{display:inline-block;background:#4CAF50;color:#fff;border-radius:50%;width:60px;height:60px;
    line-height:60px;text-align:center;font-size:1.2rem;font-weight:bold;margin:0 auto}
  .section-header{background:#1a1f35;padding:8px 14px;color:#aaa;font-size:.8rem;text-transform:uppercase;letter-spacing:1px}
</style></head><body>
<h1>🍈 Blockchain Truy Xuất Sầu Riêng</h1>
<p class="sub">Test Report — ${report.timestamp}</p>
<div class="cards">
  <div class="card"><div class="val b">${total}</div><div class="lbl">Tổng Suites</div></div>
  <div class="card"><div class="val g">${passed}</div><div class="lbl">Passed</div></div>
  <div class="card"><div class="val r">${failed}</div><div class="lbl">Failed</div></div>
  <div class="card"><div class="val y">${totalDurationSec}s</div><div class="lbl">Tổng Thời Gian</div></div>
  <div class="card"><div class="badge ${pct === 100 ? "" : "r"}" style="${pct < 100 ? "background:#f44336" : ""}">${pct}%</div><div class="lbl">Pass Rate</div></div>
</div>
<table>
  <tr><th>Category</th><th>Suite</th><th>Status</th><th>Duration</th><th>Error</th></tr>
  ${rows}
</table>
<p style="text-align:center;color:#444;font-size:.8rem;margin-top:20px">
  Generated by blockchain-test master runner — Web3 v4.x
</p></body></html>`,
  );
}

async function main() {
  console.log("\n" + c("bold", "=".repeat(67)));
  console.log(
    c("bold", "  🍈 BLOCKCHAIN TRUY XUẤT SẦU RIÊNG – MASTER TEST RUNNER"),
  );
  console.log(
    c("bold", "     14 suites: 11 gốc + 3 bổ sung (events, static, e2e)"),
  );
  console.log(c("bold", "=".repeat(67)) + "\n");

  if (!(await checkGanache())) {
    console.error(
      c(
        "red",
        "  ❌ Ganache chưa chạy!\n  ganache --gasLimit 1000000000 --defaultBalanceEther 1000 --deterministic",
      ),
    );
    process.exit(1);
  }
  console.log(c("green", "  ✅ Ganache đang chạy"));

  const abiCheck = checkABIs();
  if (!abiCheck.ok) {
    console.error(
      c("red", "  ❌ ABIs chưa compile!\n  cd blockchain && truffle compile"),
    );
    process.exit(1);
  }
  console.log(c("green", `  ✅ ABIs: ${abiCheck.root}\n`));

  // CLI options: --only=<category> --extended-only --original-only
  const args = process.argv.slice(2);
  const onlyCat = args
    .find((a) => a.startsWith("--only="))
    ?.replace("--only=", "");
  const extOnly = args.includes("--extended-only");
  const origOnly = args.includes("--original-only");

  let toRun = ALL_SUITES;
  if (onlyCat) toRun = ALL_SUITES.filter((s) => s.category === onlyCat);
  if (extOnly) toRun = EXTENDED_SUITES;
  if (origOnly) toRun = ORIGINAL_SUITES;

  if (onlyCat || extOnly || origOnly) {
    const label = onlyCat || (extOnly ? "extended only" : "original only");
    console.log(c("yellow", `  Chỉ chạy: ${label} (${toRun.length} suites)\n`));
  }

  const t0 = Date.now();
  const suiteResults = [];
  for (let i = 0; i < toRun.length; i++)
    suiteResults.push(await runSuite(toRun[i], i, toRun.length));

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  const passed = suiteResults.filter((r) => r.status === "PASSED").length;
  const failed = suiteResults.filter((r) => r.status === "FAILED").length;

  console.log("\n" + c("bold", "=".repeat(67)));
  console.log(c("bold", "  📊 FINAL REPORT"));
  console.log(c("bold", "=".repeat(67)));
  console.log(
    `\n  ${c("green", "✅ Passed:")} ${passed}/${toRun.length}   ${c("red", "❌ Failed:")} ${failed}/${toRun.length}   ⏱️  ${totalSec}s\n`,
  );
  console.log("  " + "─".repeat(64));

  // Group by category
  const categories = [...new Set(suiteResults.map((r) => r.category))];
  for (const cat of categories) {
    const catSuites = suiteResults.filter((r) => r.category === cat);
    console.log(`\n  ${c("dim", cat.toUpperCase())}`);
    for (const r of catSuites) {
      const icon = r.status === "PASSED" ? c("green", "✅") : c("red", "❌");
      console.log(`  ${icon} ${r.name.padEnd(46)} ${r.duration}s`);
    }
  }
  console.log("\n  " + "─".repeat(64));

  // Save reports
  const dir = path.join(__dirname, "../test-results");
  fs.mkdirSync(dir, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: toRun.length,
      passed,
      failed,
      totalDurationSec: totalSec,
    },
    suiteResults,
  };
  const jPath = path.join(dir, "final-report.json");
  const hPath = path.join(dir, "report.html");
  fs.writeFileSync(jPath, JSON.stringify(report, null, 2));
  generateHTML(report, hPath);

  console.log(`\n  💾 JSON: ${jPath}`);
  console.log(`  📄 HTML: ${hPath}`);
  console.log(
    failed === 0
      ? c("green", "\n  🎉 Tất cả PASSED!\n")
      : c("red", `\n  ⚠️  ${failed} suite(s) FAILED\n`),
  );
  console.log("=".repeat(67) + "\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\n  Fatal:", e.message);
  process.exit(1);
});
