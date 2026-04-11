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

  // Deploy ActivityLog
  await deployer.deploy(ActivityLog, { from: adminAddress });
  const activityLogInstance = await ActivityLog.deployed();

  // Deploy TraceabilityContract
  await deployer.deploy(TraceabilityContract, activityLogInstance.address, {
    from: adminAddress,
  });
  const traceabilityInstance = await TraceabilityContract.deployed();

  // Deploy CorrectionRecord
  await deployer.deploy(CorrectionRecord, { from: adminAddress });
  const correctionInstance = await CorrectionRecord.deployed();

  // Summary
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
};
