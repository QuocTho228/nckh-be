const ActivityLog = artifacts.require("ActivityLog");
const TraceabilityContract = artifacts.require("TraceabilityContract");

module.exports = async function(deployer, network, accounts) {
    const adminAddress = accounts[0];
    
    console.log("\n========================================");
    console.log("🚀 DEPLOYING ENHANCED CONTRACTS");
    console.log("========================================");
    console.log("Network:", network);
    console.log("Admin Address:", adminAddress);
    console.log("========================================\n");

    // ===================================
    // STEP 1: Deploy ActivityLog Contract
    // ===================================
    console.log("📝 Step 1: Deploying ActivityLog Contract...");
    await deployer.deploy(ActivityLog, { from: adminAddress });
    const activityLogInstance = await ActivityLog.deployed();
    console.log("✅ ActivityLog deployed at:", activityLogInstance.address);
    console.log("   - Supports tree tracking with QR codes");
    console.log("   - Supports detailed activity metadata");
    console.log("");

    // ===================================
    // STEP 2: Deploy TraceabilityContract
    // ===================================
    console.log("📦 Step 2: Deploying TraceabilityContract...");
    await deployer.deploy(
        TraceabilityContract, 
        activityLogInstance.address, 
        { from: adminAddress }
    );
    const traceabilityInstance = await TraceabilityContract.deployed();
    console.log("✅ TraceabilityContract deployed at:", traceabilityInstance.address);
    console.log("   - Supports 8-stage supply chain tracking");
    console.log("   - Supports product-level QR codes");
    console.log("   - Supports tree-to-product linking");
    console.log("");

    // ===================================
    // STEP 3: Verify Deployment
    // ===================================
    console.log("🔍 Step 3: Verifying Deployment...");
    
    try {
        // Test ActivityLog
        const totalTrees = await activityLogInstance.getTotalTrees();
        console.log("✅ ActivityLog verified - Total Trees:", totalTrees.toString());
        
        // Test TraceabilityContract
        const totalBatches = await traceabilityInstance.getTotalBatches();
        console.log("✅ TraceabilityContract verified - Total Batches:", totalBatches.toString());
        
    } catch (error) {
        console.error("❌ Verification failed:", error.message);
        throw error;
    }

    // ===================================
    // STEP 4: Save Contract Addresses
    // ===================================
    console.log("\n📋 Step 4: Contract Addresses Summary");
    console.log("========================================");
    console.log("ActivityLog Address:", activityLogInstance.address);
    console.log("TraceabilityContract Address:", traceabilityInstance.address);
    console.log("========================================");
    
    console.log("\n💡 IMPORTANT: Update your .env file with:");
    console.log("ACTIVITY_LOG_CONTRACT_ADDRESS=" + activityLogInstance.address);
    console.log("TRACEABILITY_CONTRACT_ADDRESS=" + traceabilityInstance.address);
    
    console.log("\n✨ Deployment Complete!\n");

    // ===================================
    // OPTIONAL: Create Sample Data (Only for development)
    // ===================================
    if (network === "development" || network === "ganache") {
        console.log("🌱 Creating sample data for testing...\n");
        
        try {
            // Sample: Register a tree
            console.log("Creating sample tree...");
            const tx1 = await activityLogInstance.registerTree(
                "TREE-001-QR",
                1, // farmerId
                1, // regionId
                "Durian",
                "Monthong",
                "10.123,106.456",
                { from: adminAddress }
            );
            console.log("✅ Sample tree created - Tree ID: 1");
            
            // Sample: Create a batch
            console.log("Creating sample batch...");
            const tx2 = await traceabilityInstance.createBatch(
                "Sample Batch 2025",
                1, // producerId
                "100 kg",
                ["https://example.com/image1.jpg"],
                "https://example.com/cert.jpg",
                "Plot-A-001",
                1, // productTypeId
                Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
                Math.floor(Date.now() / 1000),
                { from: adminAddress, gas: 5000000 }
            );
            console.log("✅ Sample batch created - Batch ID: 1");
            
            console.log("\n🎉 Sample data created successfully!");
            
        } catch (error) {
            console.log("⚠️  Sample data creation failed (this is OK):", error.message);
        }
    }
};