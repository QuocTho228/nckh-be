const { ethers } = require("ethers");
const mysql = require("mysql2/promise");
require("dotenv").config();

class BlockchainLogger {
  constructor(options = {}) {
    this.dbPool = null;
    this.provider = null;
    this.contracts = {};
    this.isRunning = false;
    this.isSyncing = false;

    this.config = {
      providerUrl: options.providerUrl || "http://127.0.0.1:8545",
      contractAddresses: {
        traceability: process.env.TRACEABILITY_CONTRACT_ADDRESS,
        activityLog: process.env.ACTIVITY_LOG_CONTRACT_ADDRESS
      },
      syncBatchSize: options.syncBatchSize || 100,
      syncInterval: options.syncInterval || 5000,
      db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        port: process.env.DB_PORT,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      }
    };

    this.abis = {
      traceability: [
        "event BatchCreated(uint256 indexed batchId, string sscc, uint256 producerId)",
        "event BatchApproved(uint256 indexed batchId, uint256 indexed producerId, string sscc)",
        "event BatchRejected(uint256 indexed batchId, uint256 producerId, string sscc)",
        "event TransportStatusUpdated(uint256 indexed batchId, uint8 newStatus, string action, uint256 participantId, string participantType)",
        "event WarehouseConfirmed(uint256 indexed batchId, uint256 indexed warehouseId)",
        "event ParticipationRecorded(uint256 indexed batchId, uint256 participantId, string participantType, string action)"
      ],
      activityLog: [
        "event ActivityLogAdded(uint256 indexed batchId, uint256 indexed participantId, string activityName, string description, bool isSystemGenerated, string[] imageUrls, uint256[] relatedProductIds)"
      ]
    };

