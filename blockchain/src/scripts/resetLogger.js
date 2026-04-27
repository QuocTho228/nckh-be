const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
const mysql = require("mysql2/promise");
const readline = require("readline");

async function resetLogger() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  WARNING: Delete ALL blockchain logger data?\nType "CONFIRM": ',
      async (answer) => {
        rl.close();

        if (answer !== "CONFIRM") {
          console.log("\n✗ Cancelled");
          resolve();
          return;
        }

        let connection;
        try {
          connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            port: process.env.DB_PORT,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE
          });

          console.log("\n🗑️  Deleting...");

          await connection.query("DELETE FROM blockchain_events");
          console.log("   ✓ Deleted events");

          await connection.query("DELETE FROM blockchain_blocks");
          console.log("   ✓ Deleted blocks");

          await connection.query(
            "UPDATE blockchain_sync_status SET last_synced_block = -1 WHERE id = 1"
          );
          console.log("   ✓ Reset status");

          console.log("\n✓ Complete!\n");
        } catch (error) {
          console.error("\n✗ Error:", error.message);
        } finally {
          if (connection) await connection.end();
          resolve();
        }
      }
    );
  });
}

if (require.main === module) {
  resetLogger().then(() => process.exit(0));
}
