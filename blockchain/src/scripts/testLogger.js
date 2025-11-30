const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
const { logger } = require("../blockchainLogger");

async function testLogger() {
  try {
    console.log("🧪 Testing Blockchain Logger...\n");

    console.log("1. Initializing...");
    const initialized = await logger.initialize();
    if (!initialized) {
      throw new Error("Không thể khởi tạo logger");
    }
    console.log("   ✓ Initialized\n");

    console.log("2. Getting stats...");
    const stats = await logger.getStats();
    console.log("   Stats:", JSON.stringify(stats, null, 2));
    console.log("   ✓ Stats retrieved\n");

    console.log("3. Syncing historical data...");
    await logger.syncHistoricalEvents();
    console.log("   ✓ Sync completed\n");

    console.log("4. Getting updated stats...");
    const newStats = await logger.getStats();
    console.log("   New Stats:", JSON.stringify(newStats, null, 2));
    console.log("   ✓ Updated stats retrieved\n");

    console.log("5. Testing queries...");
    const block0 = await logger.getBlockInfo(0);
    console.log("   Block 0:", block0 ? "✓ Found" : "✗ Not found");

    const recentEvents = await logger.getRecentEvents(5);
    console.log(`   Recent events: ${recentEvents.length} found`);

    console.log("\n✓ All tests passed!");

    await logger.stop();
    process.exit(0);
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  testLogger();
}
