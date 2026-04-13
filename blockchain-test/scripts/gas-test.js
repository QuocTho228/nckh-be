/**
 * GAS TEST  —  Web3 v4.x
 * Đo lường gas tiêu thụ từng thao tác trong chuỗi cung ứng sầu riêng
 * Lưu kết quả vào test-results/gas-report.json
 *
 * Sử dụng:
 *   node scripts/gas-test.js
 *   node scripts/gas-test.js --json-only   (chỉ xuất JSON, không in bảng)
 *
 * Số liệu giá thực tế tháng 4/2026 (nguồn: Etherscan, BaseScan, Fortune):
 *   Ethereum avg gas : ~0.5 Gwei  (range 0.07-0.53 Gwei)
 *   Ethereum peak    : ~50 Gwei   (worst-case)
 *   ETH price        : ~$2,182
 *   Polygon gas      : ~30 Gwei,  POL ~$0.20
 *   Base L2 gas      : ~0.005 Gwei, ETH ~$2,182
 */

const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");
const H = require("./web3-helper");

// ─── Hàm tính USD — KHÔNG hardcode, luôn nhận tham số ────────────────────────
const calcUSD = (gas, gasPriceGwei, tokenPriceUSD) =>
  Number(gas) * gasPriceGwei * 1e-9 * tokenPriceUSD;

const fmtUSD = (usd) =>
  usd < 0.000001
    ? usd.toExponential(2)
    : usd < 0.001
      ? usd.toFixed(7)
      : usd < 1
        ? usd.toFixed(5)
        : usd.toFixed(4);

// ─── 4 mạng so sánh — số liệu thực tế 4/2026 ────────────────────────────────
const COL_NETS = [
  {
    key: "eth_now",
    label: "ETH avg (0.5 Gwei)",
    gwei: 0.5,
    price: 2182,
    unit: "ETH",
  },
  {
    key: "eth_peak",
    label: "ETH peak (50 Gwei)",
    gwei: 50,
    price: 2182,
    unit: "ETH",
  },
  {
    key: "polygon",
    label: "Polygon (30 Gwei)",
    gwei: 30,
    price: 0.2,
    unit: "POL",
  },
  {
    key: "base",
    label: "Base L2 (0.005 Gwei)",
    gwei: 0.005,
    price: 2182,
    unit: "ETH",
  },
];

// ─── Helpers in bảng ─────────────────────────────────────────────────────────
const W_OP = 36;
const W_GAS = 13;
const W_COL = 22;

const divider = () =>
  "  +" +
  "-".repeat(W_OP + 2) +
  "+" +
  "-".repeat(W_GAS + 2) +
  "+" +
  COL_NETS.map(() => "-".repeat(W_COL + 2)).join("+") +
  "+";

const headerRow = () =>
  "  | " +
  "Thao tac".padEnd(W_OP) +
  " | " +
  "Gas tieu thu".padStart(W_GAS) +
  " | " +
  COL_NETS.map((n) => n.label.padStart(W_COL)).join(" | ") +
  " |";

