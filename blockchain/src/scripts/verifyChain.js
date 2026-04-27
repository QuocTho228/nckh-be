const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
const { logger } = require("../blockchainLogger");
const mysql = require("mysql2/promise");

async function verifyChain(fromBlock = 0, toBlock = null) {
  let connection;
  try {
    await logger.initialize();

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      port: process.env.DB_PORT,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
    });

    if (!toBlock) {
      const [rows] = await connection.query(
        "SELECT MAX(block_number) as max_block FROM blockchain_blocks"
      );
      toBlock = rows[0].max_block || 0;
    }

    console.log(
      `\n🔍 Verifying chain from block ${fromBlock} to ${toBlock}...\n`
    );

    const [results] = await connection.query(
      `SELECT 
        b1.block_number,
        b1.block_hash,
        b1.parent_hash,
        b2.block_hash as prev_block_hash,
        CASE 
          WHEN b1.parent_hash = b2.block_hash THEN 'OK'
          WHEN b1.block_number = 0 THEN 'GENESIS'
          ELSE 'BROKEN'
        END as status
      FROM blockchain_blocks b1
      LEFT JOIN blockchain_blocks b2 ON b1.block_number - 1 = b2.block_number
      WHERE b1.block_number BETWEEN ? AND ?
      ORDER BY b1.block_number`,
      [fromBlock, toBlock]
    );

    const broken = results.filter((r) => r.status === "BROKEN");
    const ok = results.filter(
      (r) => r.status === "OK" || r.status === "GENESIS"
    );

    console.log("RESULTS:");
    console.log(`  Total blocks: ${results.length}`);
    console.log(`  ✓ Valid:      ${ok.length}`);
    console.log(`  ✗ Broken:     ${broken.length}`);

    if (broken.length > 0) {
      console.log("\n⚠️  BROKEN CHAINS:\n");
      broken.forEach((b) => {
        console.log(`  Block ${b.block_number}:`);
        console.log(`    Expected: ${b.prev_block_hash || "N/A"}`);
        console.log(`    Got:      ${b.parent_hash}`);
      });
    } else {
      console.log("\n✓ Chain integrity verified!");
    }

    await logger.stop();
    if (connection) await connection.end();
    process.exit(broken.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("Error:", error);
    if (connection) await connection.end();
    process.exit(1);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const fromBlock = parseInt(args[0]) || 0;
  const toBlock = args[1] ? parseInt(args[1]) : null;
  verifyChain(fromBlock, toBlock);
}
