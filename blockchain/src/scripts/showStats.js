const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
const { logger } = require("../blockchainLogger");

async function showStats() {
  try {
    await logger.initialize();

    const stats = await logger.getStats();

    console.log("\n========================================");
    console.log("📊 BLOCKCHAIN LOGGER STATISTICS");
    console.log("========================================\n");

    console.log("DATABASE:");
    console.log(`  Total Blocks:      ${stats.total_blocks}`);
    console.log(`  Total Events:      ${stats.total_events}`);
    console.log(`  Event Types:       ${stats.unique_event_types}`);
    console.log(`  Last Synced Block: ${stats.last_synced_block}`);
    console.log(`  Last Sync:         ${stats.last_sync_at || "Never"}`);

    if (stats.runtime) {
      console.log("\nRUNTIME:");
      console.log(`  Uptime:            ${stats.runtime.uptime_seconds}s`);
      console.log(`  Blocks Processed:  ${stats.runtime.blocks_processed}`);
      console.log(`  Events Processed:  ${stats.runtime.events_processed}`);
      console.log(`  Errors:            ${stats.runtime.errors}`);
    }

    console.log("\n========================================\n");

    await logger.stop();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  showStats();
}
