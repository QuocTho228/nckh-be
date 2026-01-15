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
        activityLog: process.env.ACTIVITY_LOG_CONTRACT_ADDRESS,
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
        queueLimit: 0,
      },
    };

    // ABIs chứa đầy đủ các event cần lắng nghe
    this.abis = {
      traceability: [
        "event BatchCreated(uint256 indexed batchId, string sscc, uint256 indexed producerId, uint256 productTypeId, uint256 productionDate, bytes32 dataHash)",
        "event BatchDetailsStored(uint256 indexed batchId, string name, string quantity, uint256 startDate, uint256 endDate, string farmPlotNumber)",
        "event BatchApproved(uint256 indexed batchId, uint256 indexed producerId, string sscc)",
        "event BatchRejected(uint256 indexed batchId, uint256 indexed producerId, string sscc, string reason)",
        "event ProductCreated(uint256 indexed productId, string productQRCode, uint256 indexed batchId, uint256 weight, string packageType)",
        "event ProductTreeLinked(uint256 indexed productId, uint256 indexed treeId)",
        "event PurchaseRecorded(uint256 indexed purchaseId, uint256 indexed batchId, uint256 purchaserId, uint256 totalQuantity, uint256 totalPrice)",
        "event PurchaseDetailsStored(uint256 indexed purchaseId, string qualityGrade, string notes)",
        "event ProcessingRecorded(uint256 indexed processingId, uint256 indexed batchId, uint256 processorId, uint8 method)",
        "event ProcessingDetailsStored(uint256 indexed processingId, string methodDescription, string notes)",
        "event QualityTestRecorded(uint256 indexed testId, uint256 indexed batchId, uint256 inspectorId, bool passed, bytes32 resultHash)",
        "event QualityTestDetailsStored(uint256 indexed testId, string testType, string testMethod, string result, string standard)",
        "event TransportStatusUpdated(uint256 indexed batchId, uint8 newStatus, uint256 participantId, uint8 actionCode)",
        "event TransportDetailsStored(uint256 indexed batchId, uint256 participantId, string action, string location, string participantType)",
        "event WarehouseConfirmed(uint256 indexed batchId, uint256 indexed warehouseId)",
        "event StageUpdated(uint256 indexed batchId, uint8 newStage, uint256 participantId)",
      ],
      activityLog: [
        "event TreeRegistered(uint256 indexed treeId, string treeQRCode, uint256 indexed farmerId, uint256 indexed regionId, string treeType, uint256 plantedDate)",
        "event TreeDetailsStored(uint256 indexed treeId, string variety, string coordinates)",
        "event TreeActivityRecorded(uint256 indexed treeId, uint256 logId, uint8 category, uint256 timestamp)",
        "event TreeActivityDetailsStored(uint256 indexed logId, string activityName, string description)",
        "event ActivityMetadataStored(uint256 indexed logId, string fertilizer, string pesticide, uint256 quantity, string unit, int8 temperature, uint8 humidity, string weather, string healthStatus, string notes)",
        "event ActivityImagesStored(uint256 indexed logId, string[] imageUrls)",
        "event TreeLinkedToBatch(uint256 indexed treeId, uint256 indexed batchId, uint256 harvestDate, string notes)",
        "event TreeDeactivated(uint256 indexed treeId, uint256 farmerId, string reason)",
        "event ActivityLogAdded(uint256 indexed batchId, uint256 indexed participantId, uint256 logId, uint8 category, uint256 timestamp, bool isSystemGenerated)",
        "event ActivityLogDetailsStored(uint256 indexed logId, string activityName, string description)",
        "event ActivityProductsLinked(uint256 indexed logId, uint256[] productIds)",
      ],
    };

    this.stats = {
      blocksProcessed: 0,
      eventsProcessed: 0,
      errors: 0,
      startTime: null,
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
      console.log("✅ Blockchain Logger đã sẵn sàng");
      return true;
    } catch (error) {
      console.error("❌ Lỗi khởi tạo:", error.message);
      return false;
    }
  }

  async testDatabaseConnection() {
    const connection = await this.dbPool.getConnection();
    try {
      await connection.query("SELECT 1");
      console.log("✅ Đã kết nối Database");
    } finally {
      connection.release();
    }
  }

  async testProviderConnection() {
    const blockNumber = await this.provider.getBlockNumber();
    console.log(`✅ Đã kết nối Blockchain - Block hiện tại: ${blockNumber}`);
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
    console.log("✅ Đã khởi tạo Contracts");
  }

  safeParseEventData(data) {
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error("JSON parse error:", e);
        return data;
      }
    }
    return data;
  }

  async createTablesIfNotExists() {
    const connection = await this.dbPool.getConnection();
    try {
      // Các bảng blockchain_blocks, blockchain_events, blockchain_sync_status giữ nguyên như cũ
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

      console.log("✅ Đã tạo/kiểm tra Database tables");
    } finally {
      connection.release();
    }
  }

  async saveBlockInfo(blockNumber) {
    // Kiểm tra blockNumber hợp lệ ngay từ đầu
    if (blockNumber == null || typeof blockNumber !== "number") {
      console.error(`⚠️ blockNumber không hợp lệ: ${blockNumber}`);
      return false;
    }

    const connection = await this.dbPool.getConnection();
    try {
      // Lấy thông tin block từ provider
      const block = await this.provider.getBlock(blockNumber);
      if (!block) {
        console.error(`❌ Không lấy được thông tin block #${blockNumber}`);
        return false;
      }

      const timestampISO = new Date(block.timestamp * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      // Sử dụng INSERT IGNORE để tránh lỗi duplicate (an toàn hơn ON DUPLICATE KEY UPDATE ở trường hợp này)
      await connection.query(
        `INSERT IGNORE INTO blockchain_blocks
      (block_number, block_hash, parent_hash, timestamp, timestamp_iso,
       miner, gas_used, gas_limit, transaction_count, difficulty, extra_data, nonce)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          block.number,
          block.hash?.toLowerCase() || null,
          block.parentHash?.toLowerCase() || null,
          block.timestamp,
          timestampISO,
          block.miner?.toLowerCase() || null,
          block.gasUsed ? block.gasUsed.toString() : "0",
          block.gasLimit ? block.gasLimit.toString() : "0",
          Array.isArray(block.transactions) ? block.transactions.length : 0,
          block.difficulty ? block.difficulty.toString() : null,
          block.extraData || null,
          block.nonce || null,
        ]
      );

      this.stats.blocksProcessed++;
      // Chỉ log khi block thực sự mới được insert (tùy chọn, có thể bỏ)
      // console.log(`✅ Saved block #${block.number}`);
      return true;
    } catch (error) {
      console.error(`❌ Lỗi lưu block #${blockNumber}:`, error.message);
      this.stats.errors++;
      return false;
    } finally {
      connection.release();
    }
  }

  async saveEvent(event, eventName, contractAddress) {
    // Lấy blockNumber từ event
    let blockNumber = event.blockNumber;
    let receipt = null;

    // Nếu thiếu blockNumber, đợi receipt
    if (!blockNumber && event.transactionHash) {
      try {
        receipt = await this.provider.getTransactionReceipt(
          event.transactionHash
        );
        blockNumber = receipt?.blockNumber;

        if (!blockNumber) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          receipt = await this.provider.getTransactionReceipt(
            event.transactionHash
          );
          blockNumber = receipt?.blockNumber;
        }
      } catch (err) {
        console.error(
          `⚠️ Không lấy được blockNumber cho TX ${event.transactionHash}`
        );
        return;
      }
    }

    if (blockNumber == null || typeof blockNumber !== "number") {
      console.error(`⚠️ Bỏ qua event ${eventName} - blockNumber không hợp lệ`);
      return;
    }

    const connection = await this.dbPool.getConnection();
    try {
      await connection.beginTransaction();

      // Lưu block info
      await this.saveBlockInfo(blockNumber);

      // Lấy block để có timestamp
      const block = await this.provider.getBlock(blockNumber);
      if (!block) {
        throw new Error("Không lấy được thông tin block");
      }

      const timestampISO = new Date(block.timestamp * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      // ✅ FIXED: Parse ethers.js v6 Result object
      const eventData = {};
      const args = event.args || event.returnValues || {};

      console.log(`📦 Raw args for ${eventName}:`, args);

      // Ethers v6 Result object có thuộc tính .toArray() và .toObject()
      let parsedArgs = {};

      if (args.toObject) {
        // Ethers v6 Result - convert to plain object
        parsedArgs = args.toObject();
      } else if (args.toArray) {
        // Fallback: convert array to object using fragment
        const arr = args.toArray();
        const fragment = event.fragment || event.eventFragment;

        if (fragment && fragment.inputs) {
          fragment.inputs.forEach((input, index) => {
            parsedArgs[input.name] = arr[index];
          });
        }
      } else {
        // Web3.js hoặc plain object
        parsedArgs = args;
      }

      // Convert BigInt/BigNumber sang string
      for (const key in parsedArgs) {
        if (key === "__length__" || !isNaN(key)) continue; // Skip numeric keys

        let value = parsedArgs[key];

        if (typeof value === "bigint") {
          value = value.toString();
        } else if (value && typeof value === "object" && value._isBigNumber) {
          value = value.toString();
        } else if (Array.isArray(value)) {
          value = value.map((v) => {
            if (typeof v === "bigint") return v.toString();
            if (v && typeof v === "object" && v._isBigNumber)
              return v.toString();
            return v;
          });
        }

        eventData[key] = value;
      }

      console.log(`📝 Parsed eventData for ${eventName}:`, eventData);

      // Validate dữ liệu quan trọng
      if (!eventData || Object.keys(eventData).length === 0) {
        console.error(`❌ Event ${eventName} không có dữ liệu sau khi parse`);
        await connection.rollback();
        return;
      }

      // Lấy receipt nếu chưa có
      if (!receipt) {
        receipt = await this.provider.getTransactionReceipt(
          event.transactionHash
        );
      }

      const transactionIndex =
        event.transactionIndex ?? receipt?.transactionIndex ?? 0;
      const logIndex = event.logIndex ?? event.index ?? 0;

      // Lưu vào blockchain_events
      await connection.query(
        `INSERT INTO blockchain_events
      (block_number, transaction_hash, transaction_index, log_index,
       event_name, contract_address, event_data, timestamp, timestamp_iso,
       gas_used, gas_price, tx_from, tx_to, tx_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE event_data = VALUES(event_data)`,
        [
          blockNumber,
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
          receipt?.status ?? null,
        ]
      );

      // Sync dữ liệu nghiệp vụ
      await this.syncCoreBusinessTables(
        eventName,
        eventData,
        event,
        connection
      );

      await connection.commit();
      this.stats.eventsProcessed++;
      console.log(
        `✅ Saved ${eventName} - Block #${blockNumber} - TX: ${event.transactionHash.substring(
          0,
          10
        )}...`
      );
    } catch (error) {
      await connection.rollback();
      console.error(`❌ Lỗi lưu event ${eventName}:`, error.message);
      console.error(
        "Event object:",
        JSON.stringify(
          {
            eventName,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            args: event.args ? "exists" : "missing",
          },
          null,
          2
        )
      );
      this.stats.errors++;
    } finally {
      connection.release();
    }
  }

  async syncCoreBusinessTables(eventName, data, event, connection) {
    switch (eventName) {
      // === BATCH ===
      case "BatchCreated":
        await connection.query(
          `INSERT IGNORE INTO blockchain_batches
          (batch_id, sscc, producer_id, product_type_id, production_date, data_hash)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            data.batchId,
            data.sscc,
            data.producerId,
            data.productTypeId,
            data.productionDate,
            data.dataHash,
          ]
        );
        break;

      case "BatchDetailsStored":
        await connection.query(
          `UPDATE blockchain_batches SET
          batch_name = ?, quantity = ?, start_date = ?, end_date = ?, farm_plot_number = ?
          WHERE batch_id = ?`,
          [
            data.name,
            data.quantity,
            data.startDate,
            data.endDate,
            data.farmPlotNumber,
            data.batchId,
          ]
        );
        break;

      case "BatchApproved":
        await connection.query(
          `UPDATE blockchain_batches SET status = 'Approved', sscc = ?
          WHERE batch_id = ?`,
          [data.sscc, data.batchId]
        );
        break;

      case "BatchRejected":
        await connection.query(
          `UPDATE blockchain_batches SET status = 'Rejected'
          WHERE batch_id = ?`,
          [data.batchId]
        );
        break;

      // === PRODUCT ===
      case "ProductCreated":
        await connection.query(
          `INSERT IGNORE INTO blockchain_products
          (product_id, product_qr_code, batch_id, weight, package_type)
          VALUES (?, ?, ?, ?, ?)`,
          [
            data.productId,
            data.productQRCode,
            data.batchId,
            data.weight,
            data.packageType,
          ]
        );
        break;

      case "ProductTreeLinked":
        await connection.query(
          `INSERT IGNORE INTO product_source_trees
          (product_id, tree_id)
          VALUES (?, ?)`,
          [data.productId, data.treeId]
        );
        break;

      // === TREE ===
      case "TreeRegistered":
        await connection.query(
          `INSERT IGNORE INTO trees
          (tree_id, tree_qr_code, farmer_id, region_id, tree_type, planted_date)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            data.treeId,
            data.treeQRCode,
            data.farmerId,
            data.regionId,
            data.treeType,
            data.plantedDate,
          ]
        );
        break;

      case "TreeDetailsStored":
        await connection.query(
          `UPDATE trees SET variety = ?, coordinates = ?
          WHERE tree_id = ?`,
          [data.variety, data.coordinates, data.treeId]
        );
        break;

      // === ACTIVITY LOG ===
      case "ActivityLogAdded":
        await connection.query(
          `INSERT IGNORE INTO batch_activity_logs
          (log_id, batch_id, participant_id, timestamp, category, is_system_activity)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            data.logId,
            data.batchId,
            data.participantId,
            data.timestamp,
            data.category,
            data.isSystemGenerated,
          ]
        );
        break;

      case "ActivityLogDetailsStored":
        await connection.query(
          `UPDATE batch_activity_logs SET activity_name = ?, description = ?
          WHERE log_id = ?`,
          [data.activityName, data.description, data.logId]
        );
        break;

      case "ActivityImagesStored":
        for (const img of data.imageUrls || []) {
          await connection.query(
            `INSERT IGNORE INTO batch_activity_images
            (log_id, image_url)
            VALUES (?, ?)`,
            [data.logId, img]
          );
        }
        break;

      case "ActivityProductsLinked":
        for (const prodId of data.productIds || []) {
          await connection.query(
            `INSERT IGNORE INTO batch_activity_products
            (log_id, product_id)
            VALUES (?, ?)`,
            [data.logId, prodId]
          );
        }
        break;

      case "ActivityMetadataStored":
        await connection.query(
          `UPDATE batch_activity_logs SET
          fertilizer = ?, pesticide = ?, quantity = ?, unit = ?,
          temperature = ?, humidity = ?, weather = ?, health_status = ?, notes = ?
          WHERE log_id = ?`,
          [
            data.fertilizer,
            data.pesticide,
            data.quantity,
            data.unit,
            data.temperature,
            data.humidity,
            data.weather,
            data.healthStatus,
            data.notes,
            data.logId,
          ]
        );
        break;

      // === TREE ACTIVITY ===
      case "TreeActivityRecorded":
        await connection.query(
          `INSERT IGNORE INTO tree_activity_logs
          (log_id, tree_id, participant_id, timestamp, category, is_system_activity)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            data.logId,
            data.treeId,
            event.transactionHash ? "system" : null, // Giả sử
            data.timestamp,
            data.category,
            true, // Thường là system
          ]
        );
        break;

      case "TreeActivityDetailsStored":
        await connection.query(
          `UPDATE tree_activity_logs SET activity_name = ?, description = ?
          WHERE log_id = ?`,
          [data.activityName, data.description, data.logId]
        );
        break;

      // Thêm images cho tree activity (nếu event có)
      case "ActivityImagesStored": // Reuse nếu chung event
        if (data.logId && tree) {
          for (const img of data.imageUrls || []) {
            await connection.query(
              `INSERT IGNORE INTO tree_activity_images
              (log_id, image_url)
              VALUES (?, ?)`,
              [data.logId, img]
            );
          }
        }
        break;

      // === PURCHASE ===
      case "PurchaseRecorded":
        await connection.query(
          `INSERT IGNORE INTO purchase_records
          (purchase_id, batch_id, purchaser_id, total_quantity, total_price)
          VALUES (?, ?, ?, ?, ?)`,
          [
            data.purchaseId,
            data.batchId,
            data.purchaserId,
            data.totalQuantity,
            data.totalPrice,
          ]
        );
        break;

      case "PurchaseDetailsStored":
        await connection.query(
          `UPDATE purchase_records SET quality_grade = ?, notes = ?
          WHERE purchase_id = ?`,
          [data.qualityGrade, data.notes, data.purchaseId]
        );
        // Images nếu có
        for (const img of data.imageUrls || []) {
          // Giả sử event emit images
          await connection.query(
            `INSERT IGNORE INTO purchase_images
            (purchase_id, image_url)
            VALUES (?, ?)`,
            [data.purchaseId, img]
          );
        }
        break;

      // Thêm các case khác nếu cần...

      default:
        console.log(`ℹ️ No specific sync for ${eventName}`);
        break;
    }
  }

  // Chỉ sync các entity chính, tránh lỗi null do thứ tự event
  async syncCoreBusinessTables(eventName, data, event, connection) {
    const block = await this.provider.getBlock(event.blockNumber);
    const timestampISO = new Date(block.timestamp * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    switch (eventName) {
      // === Tree ===
      case "TreeRegistered":
        await connection.query(
          `
          INSERT INTO trees
          (tree_id, tree_qr_code, farmer_id, region_id, tree_type, planted_date, planted_date_iso, blockchain_tx_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE farmer_id = VALUES(farmer_id)
        `,
          [
            data.treeId,
            data.treeQRCode,
            data.farmerId,
            data.regionId,
            data.treeType,
            data.plantedDate,
            timestampISO,
            event.transactionHash,
          ]
        );
        break;

      case "TreeDeactivated":
        await connection.query(
          `UPDATE trees SET is_active = FALSE WHERE tree_id = ?`,
          [data.treeId]
        );
        break;

      case "TreeLinkedToBatch":
        await connection.query(
          `
          INSERT INTO tree_batch_links
          (tree_id, batch_id, harvest_date, harvest_date_iso, harvest_notes)
          VALUES (?, ?, ?, ?, ?)
        `,
          [
            data.treeId,
            data.batchId,
            data.harvestDate,
            timestampISO,
            data.notes,
          ]
        );
        break;

      // === Tree Activity ===
      case "TreeActivityRecorded":
        console.log("📝 Syncing TreeActivityRecorded:", data);

        // Validate data
        if (!data.logId || !data.treeId) {
          console.error(
            "❌ TreeActivityRecorded thiếu logId hoặc treeId:",
            data
          );
          return;
        }

        // Lấy category name
        const categoryMap = [
          "TreeManagement",
          "Farming",
          "Harvesting",
          "Purchase",
          "Transport",
          "Processing",
          "Packaging",
          "QualityControl",
          "Warehouse",
          "Distribution",
        ];
        const categoryName =
          categoryMap[parseInt(data.category)] || "TreeManagement";

        // ✅ FIX: Lấy farmer_id từ tree để làm participant_id (vì event không có)
        const [treeInfo] = await connection.query(
          "SELECT farmer_id FROM trees WHERE tree_id = ?",
          [data.treeId]
        );

        const participantId =
          treeInfo.length > 0 ? treeInfo[0].farmer_id : null;

        if (!participantId) {
          console.error(`❌ Không tìm thấy farmer cho tree ${data.treeId}`);
          return;
        }

        console.log(
          `✅ Found participant_id: ${participantId} for tree ${data.treeId}`
        );

        // Insert với activity_name = '' (sẽ được update bởi TreeActivityDetailsStored)
        await connection.query(
          `
    INSERT INTO tree_activity_logs
    (log_id, tree_id, participant_id, timestamp, timestamp_iso, 
     category, activity_name, is_system_activity, blockchain_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, '', FALSE, ?)
    ON DUPLICATE KEY UPDATE 
      timestamp = VALUES(timestamp),
      category = VALUES(category)
  `,
          [
            data.logId,
            data.treeId,
            participantId,
            data.timestamp || block.timestamp,
            timestampISO,
            categoryName,
            event.transactionHash,
          ]
        );

        console.log(
          `✅ Synced TreeActivityRecorded - logId: ${data.logId}, participant: ${participantId}`
        );
        break;

      case "TreeActivityDetailsStored":
        if (!data.logId) {
          console.error("❌ TreeActivityDetailsStored thiếu logId:", data);
          return;
        }

        await connection.query(
          `
        UPDATE tree_activity_logs 
        SET activity_name = ?, description = ?
        WHERE log_id = ?
      `,
          [data.activityName, data.description, data.logId]
        );
        console.log(`✅ Updated TreeActivityDetails - logId: ${data.logId}`);
        break;

      case "ActivityMetadataStored":
        if (!data.logId) {
          console.error("❌ ActivityMetadataStored thiếu logId:", data);
          return;
        }

        await connection.query(
          `
        UPDATE tree_activity_logs 
        SET fertilizer = ?, pesticide = ?, quantity = ?, unit = ?,
            temperature = ?, humidity = ?, weather = ?, 
            health_status = ?, notes = ?
        WHERE log_id = ?
      `,
          [
            data.fertilizer,
            data.pesticide,
            data.quantity ? (parseInt(data.quantity) / 1000).toFixed(2) : null,
            data.unit,
            data.temperature,
            data.humidity,
            data.weather,
            data.healthStatus,
            data.notes,
            data.logId,
          ]
        );
        console.log(`✅ Updated ActivityMetadata - logId: ${data.logId}`);
        break;

      case "ActivityImagesStored":
        if (data.imageUrls && Array.isArray(data.imageUrls)) {
          const values = data.imageUrls.map((url) => [data.logId, url]);
          if (values.length > 0) {
            await connection.query(
              "INSERT INTO tree_activity_images (log_id, image_url) VALUES ?",
              [values]
            );
          }
        }
        break;

      // === Batch ===
      case "BatchCreated":
        if (!data.batchId || !data.sscc || !data.producerId) {
          console.warn(
            `⚠️ BatchCreated thiếu data cần thiết, bỏ qua: ${JSON.stringify(
              data
            )}`
          );
          break;
        }
        await connection.query(
          `
      INSERT INTO blockchain_batches
      (batch_id, sscc, producer_id, product_type_id, production_date, production_date_iso, data_hash, status, current_stage, blockchain_tx_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PendingApproval', 'Created', ?)
      ON DUPLICATE KEY UPDATE sscc = VALUES(sscc), status = 'PendingApproval'
    `,
          [
            data.batchId,
            data.sscc,
            data.producerId,
            data.productTypeId,
            data.productionDate || block.timestamp,
            timestampISO,
            data.dataHash,
            event.transactionHash,
          ]
        );
        break;

      case "BatchDetailsStored":
        await connection.query(
          `
      UPDATE blockchain_batches SET
      batch_name = ?,
      quantity = ?,
      start_date = ?,
      start_date_iso = FROM_UNIXTIME(?),
      end_date = ?,
      end_date_iso = FROM_UNIXTIME(?)
      WHERE batch_id = ?
    `,
          [
            data.name,
            data.quantity,
            data.startDate,
            data.startDate,
            data.endDate,
            data.endDate,
            // data.farmPlotNumber, // Bỏ vì nó sẽ cập nhật rỗng từ smart contract (đã lưu từ Farmer)
            data.batchId,
          ]
        );
        break;

      case "BatchApproved":
        if (!data.batchId) {
          console.warn(
            `⚠️ BatchApproved thiếu data cần thiết, bỏ qua update: ${JSON.stringify(
              data
            )}`
          );
          break; // Tránh insert null
        }
        await connection.query(
          `
            UPDATE blockchain_batches 
            SET status = 'Approved', current_stage = 'Purchased'
            WHERE batch_id = ?
          `,
          [data.batchId]
        );
        break;

      case "BatchRejected":
        await connection.query(
          `UPDATE blockchain_batches SET status = 'Rejected' WHERE batch_id = ?`,
          [data.batchId]
        );
        break;

      // === Product ===
      case "ProductCreated":
        // ✅ CHỈ INSERT nếu chưa tồn tại - KHÔNG ghi đè
        await connection.query(
          `INSERT IGNORE INTO blockchain_products
    (product_id, batch_id, product_qr_code, packaged_date, packaged_date_iso,
     weight, package_type, blockchain_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(data.productId),
            Number(data.batchId),
            data.productQRCode,
            Number(block.timestamp),
            timestampISO,
            Number(data.weight),
            data.packageType,
            event.transactionHash,
          ]
        );

        // Update total_products (chỉ khi INSERT thành công)
        const [checkResult] = await connection.query(
          `SELECT product_id FROM blockchain_products WHERE product_id = ?`,
          [Number(data.productId)]
        );

        if (checkResult.length > 0) {
          await connection.query(
            `UPDATE blockchain_batches 
       SET total_products = total_products + 1 
       WHERE batch_id = ?`,
            [Number(data.batchId)]
          );
        }

        console.log(
          `📦 Product ${data.productId} created for batch ${data.batchId}`
        );
        break;

      case "ProductTreeLinked":
        // ✅ Link product với source tree
        await connection.query(
          `INSERT IGNORE INTO product_source_trees (product_id, tree_id) 
     VALUES (?, ?)`,
          [Number(data.productId), Number(data.treeId)]
        );

        console.log(
          `🌳 Product ${data.productId} linked to tree ${data.treeId}`
        );
        break;

      // === Purchase ===
      case "PurchaseRecorded":
        if (!data.purchaseId || !data.batchId || !data.purchaserId) {
          console.warn("PurchaseRecorded thiếu data cần thiết, bỏ qua", data);
          break;
        }

        // Lấy farmer_id từ blockchain_batches
        const [batchRows] = await connection.query(
          "SELECT producer_id FROM blockchain_batches WHERE batch_id = ?",
          [data.batchId]
        );
        if (batchRows.length === 0) {
          console.warn(`Không tìm thấy batch ${data.batchId} để lấy farmer_id`);
          break;
        }
        const farmerId = batchRows[0].producer_id;

        // ✅ CHỈ INSERT nếu chưa tồn tại - KHÔNG ghi đè detail fields
        await connection.query(
          `INSERT IGNORE INTO purchase_records
    (purchase_id, batch_id, purchaser_id, farmer_id, purchase_date, purchase_date_iso,
     total_quantity, total_price, blockchain_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(data.purchaseId),
            Number(data.batchId),
            Number(data.purchaserId),
            farmerId,
            Number(data.timestamp || block.timestamp),
            timestampISO,
            Number(data.totalQuantity || 0),
            Number(data.totalPrice || 0),
            event.transactionHash,
          ]
        );

        // Update stage batch
        await connection.query(
          `UPDATE blockchain_batches 
     SET current_stage = 'Purchased', purchaser_id = ? 
     WHERE batch_id = ?`,
          [Number(data.purchaserId), Number(data.batchId)]
        );

        console.log(
          `✅ Đã sync thu mua purchaseId ${data.purchaseId} - farmerId ${farmerId}`
        );
        break;

      // ✅ THÊM: Xử lý PurchaseDetailsStored
      case "PurchaseDetailsStored":
        // UPDATE chi tiết nếu có
        await connection.query(
          `UPDATE purchase_records
     SET quality_grade = COALESCE(?, quality_grade),
         notes = COALESCE(?, notes)
     WHERE purchase_id = ?`,
          [
            data.qualityGrade || null,
            data.notes || null,
            Number(data.purchaseId),
          ]
        );
        console.log(`📝 Updated purchase details for ID: ${data.purchaseId}`);
        break;

      // === Processing ===
      case "ProcessingRecorded":
        const methodMap = {
          0: "Washing",
          1: "Cutting",
          2: "Drying",
          3: "Freezing",
          4: "Packaging",
        };

        const methodText = methodMap[Number(data.method)] || "Washing";

        // ✅ CHỈ INSERT nếu chưa tồn tại
        await connection.query(
          `INSERT IGNORE INTO processing_records
    (processing_id, batch_id, processor_id, processing_date, processing_date_iso,
     method, blockchain_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(data.processingId),
            Number(data.batchId),
            Number(data.processorId),
            Number(block.timestamp),
            timestampISO,
            methodText,
            event.transactionHash,
          ]
        );

        // Update stage
        await connection.query(
          `UPDATE blockchain_batches 
     SET current_stage = 'Processed', processor_id = ? 
     WHERE batch_id = ?`,
          [Number(data.processorId), Number(data.batchId)]
        );
        break;

      case "ProcessingDetailsStored":
        // ✅ UPDATE chi tiết nếu có
        await connection.query(
          `UPDATE processing_records
          SET method_description = COALESCE(?, method_description),
          notes = COALESCE(?, notes)
          WHERE processing_id = ?`,
          [
            data.methodDescription || null,
            data.notes || null,
            Number(data.processingId),
          ]
        );
        console.log(
          `📝 Updated processing details for ID: ${data.processingId}`
        );
        break;

      // === Quality Test ===
      case "QualityTestRecorded":
        // ✅ CHỈ INSERT nếu chưa tồn tại - KHÔNG ghi đè detail fields
        await connection.query(
          `INSERT IGNORE INTO quality_tests
    (test_id, batch_id, inspector_id, test_date, test_date_iso, passed, blockchain_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(data.testId),
            Number(data.batchId),
            Number(data.inspectorId),
            Number(block.timestamp),
            timestampISO,
            Boolean(data.passed),
            event.transactionHash,
          ]
        );

        // Update stage nếu passed
        if (data.passed) {
          await connection.query(
            `UPDATE blockchain_batches 
       SET current_stage = 'QualityInspected', quality_inspector_id = ? 
       WHERE batch_id = ?`,
            [Number(data.inspectorId), Number(data.batchId)]
          );
        }

        console.log(
          `✅ Quality test ${data.testId} recorded - Passed: ${data.passed}`
        );
        break;

      // ✅ THÊM: Xử lý QualityTestDetailsStored
      case "QualityTestDetailsStored":
        // UPDATE chi tiết nếu có
        await connection.query(
          `UPDATE quality_tests
     SET test_type = COALESCE(?, test_type),
         test_method = COALESCE(?, test_method),
         result = COALESCE(?, result),
         standard = COALESCE(?, standard)
     WHERE test_id = ?`,
          [
            data.testType || null,
            data.testMethod || null,
            data.result || null,
            data.standard || null,
            Number(data.testId),
          ]
        );
        console.log(`📝 Updated quality test details for ID: ${data.testId}`);
        break;

      // === Transport ===
      case "TransportStatusUpdated":
        // Map actionCode sang detailed_transport_status
        let detailedStatus;
        switch (parseInt(data.actionCode)) {
          case 0:
            detailedStatus = "InTransit";
            break; // Bắt đầu
          case 1:
            detailedStatus = "Paused";
            break; // Tạm dừng
          case 2:
            detailedStatus = "InTransit";
            break; // Tiếp tục
          case 3:
            detailedStatus = "Delivered";
            break; // Hoàn thành
          default:
            detailedStatus = "NotStarted";
        }

        // Map sang transport_status (tổng quát hơn)
        let transportStatus = "NotTransported";
        if (detailedStatus === "Delivered") {
          transportStatus = "Delivered";
        } else if (detailedStatus !== "NotStarted") {
          transportStatus = "InTransit";
        }

        // Chỉ update blockchain_batches: last_transporter_id, transport_status, detailed_transport_status
        // Bỏ insert transport_events vì xử lý off-chain ở API để có đầy đủ temperature/humidity
        await connection.query(
          `UPDATE blockchain_batches 
     SET last_transporter_id = ?, transport_status = ?, detailed_transport_status = ? 
     WHERE batch_id = ?`,
          [data.participantId, transportStatus, detailedStatus, data.batchId]
        );
        break;

      // Thêm case mới cho event chi tiết (giả sử event name là "TransportDetailsStored" - kiểm tra contract để xác nhận)
      case "TransportDetailsStored":
        // Update record mới nhất của batch và participant với details
        await connection.query(
          `
    UPDATE transport_events 
    SET action = ?, location = ?, participant_type = ? 
    WHERE batch_id = ? AND participant_id = ? 
    ORDER BY id DESC LIMIT 1
    `,
          [
            data.action || "", // String chi tiết, default ''
            data.location || null,
            data.participantType || "Transporter", // Default từ API
            data.batchId,
            data.participantId,
          ]
        );
        break;

      // === Warehouse ===
      case "WarehouseConfirmed":
        // CHỈ INSERT nếu chưa tồn tại
        await connection.query(
          `INSERT IGNORE INTO warehouse_confirmations
    (batch_id, warehouse_id, confirmed_at, blockchain_tx_hash)
    VALUES (?, ?, ?, ?)`,
          [
            Number(data.batchId),
            Number(data.warehouseId),
            timestampISO,
            event.transactionHash,
          ]
        );

        // Update stage
        await connection.query(
          `UPDATE blockchain_batches 
     SET current_stage = 'Warehoused' 
     WHERE batch_id = ?`,
          [Number(data.batchId)]
        );

        console.log(
          `🏭 Warehouse ${data.warehouseId} confirmed batch ${data.batchId}`
        );
        break;

      // === Activity Log (chỉ phần chính) ===
      case "ActivityLogAdded":
        await connection.query(
          `
          INSERT INTO batch_activity_logs
          (log_id, batch_id, participant_id, timestamp, timestamp_iso, category, is_system_activity, blockchain_tx_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE timestamp = VALUES(timestamp)
        `,
          [
            data.logId,
            data.batchId,
            data.participantId,
            data.timestamp || block.timestamp,
            timestampISO,
            data.category,
            data.isSystemGenerated,
            event.transactionHash,
          ]
        );
        break;

      // === Các event DetailsStored → tạm bỏ qua để tránh null, sẽ sync sau bằng script riêng ===
      default:
        if (
          eventName.includes("DetailsStored") ||
          eventName.includes("ImagesStored") ||
          eventName.includes("MetadataStored")
        ) {
          console.log(
            `ℹ️ Details event ${eventName} đã lưu vào blockchain_events - sẽ sync chi tiết sau`
          );
        }
        break;
    }
  }

  // Các hàm syncHistoricalEvents, startListening, setupListeners... giữ nguyên như phiên bản trước (đã hoạt động tốt)
  // (Đoạn code còn lại không thay đổi nhiều nên giữ nguyên để tránh dài dòng)

  async syncHistoricalEvents() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    const connection = await this.dbPool.getConnection();

    try {
      await connection.query(
        "UPDATE blockchain_sync_status SET is_syncing = TRUE WHERE id = 1"
      );
      const [rows] = await connection.query(
        "SELECT last_synced_block FROM blockchain_sync_status WHERE id = 1"
      );
      let fromBlock = parseInt(rows[0].last_synced_block) + 1;
      const currentBlock = await this.provider.getBlockNumber();

      if (fromBlock > currentBlock) {
        console.log("✅ Đã đồng bộ hết lịch sử");
        return;
      }

      console.log(
        `🔄 Đồng bộ lịch sử từ block ${fromBlock} đến ${currentBlock}`
      );

      for (
        let start = fromBlock;
        start <= currentBlock;
        start += this.config.syncBatchSize
      ) {
        const end = Math.min(
          start + this.config.syncBatchSize - 1,
          currentBlock
        );
        console.log(`  Processing ${start}-${end}...`);

        // Traceability events
        const traceEvents = await this.contracts.traceability.queryFilter(
          "*",
          start,
          end
        );
        for (const ev of traceEvents) {
          const name =
            ev.event || ev.eventName || ev.fragment?.name || "Unknown";

          // ✅ Ensure event has proper structure
          if (!ev.args && ev.returnValues) {
            ev.args = ev.returnValues;
          }

          await this.saveEvent(
            ev,
            name,
            this.config.contractAddresses.traceability
          );
        }

        // Activity events
        const activityEvents = await this.contracts.activityLog.queryFilter(
          "*",
          start,
          end
        );
        for (const ev of activityEvents) {
          const name =
            ev.event || ev.eventName || ev.fragment?.name || "Unknown";

          // ✅ Ensure event has proper structure
          if (!ev.args && ev.returnValues) {
            ev.args = ev.returnValues;
          }

          await this.saveEvent(
            ev,
            name,
            this.config.contractAddresses.activityLog
          );
        }

        await connection.query(
          `UPDATE blockchain_sync_status SET last_synced_block = ?, last_sync_at = NOW() WHERE id = 1`,
          [end]
        );
      }

      console.log("✅ Đồng bộ lịch sử hoàn tất");
    } catch (err) {
      console.error("❌ Lỗi đồng bộ lịch sử:", err.message);
    } finally {
      await connection.query(
        "UPDATE blockchain_sync_status SET is_syncing = FALSE WHERE id = 1"
      );
      connection.release();
      this.isSyncing = false;
    }
  }

  startListening() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stats.startTime = Date.now();
    console.log("👂 Bắt đầu lắng nghe real-time events...");

    this.setupTraceabilityListeners();
    this.setupActivityLogListeners();

    this.provider.on("block", async (blockNumber) => {
      await this.saveBlockInfo(blockNumber);
      // Kiểm tra gap và tự động sync nếu cần
      const [rows] = await this.dbPool.query(
        "SELECT last_synced_block FROM blockchain_sync_status WHERE id = 1"
      );
      if (blockNumber > parseInt(rows[0].last_synced_block) + 1) {
        await this.syncHistoricalEvents();
      }
    });
  }

  // Setup listeners cho tất cả events (giữ nguyên như phiên bản trước của bạn)
  setupTraceabilityListeners() {
    const contract = this.contracts.traceability;
    const address = this.config.contractAddresses.traceability;

    const events = [
      "BatchCreated",
      "BatchDetailsStored",
      "BatchApproved",
      "BatchRejected",
      "ProductCreated",
      "ProductTreeLinked",
      "PurchaseRecorded",
      "PurchaseDetailsStored",
      "ProcessingRecorded",
      "ProcessingDetailsStored",
      "QualityTestRecorded",
      "QualityTestDetailsStored",
      "TransportStatusUpdated",
      "TransportDetailsStored",
      "WarehouseConfirmed",
      "StageUpdated",
    ];

    events.forEach((ev) => {
      contract.on(ev, async (...args) => {
        const event = args[args.length - 1];
        await this.saveEvent(event, ev, address);
      });
    });
  }

  setupActivityLogListeners() {
    const contract = this.contracts.activityLog;
    const address = this.config.contractAddresses.activityLog;

    const events = [
      "TreeRegistered",
      "TreeDetailsStored",
      "TreeActivityRecorded",
      "TreeActivityDetailsStored",
      "ActivityMetadataStored",
      "ActivityImagesStored",
      "TreeLinkedToBatch",
      "TreeDeactivated",
      "ActivityLogAdded",
      "ActivityLogDetailsStored",
      "ActivityProductsLinked",
    ];

    events.forEach((eventName) => {
      contract.on(eventName, async (...args) => {
        // Event object là argument cuối cùng
        const event = args[args.length - 1];

        console.log(`🔔 Received ${eventName} event:`, {
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          args: event.args || event.returnValues,
        });

        await this.saveEvent(event, eventName, address);
      });
    });

    console.log(`✅ Đã setup ${events.length} ActivityLog listeners`);
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
        event_data: this.safeParseEventData(row.event_data), // ✅ Dùng helper
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
        // event_data: JSON.parse(row.event_data),
        event_data: this.safeParseEventData(row.event_data),
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
          errors: this.stats.errors,
        },
      };
    } finally {
      connection.release();
    }
  }

  async stop() {
    console.log("🛑 Dừng Blockchain Logger...");
    this.isRunning = false;
    this.contracts.traceability?.removeAllListeners();
    this.contracts.activityLog?.removeAllListeners();
    this.provider?.removeAllListeners();
    await this.dbPool?.end();
    console.log("✅ Đã dừng hoàn toàn");
  }
}

const logger = new BlockchainLogger();

module.exports = { BlockchainLogger, logger };
