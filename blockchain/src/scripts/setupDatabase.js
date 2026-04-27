const mysql = require("mysql2/promise");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });

async function setupDatabase() {
  let connection;
  try {
    console.log("🔧 Đang setup database...\n");

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      port: process.env.DB_PORT,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      multipleStatements: true
    });

    const sqlPath = path.join(__dirname, "../database/blockchain_schema.sql");
    const sql = await fs.readFile(sqlPath, "utf8");

    await connection.query(sql);

    console.log("✓ Đã tạo database schema thành công!");
    console.log("\nCác bảng đã tạo:");
    console.log("  - blockchain_blocks");
    console.log("  - blockchain_events");
    console.log("  - blockchain_sync_status");
  } catch (error) {
    console.error("✗ Lỗi setup database:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