    this.stats = {
      blocksProcessed: 0,
      eventsProcessed: 0,
      errors: 0,
      startTime: null
    };
  }

  async initialize() {
    try {
      console.log("🚀 Khởi tạo Blockchain Logger...");

      this.dbPool = mysql.createPool(this.config.db);
      await this.testDatabaseConnection();
      await this.createTablesIfNotExists();

      this.provider = new ethers.JsonRpcProvider(this.config.providerUrl);
      await this.testProviderConnection();

      this.initializeContracts();

      console.log("✓ Blockchain Logger đã sẵn sàng");
      return true;
    } catch (error) {
      console.error("✗ Lỗi khởi tạo:", error.message);
      return false;
    }
  }

  async testDatabaseConnection() {
    const connection = await this.dbPool.getConnection();
    try {
      await connection.query("SELECT 1");
      console.log("✓ Đã kết nối Database");
    } finally {
      connection.release();
    }
  }

  async testProviderConnection() {
    const blockNumber = await this.provider.getBlockNumber();
    console.log(`✓ Đã kết nối Blockchain - Block hiện tại: ${blockNumber}`);
  }

  initializeContracts() {
    this.contracts.traceability = new ethers.Contract(
      this.config.contractAddresses.traceability,
      this.abis.traceability,
      this.provider
    );

    this.contracts.activityLog = new ethers.Contract(
      this.config.contractAddresses.activityLog,
      this.abis.activityLog,
      this.provider
    );

    console.log("✓ Đã khởi tạo Contracts");
  }

  async createTablesIfNotExists() {
    const connection = await this.dbPool.getConnection();

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS blockchain_blocks (
          block_number BIGINT PRIMARY KEY,
          block_hash VARCHAR(66) NOT NULL UNIQUE,
          parent_hash VARCHAR(66) NOT NULL,
          timestamp BIGINT NOT NULL,
          timestamp_iso DATETIME NOT NULL,
          miner VARCHAR(42),
          gas_used BIGINT DEFAULT 0,
          gas_limit BIGINT DEFAULT 0,
          transaction_count INT DEFAULT 0,
          difficulty VARCHAR(100),
          extra_data TEXT,
          nonce VARCHAR(66),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_block_hash (block_hash),
          INDEX idx_parent_hash (parent_hash),
          INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS blockchain_events (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          transaction_index INT NOT NULL,
          log_index INT NOT NULL,
          event_name VARCHAR(100) NOT NULL,
          contract_address VARCHAR(42) NOT NULL,
          event_data JSON NOT NULL,
          timestamp BIGINT NOT NULL,
          timestamp_iso DATETIME NOT NULL,
          gas_used BIGINT,
          gas_price VARCHAR(100),
          tx_from VARCHAR(42),
          tx_to VARCHAR(42),
          tx_status TINYINT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_event (transaction_hash, log_index),
          INDEX idx_block (block_number),
          INDEX idx_tx_hash (transaction_hash),
          INDEX idx_event_name (event_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS blockchain_sync_status (
          id INT PRIMARY KEY DEFAULT 1,
          last_synced_block BIGINT NOT NULL DEFAULT -1,
          total_blocks_synced BIGINT NOT NULL DEFAULT 0,
          total_events_synced BIGINT NOT NULL DEFAULT 0,
          last_sync_at TIMESTAMP NULL,
          sync_errors INT DEFAULT 0,
          last_error TEXT,
          is_syncing BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await connection.query(`
        INSERT IGNORE INTO blockchain_sync_status (id, last_synced_block) 
        VALUES (1, -1)
      `);

      console.log("✓ Đã tạo/kiểm tra Database tables");
    } finally {
      connection.release();
    }
  }

  async saveBlockInfo(blockNumber) {
    const connection = await this.dbPool.getConnection();

    try {
      const block = await this.provider.getBlock(blockNumber);

      if (!block) {
        console.warn(`⚠️ Block ${blockNumber} không tồn tại`);
        return false;
      }

      const timestampISO = new Date(block.timestamp * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      await connection.query(
        `INSERT INTO blockchain_blocks 
        (block_number, block_hash, parent_hash, timestamp, timestamp_iso, 
         miner, gas_used, gas_limit, transaction_count, difficulty, extra_data, nonce)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          block_hash = VALUES(block_hash),
          parent_hash = VALUES(parent_hash)`,
        [
          block.number,
          block.hash,
          block.parentHash,
          block.timestamp,
          timestampISO,
          block.miner || null,
          block.gasUsed?.toString() || "0",
          block.gasLimit?.toString() || "0",
          block.transactions?.length || 0,
          block.difficulty?.toString() || null,
          block.extraData || null,
          block.nonce || null
        ]
      );

      this.stats.blocksProcessed++;
      return true;
    } catch (error) {
      console.error(`✗ Lỗi lưu block ${blockNumber}:`, error.message);
      this.stats.errors++;
      return false;
    } finally {
      connection.release();
    }
  }

  async saveEvent(event, eventName, contractAddress) {
    const connection = await this.dbPool.getConnection();

    try {
      await this.saveBlockInfo(event.blockNumber);

      const block = await this.provider.getBlock(event.blockNumber);
      const timestampISO = new Date(block.timestamp * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      const eventData = {};
      for (const key in event.args) {
        if (isNaN(key)) {
          let value = event.args[key];

          if (typeof value === "bigint") {
            value = value.toString();
          } else if (Array.isArray(value)) {
            value = value.map((v) =>
              typeof v === "bigint" ? v.toString() : v
            );
          }

          eventData[key] = value;
        }
      }

      const receipt = await this.provider.getTransactionReceipt(
        event.transactionHash
      );

      // ✅ FIX: Handle null/undefined values properly
      const transactionIndex = event.transactionIndex ?? event.index ?? 0;
      const logIndex = event.logIndex ?? event.index ?? 0;

      await connection.query(
        `INSERT INTO blockchain_events 
        (block_number, transaction_hash, transaction_index, log_index, 
         event_name, contract_address, event_data, timestamp, timestamp_iso,
         gas_used, gas_price, tx_from, tx_to, tx_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          event_data = VALUES(event_data)`,
        [
          event.blockNumber,
          event.transactionHash,
          transactionIndex,
          logIndex,
          eventName,
          contractAddress.toLowerCase(),
          JSON.stringify(eventData),
          block.timestamp,
          timestampISO,
          receipt?.gasUsed?.toString() || null,
          receipt?.effectiveGasPrice?.toString() || null,
          receipt?.from?.toLowerCase() || null,
          receipt?.to?.toLowerCase() || null,
          receipt?.status || null
        ]
      );

      this.stats.eventsProcessed++;
      console.log(
        `✓ Lưu event ${eventName} - Block #${
          event.blockNumber
        } - TX: ${event.transactionHash.substring(0, 10)}...`
      );
      return true;
    } catch (error) {
      console.error(`✗ Lỗi lưu event:`, error.message);
      this.stats.errors++;
      return false;
    } finally {
      connection.release();
    }
  }

  async syncHistoricalEvents() {
    if (this.isSyncing) {
      console.log("⚠️ Đang sync, bỏ qua yêu cầu mới");
      return;
    }

    this.isSyncing = true;
    const connection = await this.dbPool.getConnection();

    try {
      console.log("🔄 Bắt đầu đồng bộ lịch sử...");

      await connection.query(
        "UPDATE blockchain_sync_status SET is_syncing = TRUE WHERE id = 1"
      );

      const [rows] = await connection.query(
        "SELECT last_synced_block FROM blockchain_sync_status WHERE id = 1"
      );

      const lastSyncedBlock = parseInt(rows[0].last_synced_block);
      const fromBlock = lastSyncedBlock + 1;
      const currentBlock = await this.provider.getBlockNumber();

      if (fromBlock > currentBlock) {
        console.log("✓ Đã đồng bộ hết");
        return;
      }

      console.log(`📥 Đồng bộ từ block ${fromBlock} đến ${currentBlock}`);

      let totalEvents = 0;
      for (
        let start = fromBlock;
        start <= currentBlock;
        start += this.config.syncBatchSize
      ) {
        const end = Math.min(
          start + this.config.syncBatchSize - 1,
          currentBlock
        );

        console.log(`   Processing blocks ${start} - ${end}...`);

        const traceEvents = await this.contracts.traceability.queryFilter(
          "*",
          start,
          end
        );
        for (const event of traceEvents) {
          // ✅ FIX: Safe event name extraction
          const eventName =
            event.eventName ||
            (event.fragment && event.fragment.name) ||
            "UnknownEvent";

          await this.saveEvent(
            event,
            eventName,
            this.config.contractAddresses.traceability
          );
          totalEvents++;
        }

        const activityEvents = await this.contracts.activityLog.queryFilter(
          "*",
          start,
          end
        );
        for (const event of activityEvents) {
          const eventName =
            event.eventName ||
            (event.fragment && event.fragment.name) ||
            "UnknownEvent";

          await this.saveEvent(
            event,
            eventName,
            this.config.contractAddresses.activityLog
          );
          totalEvents++;
        }

        await connection.query(
          `UPDATE blockchain_sync_status 
           SET last_synced_block = ?,
               total_events_synced = total_events_synced + ?,
               last_sync_at = NOW()
           WHERE id = 1`,
          [end, traceEvents.length + activityEvents.length]
        );
      }

      console.log(
        `✓ Đã đồng bộ ${totalEvents} events từ ${fromBlock} đến ${currentBlock}`
      );
    } catch (error) {
      console.error("✗ Lỗi đồng bộ:", error.message);

      await connection.query(
        `UPDATE blockchain_sync_status 
         SET sync_errors = sync_errors + 1,
             last_error = ?
         WHERE id = 1`,
        [error.message]
      );

      this.stats.errors++;
    } finally {
      await connection.query(
        "UPDATE blockchain_sync_status SET is_syncing = FALSE WHERE id = 1"
      );
      connection.release();
      this.isSyncing = false;
    }
  }

  startListening() {
    if (this.isRunning) {
      console.warn("⚠️ Logger đã đang chạy");
      return;
    }

    this.isRunning = true;
    this.stats.startTime = Date.now();
    console.log("👂 Bắt đầu lắng nghe events real-time...");

    this.setupTraceabilityListeners();
    this.setupActivityLogListeners();

    // Sync chỉ khi có block mới
    this.provider.on("block", async (blockNumber) => {
      await this.saveBlockInfo(blockNumber);

      // Kiểm tra có events mới trong block này không
      const connection = await this.dbPool.getConnection();
      try {
        const [rows] = await connection.query(
          "SELECT last_synced_block FROM blockchain_sync_status WHERE id = 1"
        );

        const lastSynced = parseInt(rows[0].last_synced_block);

        // Chỉ sync nếu có gap (bỏ lỡ block)
        if (blockNumber > lastSynced + 1) {
          console.log(
            `⚠️ Phát hiện gap: last=${lastSynced}, current=${blockNumber}`
          );
          await this.syncHistoricalEvents();
        }
      } finally {
        connection.release();
      }
    });
  }

  setupTraceabilityListeners() {
    const contract = this.contracts.traceability;
    const address = this.config.contractAddresses.traceability;

    contract.on("BatchCreated", async (batchId, sscc, producerId, event) => {
      await this.saveEvent(event, "BatchCreated", address);
    });

    contract.on("BatchApproved", async (batchId, producerId, sscc, event) => {
      await this.saveEvent(event, "BatchApproved", address);
    });

    contract.on("BatchRejected", async (batchId, producerId, sscc, event) => {
      await this.saveEvent(event, "BatchRejected", address);
    });

    contract.on(
      "TransportStatusUpdated",
      async (
        batchId,
        newStatus,
        action,
        participantId,
        participantType,
        event
      ) => {
        await this.saveEvent(event, "TransportStatusUpdated", address);
      }
    );

    contract.on("WarehouseConfirmed", async (batchId, warehouseId, event) => {
      await this.saveEvent(event, "WarehouseConfirmed", address);
    });

    contract.on(
      "ParticipationRecorded",
      async (batchId, participantId, participantType, action, event) => {
        await this.saveEvent(event, "ParticipationRecorded", address);
      }
    );
  }

  setupActivityLogListeners() {
    const contract = this.contracts.activityLog;
    const address = this.config.contractAddresses.activityLog;

    contract.on(
      "ActivityLogAdded",
      async (
        batchId,
        participantId,
        activityName,
        description,
        isSystemGenerated,
        imageUrls,
        relatedProductIds,
        event
      ) => {
        await this.saveEvent(event, "ActivityLogAdded", address);
      }
    );
  }

  async getBlockInfo(blockNumber) {
    const connection = await this.dbPool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT * FROM blockchain_blocks WHERE block_number = ?",
        [blockNumber]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  async getEventsByBatch(batchId) {
    const connection = await this.dbPool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT e.*, b.block_hash, b.parent_hash, b.timestamp as block_timestamp
         FROM blockchain_events e
         JOIN blockchain_blocks b ON e.block_number = b.block_number
         WHERE JSON_UNQUOTE(JSON_EXTRACT(e.event_data, '$.batchId')) = ?
         ORDER BY e.block_number ASC, e.log_index ASC`,
        [batchId.toString()]
      );

      return rows.map((row) => ({
        ...row,
        event_data: JSON.parse(row.event_data)
      }));
    } finally {
      connection.release();
    }
  }

  async getRecentEvents(limit = 50) {
    const connection = await this.dbPool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT e.*, b.block_hash, b.parent_hash
         FROM blockchain_events e
         JOIN blockchain_blocks b ON e.block_number = b.block_number
         ORDER BY e.block_number DESC, e.id DESC
         LIMIT ?`,
        [limit]
      );

      return rows.map((row) => ({
        ...row,
        event_data: JSON.parse(row.event_data)
      }));
    } finally {
      connection.release();
    }
  }

  async getStats() {
    const connection = await this.dbPool.getConnection();
    try {
      const [stats] = await connection.query(`
        SELECT 
          (SELECT COUNT(*) FROM blockchain_blocks) as total_blocks,
          (SELECT COUNT(*) FROM blockchain_events) as total_events,
          (SELECT COUNT(DISTINCT event_name) FROM blockchain_events) as unique_event_types,
          (SELECT last_synced_block FROM blockchain_sync_status WHERE id=1) as last_synced_block,
          (SELECT last_sync_at FROM blockchain_sync_status WHERE id=1) as last_sync_at
      `);

      const uptime = this.stats.startTime
        ? Math.floor((Date.now() - this.stats.startTime) / 1000)
        : 0;

      return {
        ...stats[0],
        runtime: {
          uptime_seconds: uptime,
          blocks_processed: this.stats.blocksProcessed,
          events_processed: this.stats.eventsProcessed,
          errors: this.stats.errors
        }
      };
    } finally {
      connection.release();
    }
  }

  async stop() {
    console.log("🛑 Đang dừng Blockchain Logger...");
    this.isRunning = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    if (this.contracts.traceability) {
      await this.contracts.traceability.removeAllListeners();
    }

    if (this.contracts.activityLog) {
      await this.contracts.activityLog.removeAllListeners();
    }

    if (this.provider) {
      await this.provider.removeAllListeners();
    }

    if (this.dbPool) {
      await this.dbPool.end();
    }

    console.log("✓ Blockchain Logger đã dừng");
  }
}

const logger = new BlockchainLogger();

module.exports = { BlockchainLogger, logger };