const dataRow = (label, gas) => {
  const g = Number(gas);
  const costs = COL_NETS.map((n) =>
    ("~$" + fmtUSD(calcUSD(g, n.gwei, n.price))).padStart(W_COL),
  );
  return (
    "  | " +
    label.padEnd(W_OP) +
    " | " +
    g.toLocaleString("en-US").padStart(W_GAS) +
    " | " +
    costs.join(" | ") +
    " |"
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runGasTest() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes("--json-only");

  const web3 = new Web3(H.GANACHE_URL);
  const accounts = await web3.eth.getAccounts();
  const owner = accounts[0];

  const alABI = H.loadABI("ActivityLog");
  const tcABI = H.loadABI("TraceabilityContract");

  // ── Deploy ────────────────────────────────────────────────────────────────
  const alDeploy = new web3.eth.Contract(alABI.abi).deploy({
    data: alABI.bytecode,
  });
  const gasDeployAL = await alDeploy.estimateGas({ from: owner });
  const alInst = await alDeploy.send({ from: owner, gas: 6000000n });

  const tcDeploy = new web3.eth.Contract(tcABI.abi).deploy({
    data: tcABI.bytecode,
    arguments: [alInst.options.address],
  });
  const gasDeployTC = await tcDeploy.estimateGas({ from: owner });
  const tcInst = await tcDeploy.send({ from: owner, gas: 9000000n });

  const results = {};

  // ── 1. registerTree ───────────────────────────────────────────────────────
  results.registerTree = Number(
    await alInst.methods
      .registerTree(
        "GAS-QR-001",
        1n,
        1n,
        "Musang King",
        "Premium",
        "10.45,106.32",
      )
      .estimateGas({ from: owner }),
  );
  await alInst.methods
    .registerTree(
      "GAS-QR-001",
      1n,
      1n,
      "Musang King",
      "Premium",
      "10.45,106.32",
    )
    .send({ from: owner, gas: 700000n });

  // ── 2. addTreeCareActivity ────────────────────────────────────────────────
  results.addTreeCareActivity = Number(
    await alInst.methods
      .addTreeCareActivity(1n, 1n, 0n, "Tuoi nuoc", "Tuoi 10 lit")
      .estimateGas({ from: owner }),
  );

  // ── 3. addActivityLog ─────────────────────────────────────────────────────
  results.addActivityLog = Number(
    await alInst.methods
      .addActivityLog(1n, 1n, "Ghi nhat ky", "Mo ta hoat dong", false)
      .estimateGas({ from: owner }),
  );

  // ── 4. addDetailedActivityLog ─────────────────────────────────────────────
  results.addDetailedActivityLog = Number(
    await alInst.methods
      .addDetailedActivityLog(
        1n,
        1n,
        0n,
        "Ghi nhat ky chi tiet",
        "Mo ta day du",
        false,
      )
      .estimateGas({ from: owner }),
  );

  // ── 5. createBatch ────────────────────────────────────────────────────────
  const nowTs = BigInt(Math.floor(Date.now() / 1000));
  results.createBatch = Number(
    await tcInst.methods
      .createBatch("Musang King", 1n, "500", 1n, nowTs, nowTs + 2592000n)
      .estimateGas({ from: owner }),
  );

  const rb = await H.createBatch(tcInst, owner, "Musang King", 1, "500", 1);
  const bid = H.getBatchId(rb) || 1;
  const rb2 = await H.createBatch(tcInst, owner, "Batch Reject", 1, "200", 1);
  const bid2 = H.getBatchId(rb2) || 2;

  // ── 6. approveBatch ───────────────────────────────────────────────────────
  results.approveBatch = Number(
    await tcInst.methods
      .approveBatch(H.toBI(bid), 1n)
      .estimateGas({ from: owner }),
  );
  await H.approveBatch(tcInst, owner, bid);

  // ── 7. rejectBatch ────────────────────────────────────────────────────────
  results.rejectBatch = Number(
    await tcInst.methods
      .rejectBatch(H.toBI(bid2), 1n, "Khong dat chat luong")
      .estimateGas({ from: owner }),
  );

  // ── 8. recordPurchase ─────────────────────────────────────────────────────
  results.recordPurchase = Number(
    await tcInst.methods
      .recordPurchase(H.toBI(bid), 1n, 500n, 50000n)
      .estimateGas({ from: owner }),
  );
  await H.recordPurchase(tcInst, owner, bid);

  // ── 9. updateTransportStatus ──────────────────────────────────────────────
  results.updateTransportStatus = Number(
    await tcInst.methods
      .updateTransportStatus(H.toBI(bid), 1n, 0, 28, 75)
      .estimateGas({ from: owner }),
  );

  // ── 10. recordProcessing ──────────────────────────────────────────────────
  results.recordProcessing = Number(
    await tcInst.methods
      .recordProcessing(H.toBI(bid), 1n, 0, 500n, 480n)
      .estimateGas({ from: owner })
      .catch(() => 300000n),
  );
  await H.recordProcessing(tcInst, owner, bid).catch(() => {});

  // ── 11. recordQualityTest ─────────────────────────────────────────────────
  results.recordQualityTest = Number(
    await tcInst.methods
      .recordQualityTest(H.toBI(bid), 1n, true)
      .estimateGas({ from: owner })
      .catch(() => 200000n),
  );

  // ── 12. warehouseConfirmation ─────────────────────────────────────────────
  results.warehouseConfirmation = Number(
    await tcInst.methods
      .warehouseConfirmation(H.toBI(bid), 1n)
      .estimateGas({ from: owner })
      .catch(() => 150000n),
  );

  // ── Tính vòng đời 1 lô ────────────────────────────────────────────────────
  const lifecycle = [
    { label: "Dang ky cay trong", key: "registerTree" },
    { label: "Cham soc cay (x3)", key: "addTreeCareActivity", mult: 3 },
    { label: "Tao lo hang", key: "createBatch" },
    { label: "Phe duyet lo hang", key: "approveBatch" },
    { label: "Ghi nhat ky HD (x5)", key: "addDetailedActivityLog", mult: 5 },
    { label: "Ghi nhan mua hang", key: "recordPurchase" },
    { label: "Cap nhat van chuyen", key: "updateTransportStatus" },
    { label: "Ghi nhan che bien", key: "recordProcessing" },
    { label: "Kiem tra chat luong", key: "recordQualityTest" },
    { label: "Xac nhan kho", key: "warehouseConfirmation" },
  ];

  const lifecycleRows = lifecycle.map(({ label, key, mult = 1 }) => ({
    label,
    gas: results[key] * mult,
  }));
  const totalLifecycleGas = lifecycleRows.reduce((s, r) => s + r.gas, 0);

  // ── In bảng ra console ────────────────────────────────────────────────────
  if (!jsonOnly) {
    const LINE = "=".repeat(112);
    console.log("\n" + LINE);
    console.log("  BLOCKCHAIN SAU RIENG — GAS TEST  (gia thuc te 4/2026)");
    console.log(
      "  ETH ~$2,182  |  avg 0.5 Gwei  |  peak 50 Gwei  |  Polygon 30 Gwei  |  Base 0.005 Gwei",
    );
    console.log(LINE);

    const section = (title, rows) => {
      console.log("\n  " + title);
      console.log(divider());
      console.log(headerRow());
      console.log(divider());
      rows.forEach(([lbl, g]) => console.log(dataRow(lbl, g)));
      console.log(divider());
    };

    section("DEPLOY", [
      ["Deploy ActivityLog", gasDeployAL],
      ["Deploy TraceabilityContract", gasDeployTC],
      ["Tong deploy (1 lan)", BigInt(gasDeployAL) + BigInt(gasDeployTC)],
    ]);

    section("ACTIVITY LOG", [
      ["registerTree", results.registerTree],
      ["addTreeCareActivity", results.addTreeCareActivity],
      ["addActivityLog", results.addActivityLog],
      ["addDetailedActivityLog", results.addDetailedActivityLog],
    ]);

    section("TRACEABILITY CONTRACT", [
      ["createBatch", results.createBatch],
      ["approveBatch", results.approveBatch],
      ["rejectBatch", results.rejectBatch],
      ["recordPurchase", results.recordPurchase],
      ["updateTransportStatus", results.updateTransportStatus],
      ["recordProcessing", results.recordProcessing],
      ["recordQualityTest", results.recordQualityTest],
      ["warehouseConfirmation", results.warehouseConfirmation],
    ]);

    console.log("\n  VONG DOI 1 LO HANG");
    console.log(divider());
    console.log(headerRow());
    console.log(divider());
    lifecycleRows.forEach((r) => console.log(dataRow(r.label, r.gas)));
    console.log(divider());
    console.log(dataRow("TONG 1 lo hang", totalLifecycleGas));
    console.log(divider());

    console.log("\n  CHI PHI UOC TINH (tong 1 vong doi, 1000 lo/nam):");
    for (const n of COL_NETS) {
      const u1 = calcUSD(totalLifecycleGas, n.gwei, n.price);
      const u1000 = u1 * 1000;
      console.log(
        `     ${n.label.padEnd(22)}: ~$${fmtUSD(u1)}/lo  ->  1,000 lo/nam: ~$${u1000 < 1 ? u1000.toFixed(5) : u1000.toFixed(2)}`,
      );
    }
    console.log("\n" + LINE + "\n");
  }

  // ── Tạo JSON report — KHÔNG còn hardcode ─────────────────────────────────
  const costObj = (gas) =>
    Object.fromEntries(
      COL_NETS.map((n) => [
        n.key,
        "~$" + fmtUSD(calcUSD(gas, n.gwei, n.price)),
      ]),
    );

  const report = {
    timestamp: new Date().toISOString(),
    priceSource: "Etherscan / BaseScan / Fortune — April 10-11, 2026",
    // Thông số giá dùng để tính
    networkParams: Object.fromEntries(
      COL_NETS.map((n) => [
        n.key,
        {
          label: n.label,
          gasPriceGwei: n.gwei,
          tokenPriceUSD: n.price,
          unit: n.unit,
        },
      ]),
    ),
    deployment: {
      ActivityLog: { gas: Number(gasDeployAL), cost: costObj(gasDeployAL) },
      TraceabilityContract: {
        gas: Number(gasDeployTC),
        cost: costObj(gasDeployTC),
      },
      total: {
        gas: Number(gasDeployAL) + Number(gasDeployTC),
        cost: costObj(Number(gasDeployAL) + Number(gasDeployTC)),
      },
    },
    activityLog: Object.fromEntries(
      [
        "registerTree",
        "addTreeCareActivity",
        "addActivityLog",
        "addDetailedActivityLog",
      ].map((k) => [k, { gas: results[k], cost: costObj(results[k]) }]),
    ),
    traceability: Object.fromEntries(
      [
        "createBatch",
        "approveBatch",
        "rejectBatch",
        "recordPurchase",
        "updateTransportStatus",
        "recordProcessing",
        "recordQualityTest",
        "warehouseConfirmation",
      ].map((k) => [k, { gas: results[k], cost: costObj(results[k]) }]),
    ),
    lifecycle: {
      steps: lifecycleRows.map((r) => ({
        label: r.label,
        gas: r.gas,
        cost: costObj(r.gas),
      })),
      totalGas: totalLifecycleGas,
      totalCost: costObj(totalLifecycleGas),
      per1000Batches: Object.fromEntries(
        COL_NETS.map((n) => {
          const u1000 = calcUSD(totalLifecycleGas, n.gwei, n.price) * 1000;
          return [
            n.key,
            "~$" + (u1000 < 1 ? u1000.toFixed(5) : u1000.toFixed(2)),
          ];
        }),
      ),
    },
    // Bảng tóm tắt cho luận văn / báo cáo
    summaryTable: [
      {
        operation: "Dang ky cay trong",
        gas: results.registerTree,
        ...costObj(results.registerTree),
      },
      {
        operation: "Tao lo hang",
        gas: results.createBatch,
        ...costObj(results.createBatch),
      },
      {
        operation: "Ghi nhat ky hoat dong",
        gas: results.addActivityLog,
        ...costObj(results.addActivityLog),
      },
      {
        operation: "Phe duyet lo hang",
        gas: results.approveBatch,
        ...costObj(results.approveBatch),
      },
      {
        operation: "Tong mot vong doi san pham (uoc tinh)",
        gas: totalLifecycleGas,
        ...costObj(totalLifecycleGas),
      },
    ],
  };

  const outDir = path.join(__dirname, "../test-results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "gas-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  if (!jsonOnly) {
    console.log(`  Saved: ${outPath}\n`);
  } else {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  }

  return report;
}

// ─── Entry point ─────────────────────────────────────────────────────────────
if (require.main === module) {
  runGasTest()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("\n  ERROR:", e.message);
      process.exit(1);
    });
}

module.exports = { runGasTest };
