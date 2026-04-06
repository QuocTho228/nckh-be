const ActivityLog = artifacts.require("ActivityLog");
const TraceabilityContract = artifacts.require("TraceabilityContract");
const CorrectionRecord = artifacts.require("CorrectionRecord");

module.exports = async function (deployer, network, accounts) {
  const adminAddress = accounts[0];

  console.log("\n========================================");
  console.log("🚀 DEPLOYING ALL CONTRACTS");
  console.log("========================================");
  console.log("Network     :", network);
  console.log("Admin Addr  :", adminAddress);
  console.log("========================================\n");

  // ===================================
  // STEP 1: Deploy ActivityLog
  // ===================================
  console.log("📝 Step 1: Deploying ActivityLog...");
  await deployer.deploy(ActivityLog, { from: adminAddress });
  const activityLogInstance = await ActivityLog.deployed();
  console.log("✅ ActivityLog deployed at:", activityLogInstance.address);
  console.log("   - Supports tree tracking with QR codes");
  console.log("   - Supports detailed activity metadata\n");

  // ===================================
  // STEP 2: Deploy TraceabilityContract
  // ===================================
  console.log("📦 Step 2: Deploying TraceabilityContract...");
  await deployer.deploy(TraceabilityContract, activityLogInstance.address, {
    from: adminAddress,
  });
  const traceabilityInstance = await TraceabilityContract.deployed();
  console.log(
    "✅ TraceabilityContract deployed at:",
    traceabilityInstance.address,
  );
  console.log("   - Supports 8-stage supply chain tracking");
  console.log("   - Supports product-level QR codes");
  console.log("   - Supports tree-to-product linking\n");

  // ===================================
  // STEP 3: Deploy CorrectionRecord
  // ===================================
  console.log("📝 Step 3: Deploying CorrectionRecord...");
  await deployer.deploy(CorrectionRecord, { from: adminAddress });
  const correctionInstance = await CorrectionRecord.deployed();
  console.log("✅ CorrectionRecord deployed at:", correctionInstance.address);
  console.log("   - Supports correction/amendment records\n");

  // ===================================
  // STEP 4: Verify Deployment
  // ===================================
  console.log("🔍 Step 4: Verifying Deployment...");
  try {
    const totalTrees = await activityLogInstance.getTotalTrees();
    console.log(
      "✅ ActivityLog verified       - Total Trees  :",
      totalTrees.toString(),
    );

    const totalBatches = await traceabilityInstance.getTotalBatches();
    console.log(
      "✅ TraceabilityContract verified - Total Batches:",
      totalBatches.toString(),
    );

    const totalCorrections = await correctionInstance.getTotalCorrections();
    const owner = await correctionInstance.owner();
    console.log(
      "✅ CorrectionRecord verified  - Total Corrections:",
      totalCorrections.toString(),
    );
    console.log("✅ CorrectionRecord owner     :", owner);
  } catch (err) {
    console.error("❌ Verification failed:", err.message);
    throw err;
  }

  // ===================================
  // STEP 5: Summary
  // ===================================
  console.log("\n📋 Contract Address Summary");
  console.log("========================================");
  console.log("ActivityLog         :", activityLogInstance.address);
  console.log("TraceabilityContract:", traceabilityInstance.address);
  console.log("CorrectionRecord    :", correctionInstance.address);
  console.log("========================================");
  console.log("\n💡 Thêm vào .env:");
  console.log("ACTIVITY_LOG_CONTRACT_ADDRESS=" + activityLogInstance.address);
  console.log("TRACEABILITY_CONTRACT_ADDRESS=" + traceabilityInstance.address);
  console.log("CORRECTION_CONTRACT_ADDRESS=" + correctionInstance.address);
  console.log("\n✨ Deployment Complete!\n");

  // ===================================
  // OPTIONAL: Sample Data (development only)
  // ===================================
  if (network === "development" || network === "ganache") {
    console.log("🌱 Creating sample data for testing...\n");
    try {
      console.log("Creating sample tree...");
      await activityLogInstance.registerTree(
        "TREE-001-QR",
        1,
        1,
        "Durian",
        "Monthong",
        "10.123,106.456",
        { from: adminAddress },
      );
      console.log("✅ Sample tree created - Tree ID: 1");

      console.log("Creating sample batch...");
      await traceabilityInstance.createBatch(
        "Sample Batch 2025",
        1,
        "100 kg",
        ["https://example.com/image1.jpg"],
        "https://example.com/cert.jpg",
        "Plot-A-001",
        1,
        Math.floor(Date.now() / 1000) - 86400 * 30,
        Math.floor(Date.now() / 1000),
        { from: adminAddress, gas: 5000000 },
      );
      console.log("✅ Sample batch created - Batch ID: 1");

      console.log("\n🎉 Sample data created successfully!");
    } catch (error) {
      console.log(
        "⚠️  Sample data creation failed (this is OK):",
        error.message,
      );
    }
  }
};
