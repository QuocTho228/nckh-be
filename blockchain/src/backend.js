const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const express = require("express");
const app = express();
const { Web3 } = require("web3");
const path = require("path");
const mysql = require("mysql2");
require("dotenv").config();
const { logger: blockchainLogger } = require("./blockchainLogger");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");
const QRCode = require("qrcode");
const QrCode = require("qrcode-reader");
const util = require("util");
const bodyParser = require("body-parser");
const fs = require("fs");
const { requireAuth, requireRole, ROLES } = require("./middleware/roleAuth");

app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

// Thêm middleware CORS
const cors = require("cors");
app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const { notifyNewBatch, notifyApproveBatch } = require("./notification");

// Tạo thư mục uploads
const uploadDir = path.join(__dirname, "public", "uploads", "batches");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const today = new Date();
    const uploadPath = path.join(
      uploadDir,
      today.getFullYear().toString(),
      (today.getMonth() + 1).toString(),
    );

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Giới hạn kích thước ảnh/file và số lượng ảnh/file
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 10,
  },
}).fields([
  { name: "productImages", maxCount: 10 }, // Ảnh sản phẩm
  { name: "certificateImage", maxCount: 1 }, // Ảnh chứng nhận
  { name: "purchaseImages", maxCount: 5 }, // Thêm cho thu mua
  { name: "processingImages", maxCount: 10 }, // Thêm cho sơ chế
  { name: "testImages", maxCount: 10 }, // Thêm cho kiểm nghiệm
]);

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
});

// Xử lý lỗi kết nối
db.on("error", (err) => {
  console.error("Lỗi kết nối database:", err);
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    console.log("Kết nối database bị mất, đang thử kết nối lại...");
    handleReconnect();
  }
});

function handleReconnect() {
  db.connect((err) => {
    if (err) {
      console.error("Lỗi khi kết nối lại:", err);
      setTimeout(handleReconnect, 2000);
    } else {
      console.log("Đã kết nối lại thành công");
    }
  });
}

// Kết nối ban đầu
db.connect((err) => {
  if (err) {
    console.error("Lỗi kết nối cơ sở dữ liệu:", err.message);
    setTimeout(handleReconnect, 2000);
    return;
  }
  console.log("Đã kết nối cơ sở dữ liệu");
});

const query = util.promisify(db.query).bind(db);

const uploadQR = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Khởi tạo Web3 với Ganache
const web3 = new Web3("http://127.0.0.1:8545");

// Lấy tài khoản đầu tiên từ Ganache
web3.eth
  .getAccounts()
  .then((accounts) => {
    const account = accounts[0];
    web3.eth.defaultAccount = account;
    console.log("Admin address:", account);
  })
  .catch((err) => {
    console.error("Lỗi khi lấy tài khoản từ Ganache:", err);
    process.exit(1);
  });

web3.eth.net
  .isListening()
  .then(async () => {
    console.log("Đã kết nối với Ganache");
    await initializeBlockchainLogger();
  })
  .catch((e) => console.error("Lỗi kết nối với Ganache:", e));

async function initializeBlockchainLogger() {
  try {
    console.log("\n========================================");
    console.log("🚀 BLOCKCHAIN LOGGER");
    console.log("========================================\n");

    const initialized = await blockchainLogger.initialize();
    if (!initialized) {
      console.warn("⚠️ Logger không khả dụng");
      return;
    }

    console.log("📥 Đồng bộ lịch sử...");
    await blockchainLogger.syncHistoricalEvents();

    console.log("👂 Bắt đầu listening...");
    blockchainLogger.startListening();

    const stats = await blockchainLogger.getStats();
    console.log("\n📊 STATS:");
    console.log(`   Blocks: ${stats.total_blocks}`);
    console.log(`   Events: ${stats.total_events}`);

    console.log("\n========================================");
    console.log("✓ LOGGER READY");
    console.log("========================================\n");
  } catch (error) {
    console.error("\n✗ Logger Error:", error.message);
  }
}

// ABI và địa chỉ hợp đồng (cần cập nhật sau khi triển khai trên Ganache)
const traceabilityContractABI =
  require("../build/contracts/TraceabilityContract.json").abi;
const traceabilityContractAddress = process.env.TRACEABILITY_CONTRACT_ADDRESS; // Cần cập nhật sau khi triển khai
const traceabilityContract = new web3.eth.Contract(
  traceabilityContractABI,
  traceabilityContractAddress,
);

const activityLogABI = require("../build/contracts/ActivityLog.json").abi;
const activityLogAddress = process.env.ACTIVITY_LOG_CONTRACT_ADDRESS; // Cần cập nhật sau khi triển khai
const activityLogContract = new web3.eth.Contract(
  activityLogABI,
  activityLogAddress,
);

// Tạo thư mục uploads cho activities
const activityUploadDir = path.join(
  __dirname,
  "public",
  "uploads",
  "activities",
);
if (!fs.existsSync(activityUploadDir)) {
  fs.mkdirSync(activityUploadDir, { recursive: true });
}

// Cấu hình storage cho activities
const activityStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const today = new Date();
    const uploadPath = path.join(
      activityUploadDir,
      today.getFullYear().toString(),
      (today.getMonth() + 1).toString(),
    );

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const activityUpload = multer({
  storage: activityStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
}).array("imageUrls", 5);

const { CID } = require("multiformats/cid");
const { sha256 } = require("multiformats/hashes/sha2");
const { base58btc } = require("multiformats/bases/base58");

//const BUCKET_NAME = "nckh"
const BUCKET_NAME = process.env.BUCKET_NAME; //BUCKET_NAME

//Upload file to local storage (máy cục bộ server) and return public URL
// async function uploadFile(file) {
//   try {
//     let relativePath = path.relative(path.join(__dirname, "public"), file.path);
//     // Chuẩn hóa path: Thay tất cả '\' bằng '/' để phù hợp với URL web
//     relativePath = relativePath.replace(/\\/g, "/");

//     const publicUrl = `/${relativePath}`;
//     console.log(`File uploaded successfully: ${publicUrl}`);
//     return {
//       success: true,
//       ipfsUrl: publicUrl
//     };
//   } catch (error) {
//     console.error("Lỗi khi xử lý file:", error);
//     throw error;
//   }
// }

//Upload file to S3 and return public URL
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function uploadFile(file) {
  try {
    // Tạo tên file duy nhất (dựa trên thời gian và tên gốc)
    const fileName = `uploads/${Date.now()}_${file.originalname}`;

    // Chuẩn bị params cho S3
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: fileName, // Đường dẫn file trên S3
      Body: fs.createReadStream(file.path), // Đọc file từ local (do multer lưu tạm)
      ContentType: file.mimetype, // Loại file (image/jpeg, v.v.)
    };

    // Upload file lên S3
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Tạo URL công khai
    const publicUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    console.log(`File uploaded successfully to S3: ${publicUrl}`);

    // Xóa file tạm trên local (nếu không cần giữ lại)
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return {
      success: true,
      ipfsUrl: publicUrl, // Giữ key "ipfsUrl" để tương thích với code hiện tại
    };
  } catch (error) {
    console.error("Lỗi khi upload file lên S3:", error);
    throw error;
  }
}

function convertBigIntToString(item) {
  if (typeof item === "bigint") {
    return item.toString();
  }
  if (Array.isArray(item)) {
    return item.map(convertBigIntToString);
  }
  if (typeof item === "object" && item !== null) {
    return Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        convertBigIntToString(value),
      ]),
    );
  }
  return item;
}

async function checkFileStatusWithRetry(
  fileName,
  maxRetries = 5,
  retryDelay = 1000,
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: fileName,
      };

      const command = new HeadObjectCommand(params);
      const result = await s3Client.send(command);
      console.log("Thông tin file:", result);
      console.log(`Trạng thái file: Tồn tại`);

      const cid = result.Metadata.cid;
      console.log(`CID từ Filebase: ${cid}`);

      const ipfsUrl = `https://ipfs.filebase.io/ipfs/${cid}`;
      console.log(`IPFS URL: ${ipfsUrl}`);

      return { cid, ipfsUrl };
    } catch (error) {
      if (error.name !== "NotFound") {
        console.error("Lỗi khi kiểm tra trạng thái:", error);
        throw error;
      }
      if (i < maxRetries - 1) {
        console.log(`File chưa sẵn sàng, thử lại sau ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.log(`Trạng thái file: Không tồn tại sau ${maxRetries} lần thử`);
        throw new Error("File không tồn tại sau nhiều lần thử");
      }
    }
  }
}

async function processFiles(files) {
  const processedFiles = {};

  if (
    !files.productImages ||
    !Array.isArray(files.productImages) ||
    files.productImages.length === 0
  ) {
    throw new Error("Thiếu ảnh lô hàng");
  }

  processedFiles.productImages = [];
  for (const file of files.productImages) {
    const result = await uploadFile(file);
    processedFiles.productImages.push(result.ipfsUrl);
    console.log(`Đã xử lý ảnh sản phẩm: ${result.ipfsUrl}`);
  }

  if (files.certificateImage && files.certificateImage[0]) {
    const certificateFile = files.certificateImage[0];
    const result = await uploadFile(certificateFile);
    processedFiles.certificateImage = result.ipfsUrl;
    console.log(`Đã xử lý ảnh chứng nhận: ${result.ipfsUrl}`);
  } else {
    processedFiles.certificateImage = "default_certificate_image_url";
  }

  return processedFiles;
}

function replacer(key, value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
}

function cleanKeys(obj) {
  const cleanedObj = {};
  for (const key in obj) {
    const cleanKey = key.trim();
    cleanedObj[cleanKey] = obj[key];
  }
  return cleanedObj;
}

app.use(express.urlencoded({ extended: true }));

async function checkUserExists(userId) {
  try {
    const rows = await query("SELECT * FROM users WHERE uid = ?", [userId]);
    return rows.length > 0;
  } catch (error) {
    console.error("Lỗi khi kiểm tra người dùng:", error);
    throw new Error(
      "Không thể kiểm tra thông tin người dùng: " + error.message,
    );
  }
}

async function testDatabaseConnection() {
  try {
    await query("SELECT 1");
    console.log("Kết nối database thành công");
  } catch (error) {
    console.error("Lỗi kết nối database:", error);
    throw error;
  }
}

testDatabaseConnection();

async function checkProductExists(productId) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM products WHERE product_id = ?",
      [productId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results.length > 0);
      },
    );
  });
}

async function getProducerById(producerId) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT name, address, phone FROM users WHERE uid = ?",
      [producerId],
      (err, results) => {
        if (err) {
          console.error("Lỗi truy vấn cơ sở dữ liệu:", err);
          return reject(err);
        }
        if (results.length === 0) {
          return resolve({
            name: "Không xác định",
            address: "Không xác định",
            phone: "Không xác định",
          });
        }
        resolve(results[0]);
      },
    );
  });
}

function cleanupUploadedFiles(files) {
  if (!files) return;

  if (Array.isArray(files)) {
    files.forEach((file) => {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
  } else if (typeof files === "object") {
    Object.values(files).forEach((fileArray) => {
      if (Array.isArray(fileArray)) {
        fileArray.forEach((file) => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
    });
  }
}

/**
 * Tạo mã QR Code cho cây
 * @param {number} treeId - ID của cây từ blockchain
 * @returns {string} - QR Code string theo format DURIAN-{tree_id}-{YYYYMMDD}
 */
function generateTreeQRCode(treeId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const dateString = `${year}${month}${day}`;
  const qrCode = `DURIAN-${treeId}-${dateString}`;

  return qrCode;
}

/**
 * Tạo file QR Code image
 * @param {string} qrCodeText - Text để tạo QR
 * @param {number} treeId - ID của cây (để đặt tên file)
 * @returns {Promise<string>} - Path của file QR image
 */
async function generateQRCodeImage(qrCodeText, treeId) {
  try {
    // Tạo thư mục lưu QR codes nếu chưa có
    const qrDir = path.join(__dirname, "public", "uploads", "qrcodes", "trees");
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // Tạo tên file
    const fileName = `tree-${treeId}-${Date.now()}.png`;
    const filePath = path.join(qrDir, fileName);

    // Generate QR code image
    await QRCode.toFile(filePath, qrCodeText, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Return relative URL
    const relativeUrl = `/uploads/qrcodes/trees/${fileName}`;
    return relativeUrl;
  } catch (error) {
    console.error("Error generating QR code image:", error);
    throw error;
  }
}

/**
 * Upload QR Code image to S3 (nếu dùng S3)
 */
async function uploadQRCodeToS3(localFilePath, treeId) {
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const fileName = `qrcodes/trees/tree-${treeId}-${Date.now()}.png`;

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: fileName,
    Body: fs.createReadStream(localFilePath),
    ContentType: "image/png",
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);

  // Xóa file local sau khi upload
  if (fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
  }

  const publicUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  return publicUrl;
}

// Export hàm setupRoutes để sử dụng trong file chính
function setupRoutes(app, db) {
  app.use(async (req, res, next) => {
    try {
      const connection = await db.getConnection();
      connection.release();
      next();
    } catch (err) {
      console.error("Database connection error:", err);
      res.status(500).json({ error: "Lỗi kết nối database" });
    }
  });

  // app.get("/api/inspector-notifications", async (req, res) => {
  //   try {
  //     const userId = req.session.userId;
  //     const [notifications] = await db.query(
  //       `SELECT
  //         n.id AS notification_id,
  //         b.batch_name,
  //         b.created_on,
  //         u.name AS producer_name,
  //         'batch_upload' AS notification_type
  //       FROM notification n
  //       JOIN notification_object no ON n.notification_object_id = no.id
  //       JOIN batch b ON no.entity_id = b.id
  //       JOIN users u ON b.actor_id = u.uid
  //       WHERE n.user_id = ? AND n.recipient_type = 'user'
  //       ORDER BY b.created_on DESC`,
  //       [userId]
  //     );

  //     res.json(notifications);
  //   } catch (error) {
  //     console.error("Lỗi khi lấy thông báo:", error);
  //     res.status(500).json({ error: "Lỗi server khi lấy thông báo" });
  //   }
  // });

  // app.get("/api/producer-notifications", async (req, res) => {
  //   try {
  //     const userId = req.session.userId;
  //     const [notifications] = await db.query(
  //       `SELECT
  //         n.id AS notification_id,
  //         n.status as status,
  //         b.batch_name,
  //         b.approved_on,
  //         u.name AS inspector_name,
  //         'batch_approval' AS notification_type
  //       FROM notification n
  //       JOIN notification_object no ON n.notification_object_id = no.id
  //       JOIN batch b ON no.entity_id = b.id
  //       JOIN users u ON b.approved_by = u.uid
  //       WHERE n.user_id = ? AND n.recipient_type = 'user'
  //       ORDER BY b.approved_on DESC`,
  //       [userId]
  //     );

  //     res.json(notifications);
  //   } catch (error) {
  //     console.error("Lỗi khi lấy thông báo:", error);
  //     res.status(500).json({ error: "Lỗi server khi lấy thông báo" });
  //   }
  // });

  // app.post("/api/verify-batch", async (req, res) => {
  //   try {
  //     const { sscc } = req.body;

  //     console.log("=== Bắt đầu xác thực batch ===");
  //     console.log("SSCC nhận được:", sscc);

  //     if (!sscc) {
  //       return res.status(400).json({
  //         success: false,
  //         error: "Thiếu SSCC",
  //       });
  //     }

  //     // Lấy thông tin batch từ blockchain
  //     const batchInfo = await traceabilityContract.methods
  //       .getBatchBySSCC(sscc)
  //       .call();

  //     // Convert BigInt sang string
  //     const batchInfoConverted = convertBigIntToString(batchInfo);

  //     console.log("Thông tin batch:", {
  //       batchId: batchInfoConverted.batchId,
  //       name: batchInfoConverted.name,
  //       sscc: batchInfoConverted.sscc,
  //       dataHash: batchInfoConverted.dataHash,
  //     });

  //     // Tính hash từ dữ liệu hiện tại
  //     const calculatedHash = web3.utils.soliditySha3(
  //       { type: "string", value: batchInfo.sscc },
  //       { type: "uint256", value: batchInfo.producerId },
  //       { type: "string", value: batchInfo.quantity },
  //       { type: "uint256", value: batchInfo.productionDate },
  //       { type: "string", value: batchInfo.farmPlotNumber },
  //       { type: "uint256", value: batchInfo.productId },
  //       { type: "string", value: batchInfo.name }
  //     );

  //     // QUAN TRỌNG: Chuẩn hóa cả 2 hash trước khi so sánh
  //     const storedHash = (batchInfoConverted.dataHash || "")
  //       .toLowerCase()
  //       .trim();
  //     const computedHash = (calculatedHash || "").toLowerCase().trim();

  //     console.log("=== SO SÁNH HASH ===");
  //     console.log("Hash đã lưu (raw):", batchInfoConverted.dataHash);
  //     console.log("Hash đã lưu (normalized):", storedHash);
  //     console.log("Hash tính toán (raw):", calculatedHash);
  //     console.log("Hash tính toán (normalized):", computedHash);
  //     console.log("Type of stored:", typeof storedHash);
  //     console.log("Type of computed:", typeof computedHash);
  //     console.log("Length stored:", storedHash.length);
  //     console.log("Length computed:", computedHash.length);

  //     // So sánh hash đã chuẩn hóa
  //     const isValid = storedHash === computedHash;

  //     console.log("=== KẾT QUẢ ===");
  //     console.log("Khớp:", isValid ? "✓ CÓ" : "✗ KHÔNG");
  //     console.log("Strict equality (===):", storedHash === computedHash);
  //     console.log("Loose equality (==):", storedHash == computedHash);

  //     // Lấy transaction info
  //     let transactionInfo = null;
  //     try {
  //       const events = await traceabilityContract.getPastEvents(
  //         "BatchCreated",
  //         {
  //           filter: { batchId: batchInfo.batchId },
  //           fromBlock: 0,
  //           toBlock: "latest",
  //         }
  //       );

  //       if (events.length > 0) {
  //         transactionInfo = {
  //           transactionHash: events[0].transactionHash,
  //           blockNumber: events[0].blockNumber.toString(),
  //         };
  //         console.log("Transaction info:", transactionInfo);
  //       }
  //     } catch (eventError) {
  //       console.error("Không thể lấy transaction info:", eventError.message);
  //     }

  //     // Tạo response
  //     const response = {
  //       success: true,
  //       isValid: isValid,
  //       verificationData: {
  //         sscc: batchInfoConverted.sscc,
  //         storedHash: storedHash,
  //         calculatedHash: computedHash,
  //         batchId: batchInfoConverted.batchId,
  //         verifiedAt: new Date().toISOString(),
  //         blockchainStatus: isValid ? "VERIFIED" : "TAMPERED",
  //         transactionInfo: transactionInfo,
  //         batchDetails: {
  //           name: batchInfoConverted.name,
  //           producerId: batchInfoConverted.producerId,
  //           quantity: batchInfoConverted.quantity,
  //           productionDate: new Date(
  //             Number(batchInfoConverted.productionDate) * 1000
  //           ).toISOString(),
  //           farmPlotNumber: batchInfoConverted.farmPlotNumber,
  //           productId: batchInfoConverted.productId,
  //         },
  //       },
  //     };

  //     console.log("=== Response isValid ===:", response.isValid);
  //     console.log("=== Xác thực hoàn tất ===");

  //     res.json(response);
  //   } catch (error) {
  //     console.error("=== LỖI XÁC THỰC ===");
  //     console.error(error);

  //     res.status(500).json({
  //       success: false,
  //       error: "Không thể xác thực dữ liệu: " + error.message,
  //     });
  //   }
  // });

  // app.get("/api/check-session", (req, res) => {
  //   if (req.session.userId) {
  //     res.json({ loggedIn: true, userId: req.session.userId });
  //   } else {
  //     res.json({ loggedIn: false });
  //   }
  // });

  // Lấy danh sách người dùng cho trang chủ
  app.get("/api/users-home", async (req, res) => {
    try {
      const [users] = await db.query(`
          SELECT u.uid, u.name, u.avatar, r.role_name, rg.region_name
          FROM users u
          JOIN roles r ON u.role_id = r.role_id
          LEFT JOIN regions rg ON u.region_id = rg.region_id
      `);
      res.status(200).json(users);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách người dùng:", error);
      res.status(500).json({
        error: "Không thể lấy danh sách người dùng: " + error.message,
      });
    }
  });

  // Lấy danh sách sản phẩm cho trang chủ
  app.get("/api/products-home", async (req, res) => {
    try {
      const [products] = await db.query(
        "SELECT product_id, product_name, img FROM products",
      );
      res.status(200).json(products);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách sản phẩm:", error);
      res
        .status(500)
        .json({ error: "Không thể lấy danh sách sản phẩm: " + error.message });
    }
  });

  // Lấy thông tin chi tiết người dùng
  app.get("/api/user/:uid", async (req, res) => {
    try {
      const userId = req.params.uid;
      const [user] = await db.query(
        `
          SELECT u.uid, u.name, u.phone, u.address, u.avatar, rg.region_name
          FROM users u
          LEFT JOIN regions rg ON u.region_id = rg.region_id
          WHERE u.uid = ?
      `,
        [userId],
      );

      if (user.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy người dùng" });
      }

      res.status(200).json(user[0]);
    } catch (error) {
      console.error("Lỗi khi lấy thông tin chi tiết người dùng:", error);
      res.status(500).json({
        error: "Không thể lấy thông tin chi tiết người dùng: " + error.message,
      });
    }
  });

  // Lấy thông tin chi tiết sản phẩm
  app.get("/api/product/:productId", async (req, res) => {
    try {
      const productId = req.params.productId;
      const [results] = await db.query(
        "SELECT product_id, product_name, description, price, img, uses, process FROM products WHERE product_id = ?",
        [productId],
      );

      if (results.length > 0) {
        res.status(200).json(results[0]);
      } else {
        res.status(404).json({ error: "Không tìm thấy sản phẩm" });
      }
    } catch (error) {
      console.error("Lỗi khi lấy thông tin sản phẩm:", error);
      res
        .status(500)
        .json({ error: "Không thể lấy thông tin sản phẩm: " + error.message });
    }
  });

  app.get("/api/config", (req, res) => {
    const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    res.json({ baseUrl });
  });

  // Lấy nhật ký hoạt động của người sản xuất theo producerId
  app.get("/api/activity-logs/:uid", async (req, res) => {
    try {
      const producerId = req.params.uid;
      console.log(
        "Đang truy xuất nhật ký hoạt động của người sản xuất cho producerId:",
        producerId,
      );

      const producerActivityLogs = await traceabilityContract.methods
        .getProducerActivityLogsByProducerId(producerId)
        .call();
      console.log(
        "Số lượng nhật ký hoạt động của người sản xuất:",
        producerActivityLogs.length,
      );

      const convertedLogs = convertBigIntToString(producerActivityLogs);
      const formattedLogs = await Promise.all(
        convertedLogs.map(async (log) => {
          const relatedProducts = await getRelatedProducts(
            log.relatedProductIds,
          );
          return {
            timestamp: new Date(Number(log.timestamp) * 1000).toISOString(),
            uid: log.uid,
            activityName: log.activityName,
            description: log.description,
            isSystemGenerated: log.isSystemGenerated,
            imageUrls: log.imageUrls || [],
            relatedProducts: relatedProducts.map((product) => ({
              product_id: product.product_id,
              product_name: product.product_name,
              image_url: product.image_url,
            })),
          };
        }),
      );

      res.status(200).json({
        message: "Truy xuất nhật ký hoạt động của người sản xuất thành công",
        activityLogs: formattedLogs,
      });
    } catch (error) {
      console.error(
        "Lỗi khi truy xuất nhật ký hoạt động của người sản xuất:",
        error,
      );
      res.status(500).json({
        error:
          "Lỗi khi truy xuất nhật ký hoạt động của người sản xuất: " +
          error.message,
      });
    }
  });

  // Thêm route để serve static files
  app.use(
    "/uploads",
    express.static(path.join(__dirname, "public", "uploads")),
  );

  // ==========================================
  // BLOCKCHAIN LOGGER APIs
  // ==========================================

  app.get("/api/blockchain/stats", async (req, res) => {
    try {
      const stats = await blockchainLogger.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/blockchain/block/:blockNumber", async (req, res) => {
    try {
      const blockNumber = parseInt(req.params.blockNumber);
      if (isNaN(blockNumber)) {
        return res.status(400).json({ error: "Invalid block number" });
      }
      const blockInfo = await blockchainLogger.getBlockInfo(blockNumber);
      if (!blockInfo) {
        return res.status(404).json({ error: "Block not found" });
      }
      res.json({ success: true, data: blockInfo });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/blockchain/batch/:batchId/events", async (req, res) => {
    try {
      const batchId = req.params.batchId;

      // ✅ Kiểm tra blockchainLogger đã sẵn sàng
      if (
        !blockchainLogger ||
        typeof blockchainLogger.getEventsByBatch !== "function"
      ) {
        return res.json({
          success: true,
          count: 0,
          data: [],
          message: "BlockchainLogger chưa sẵn sàng",
        });
      }

      const events = await blockchainLogger.getEventsByBatch(batchId);
      res.json({ success: true, count: events.length, data: events });
    } catch (error) {
      console.error("Error getting batch events:", error);
      // ✅ Trả về empty array thay vì error 500
      res.json({
        success: true,
        count: 0,
        data: [],
        message: error.message,
      });
    }
  });

  app.get("/api/blockchain/events/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const events = await blockchainLogger.getRecentEvents(limit);
      res.json({ success: true, count: events.length, data: events });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/blockchain/batch/:batchId/timeline", async (req, res) => {
    try {
      const batchId = req.params.batchId;
      const events = await blockchainLogger.getEventsByBatch(batchId);

      const timeline = events.map((e) => ({
        timestamp: e.timestamp_iso,
        event_type: e.event_name,
        title: getEventTitle(e.event_name),
        block_number: e.block_number,
        transaction_hash: e.transaction_hash,
        data: e.event_data,
      }));

      res.json({ success: true, batch_id: batchId, timeline });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  function getEventTitle(eventName) {
    const titles = {
      BatchCreated: "Lô hàng được tạo",
      BatchApproved: "Lô hàng được phê duyệt",
      BatchRejected: "Lô hàng bị từ chối",
      TransportStatusUpdated: "Cập nhật vận chuyển",
      WarehouseConfirmed: "Kho xác nhận",
      ActivityLogAdded: "Thêm nhật ký",
    };
    return titles[eventName] || eventName;
  }

  // ==========================================
  // LUỒNG ĐÚNG THEO QĐ 5272:
  // 1. FARMER: Trồng cây + Chăm sóc + Tạo lô hàng
  // 2. INSPECTOR: Phê duyệt/Từ chối lô hàng
  // 3. PURCHASER: Thu mua
  // 4. TRANSPORTER: Vận chuyển lần 1 (nông trại → cơ sở sơ chế)
  // 5. PROCESSOR: Sơ chế + Đóng gói sản phẩm
  // 6. QUALITY_INSPECTOR: Kiểm nghiệm
  // 7. TRANSPORTER: Vận chuyển lần 2 (cơ sở sơ chế → kho)
  // 8. WAREHOUSE: Xác nhận nhận hàng
  // 9. DISTRIBUTOR: Phân phối + Bán hàng
  // ==========================================

  // ==========================================
  // BƯỚC 1: FARMER - NÔNG DÂN
  // ==========================================

  /**
   * POST /api/farmer/register-tree
   * Đăng ký cây trồng mới
   * Role: Farmer (role_id = 1)
   */
  app.post(
    "/api/farmer/register-tree",
    requireAuth,
    requireRole(ROLES.FARMER),
    async (req, res) => {
      let connection;
      try {
        const farmerId = req.session.userId;
        const { regionId, treeType, variety, coordinates } = req.body;

        // Validate required fields
        if (!regionId || !treeType || !variety || !coordinates) {
          return res.status(400).json({
            error: "Thiếu thông tin bắt buộc",
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        if (!(await checkUserExists(farmerId))) {
          await connection.rollback();
          return res.status(404).json({ error: "Không tìm thấy nông dân" });
        }

        // ✅ STEP 1: Register tree on blockchain (WITHOUT QR code)
        const tempQRCode = `TEMP-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const result = await activityLogContract.methods
          .registerTree(
            tempQRCode,
            BigInt(farmerId),
            BigInt(regionId),
            treeType,
            variety,
            coordinates,
          )
          .send({ from: web3.eth.defaultAccount, gas: 3000000 });

        let treeId = null;
        let plantedDate = null;
        if (result.events?.TreeRegistered) {
          const event = result.events.TreeRegistered.returnValues;
          treeId = event.treeId.toString();
          plantedDate = event.plantedDate.toString();
        }

        if (!treeId) {
          await connection.rollback();
          return res
            .status(500)
            .json({ error: "Không thể lấy treeId từ blockchain" });
        }

        // ✅ STEP 2: Generate QR Code
        const treeQRCode = generateTreeQRCode(treeId);
        console.log(`✅ Generated QR Code: ${treeQRCode}`);

        // ✅ STEP 3: Generate QR Code Image
        const qrImagePath = await generateQRCodeImage(treeQRCode, treeId);
        console.log(`✅ QR Image saved at: ${qrImagePath}`);

        // Use local storage URL
        const qrImageUrl = qrImagePath;

        // ✅ STEP 4: Insert into database with generated QR code
        await connection.query(
          `INSERT INTO trees 
       (tree_id, tree_qr_code, farmer_id, region_id, tree_type, variety, 
        planted_date, planted_date_iso, coordinates, qr_image_url, blockchain_tx_hash) 
       VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?, ?, ?)`,
          [
            treeId,
            treeQRCode,
            farmerId,
            regionId,
            treeType,
            variety,
            plantedDate,
            plantedDate,
            coordinates,
            qrImageUrl,
            result.transactionHash,
          ],
        );

        await connection.commit();

        // ✅ STEP 5: Log the data we're sending
        console.log("✅ Register tree success:", {
          treeId,
          treeQRCode,
          qrImageUrl,
        });

        // ✅ STEP 6: Send clear response
        res.json({
          success: true,
          message: "Đăng ký cây trồng thành công",
          data: {
            treeId: treeId,
            treeQRCode: treeQRCode,
            qrImageUrl: qrImageUrl,
            plantedDate: new Date(Number(plantedDate) * 1000).toISOString(),
            transactionHash: result.transactionHash,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Lỗi khi đăng ký cây:", error);
        res.status(500).json({
          error: "Không thể đăng ký cây: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * POST /api/farmer/add-tree-care
   * Ghi nhật ký chăm sóc cây
   * Role: Farmer
   */
  app.post(
    "/api/farmer/add-tree-care",
    requireAuth,
    requireRole(ROLES.FARMER),
    activityUpload,
    async (req, res) => {
      let connection;
      try {
        const farmerId = req.session.userId;

        // Parse treeIds từ JSON string (vì FormData gửi dưới dạng string)
        let treeIds;
        try {
          treeIds = JSON.parse(req.body.treeIds || "[]");
        } catch (e) {
          // Nếu không phải JSON, có thể là array từ FormData
          treeIds = Array.isArray(req.body.treeIds)
            ? req.body.treeIds
            : [req.body.treeIds];
        }

        const {
          category,
          activityName,
          description,
          fertilizer,
          pesticide,
          quantity,
          unit,
          temperature,
          humidity,
          weather,
          healthStatus,
          notes,
        } = req.body;

        console.log("Received treeIds:", treeIds, "Type:", typeof treeIds);
        console.log("Category:", category, "Activity:", activityName);

        // Validate
        if (
          !treeIds ||
          !Array.isArray(treeIds) ||
          treeIds.length === 0 ||
          category === undefined ||
          !activityName
        ) {
          return res.status(400).json({
            error:
              "Thiếu thông tin bắt buộc: treeIds (mảng), category, activityName",
            debug: {
              treeIds: treeIds,
              treeIdsType: typeof treeIds,
              treeIdsIsArray: Array.isArray(treeIds),
              category: category,
              activityName: activityName,
            },
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Kiểm tra tất cả cây thuộc farmer
        const placeholders = treeIds.map(() => "?").join(",");
        const [trees] = await connection.query(
          `SELECT tree_id FROM trees WHERE tree_id IN (${placeholders}) AND farmer_id = ?`,
          [...treeIds, farmerId],
        );

        if (trees.length !== treeIds.length) {
          await connection.rollback();
          return res.status(404).json({
            error: "Một hoặc nhiều cây không tồn tại hoặc không thuộc về bạn",
          });
        }

        // Upload ảnh (chung cho tất cả cây)
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const result = await uploadFile(file);
            imageUrls.push(result.ipfsUrl);
          }
        }

        const transactionHashes = [];
        const logIds = [];

        // Loop qua từng cây → gọi contract riêng (vì contract chỉ hỗ trợ 1 cây/lần)
        for (const treeId of treeIds) {
          const result = await activityLogContract.methods
            .addTreeCareActivity(
              BigInt(treeId),
              BigInt(farmerId),
              parseInt(category),
              activityName,
              description || "",
            )
            .send({ from: web3.eth.defaultAccount, gas: 3000000 });

          let logId = null;
          if (result.events?.TreeActivityRecorded) {
            logId =
              result.events.TreeActivityRecorded.returnValues.logId.toString();
          }
          if (!logId) throw new Error(`Không lấy được logId cho cây ${treeId}`);

          logIds.push(logId);
          transactionHashes.push(result.transactionHash);

          // Nếu có metadata → thêm cho log này
          if (
            fertilizer ||
            pesticide ||
            quantity ||
            temperature ||
            humidity ||
            weather ||
            healthStatus ||
            notes ||
            imageUrls.length > 0
          ) {
            await activityLogContract.methods
              .addTreeActivityMetadata(
                BigInt(logId),
                imageUrls,
                fertilizer || "",
                pesticide || "",
                quantity
                  ? BigInt(Math.round(parseFloat(quantity) * 1000))
                  : BigInt(0),
                unit || "",
                temperature ? parseInt(temperature) : 0,
                humidity ? parseInt(humidity) : 0,
                weather || "",
                healthStatus || "",
                notes || "",
              )
              .send({ from: web3.eth.defaultAccount, gas: 2000000 });
          }
        }

        await connection.commit();

        const categoryNames = [
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

        res.json({
          success: true,
          message: `Đã ghi nhật ký chăm sóc cho ${treeIds.length} cây thành công`,
          data: {
            treeIds,
            logIds,
            category: categoryNames[parseInt(category)],
            imageUrls,
            transactionHashes,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        cleanupUploadedFiles(req.files);
        console.error("Lỗi khi ghi nhật ký chăm sóc nhiều cây:", error);
        res.status(500).json({
          error: "Không thể ghi nhật ký: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * GET /api/farmer/trees/:treeId/activities
   * Lấy lịch sử hoạt động của 1 cây xác định
   * Role: Farmer
   */
  app.get(
    "/api/farmer/trees/:treeId/activities",
    requireAuth,
    requireRole(ROLES.FARMER),
    async (req, res) => {
      try {
        const farmerId = req.session.userId;
        if (!farmerId) {
          return res.status(401).json({
            success: false,
            error: "Unauthorized: Hãy đăng nhập với vai trò nông dân",
          });
        }

        const treeId = req.params.treeId;

        // Kiểm tra tree thuộc farmer hiện tại
        const trees = await query(
          `SELECT * FROM trees WHERE tree_id = ? AND farmer_id = ?`,
          [treeId, farmerId],
        );

        if (trees.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Không tìm thấy cây hoặc không có quyền truy cập",
          });
        }

        // Lấy activities
        const activities = await query(
          `
        SELECT 
          tal.*,
          u.name as participant_name,
          u.phone as participant_phone
        FROM tree_activity_logs tal
        LEFT JOIN users u ON tal.participant_id = u.uid
        WHERE tal.tree_id = ?
        ORDER BY tal.timestamp_iso DESC
        `,
          [treeId],
        );

        // Lấy images cho mỗi activity
        const activitiesWithImages = await Promise.all(
          activities.map(async (act) => {
            const images = await query(
              `SELECT image_url FROM tree_activity_images WHERE log_id = ?`,
              [act.log_id],
            );

            return {
              ...act,
              images: images.map((img) => img.image_url),
            };
          }),
        );

        res.json({
          success: true,
          data: activitiesWithImages.map((act) => ({
            logId: act.log_id,
            timestamp: act.timestamp_iso,
            category: act.category,
            activityName: act.activity_name,
            description: act.description,
            participant: {
              name: act.participant_name,
              phone: act.participant_phone,
            },
            isSystemActivity: act.is_system_activity,
            fertilizer: act.fertilizer,
            pesticide: act.pesticide,
            quantity: act.quantity,
            unit: act.unit,
            temperature: act.temperature,
            humidity: act.humidity,
            weather: act.weather,
            healthStatus: act.health_status,
            notes: act.notes,
            images: act.images,
          })),
        });
      } catch (error) {
        console.error("Lỗi khi lấy activities của cây:", error);
        res.status(500).json({
          success: false,
          error: "Không thể lấy lịch sử hoạt động: " + error.message,
        });
      }
    },
  );

  /**
   * POST /api/farmer/create-batch
   * Tạo lô hàng sau khi thu hoạch
   * Role: Farmer
   */
  app.post(
    "/api/farmer/create-batch",
    requireAuth,
    requireRole(ROLES.FARMER),
    upload,
    async (req, res) => {
      let connection;
      try {
        const producerId = req.session.userId;

        let treeIds;
        try {
          treeIds = JSON.parse(req.body.treeIds || "[]");
        } catch (e) {
          treeIds = Array.isArray(req.body.treeIds)
            ? req.body.treeIds
            : [req.body.treeIds];
        }

        const {
          name,
          quantity,
          farmPlotNumber, // ✅ LẤY TỪ REQUEST
          productId,
          startDate,
          endDate,
          harvestNotes = "",
        } = req.body;

        // ✅ VALIDATE farmPlotNumber
        if (
          !name ||
          !quantity ||
          !farmPlotNumber || // ✅ THÊM VALIDATION
          !productId ||
          !startDate ||
          !endDate ||
          !treeIds ||
          !Array.isArray(treeIds) ||
          treeIds.length === 0
        ) {
          return res.status(400).json({
            error:
              "Thiếu thông tin bắt buộc, bao gồm farmPlotNumber và mảng treeIds",
          });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
          return res.status(400).json({ error: "Ngày không hợp lệ" });
        }

        const startTimestamp = Math.floor(start.getTime() / 1000);
        const endTimestamp = Math.floor(end.getTime() / 1000);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [user] = await connection.query(
          "SELECT uid FROM users WHERE uid = ? AND role_id = 1",
          [producerId],
        );
        if (user.length === 0) {
          await connection.rollback();
          return res.status(404).json({ error: "Không tìm thấy nông dân" });
        }

        const [prod] = await connection.query(
          "SELECT product_id FROM products WHERE product_id = ?",
          [productId],
        );
        if (prod.length === 0) {
          await connection.rollback();
          return res.status(400).json({ error: "Sản phẩm không tồn tại" });
        }

        // Kiểm tra tất cả cây thuộc farmer và đang active
        const placeholders = treeIds.map(() => "?").join(",");
        const [trees] = await connection.query(
          `SELECT tree_id FROM trees WHERE tree_id IN (${placeholders}) AND farmer_id = ? AND is_active = TRUE`,
          [...treeIds, producerId],
        );
        if (trees.length !== treeIds.length) {
          await connection.rollback();
          return res.status(400).json({
            error:
              "Một hoặc nhiều cây không tồn tại, không thuộc bạn hoặc không active",
          });
        }

        if (
          !req.files ||
          !req.files.productImages ||
          req.files.productImages.length === 0
        ) {
          await connection.rollback();
          return res.status(400).json({ error: "Thiếu ảnh sản phẩm" });
        }

        const productImages = req.files["productImages"] || [];
        const certificateImage = req.files["certificateImage"] || [];
        let productImageUrls = [];
        let certificateImageUrl = null;

        for (const file of productImages) {
          const result = await uploadFile(file);
          productImageUrls.push(result.ipfsUrl);
        }

        if (certificateImage[0]) {
          const result = await uploadFile(certificateImage[0]);
          certificateImageUrl = result.ipfsUrl;
        }

        // Gọi contract với 6 tham số
        const result = await traceabilityContract.methods
          .createBatch(
            name,
            BigInt(producerId),
            quantity,
            BigInt(productId),
            BigInt(startTimestamp),
            BigInt(endTimestamp),
          )
          .send({ from: web3.eth.defaultAccount, gas: 5000000 });

        let batchId = null;
        let sscc = null;
        let dataHash = null;
        if (result.events?.BatchCreated?.returnValues) {
          batchId = result.events.BatchCreated.returnValues.batchId.toString();
          sscc = result.events.BatchCreated.returnValues.sscc;
          dataHash = result.events.BatchCreated.returnValues.dataHash;
        }

        if (!batchId) {
          await connection.rollback();
          return res.status(500).json({ error: "Không lấy được batchId" });
        }

        // ✅ LƯU batch với farm_plot_number NGAY TẠI ĐÂY
        await query(
          `INSERT INTO blockchain_batches 
        (batch_id, batch_name, sscc, producer_id, quantity, production_date, production_date_iso, 
         start_date, start_date_iso, end_date, end_date_iso, status, current_stage, 
         product_type_id, farm_plot_number, certificate_image_url, data_hash, blockchain_tx_hash) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PendingApproval', 'Created', ?, ?, ?, ?, ?)`,
          [
            batchId,
            name,
            sscc,
            producerId,
            quantity,
            endTimestamp,
            new Date(endTimestamp * 1000)
              .toISOString()
              .slice(0, 19)
              .replace("T", " "),
            startTimestamp,
            new Date(startTimestamp * 1000)
              .toISOString()
              .slice(0, 19)
              .replace("T", " "),
            endTimestamp,
            new Date(endTimestamp * 1000)
              .toISOString()
              .slice(0, 19)
              .replace("T", " "),
            productId,
            farmPlotNumber, // ✅ LƯU farmPlotNumber TẠI ĐÂY
            certificateImageUrl,
            dataHash,
            result.transactionHash,
          ],
        );

        // Lưu ảnh sản phẩm vào batch_product_images
        for (let i = 0; i < productImageUrls.length; i++) {
          await query(
            "INSERT INTO batch_product_images (batch_id, image_url, image_order) VALUES (?, ?, ?)",
            [batchId, productImageUrls[i], i + 1],
          );
        }

        // Liên kết từng cây với lô hàng
        const linkResults = [];
        for (const treeId of treeIds) {
          const linkResult = await activityLogContract.methods
            .linkTreeToBatch(
              BigInt(treeId),
              BigInt(batchId),
              BigInt(producerId),
              harvestNotes,
            )
            .send({ from: web3.eth.defaultAccount, gas: 2000000 });

          linkResults.push({
            treeId,
            transactionHash: linkResult.transactionHash,
          });
        }

        // Đợi blockchain logger sync
        await new Promise((resolve) => setTimeout(resolve, 5000));

        await connection.commit();

        res.json({
          success: true,
          message:
            "Tạo lô hàng thành công, đang chờ phê duyệt. Các cây đã được liên kết với lô hàng để theo dõi lịch sử chăm sóc.",
          data: {
            batchId,
            sscc,
            farmPlotNumber, // ✅ TRẢ VỀ farmPlotNumber
            productImages: productImageUrls,
            certificateImage: certificateImageUrl,
            transactionHash: result.transactionHash,
            linkedTrees: linkResults,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        cleanupUploadedFiles(req.files);
        console.error("Lỗi tạo batch:", error);
        res
          .status(500)
          .json({ error: "Không thể tạo lô hàng: " + error.message });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * GET /api/farmer/my-batches
   * Xem danh sách lô hàng của nông dân
   * Role: Farmer
   */
  app.get(
    "/api/farmer/my-batches",
    requireAuth,
    requireRole(ROLES.FARMER),
    async (req, res) => {
      try {
        const farmerId = req.session.userId;
        const { status } = req.query; // 'pending', 'approved', 'rejected', 'all'

        let query = `
        SELECT 
          bb.*,
          p.product_name,
          p.price
        FROM blockchain_batches bb
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE bb.producer_id = ?
      `;

        const params = [farmerId];

        if (status === "pending") {
          query += " AND bb.status = 'PendingApproval'";
        } else if (status === "approved") {
          query += " AND bb.status = 'Approved'";
        } else if (status === "rejected") {
          query += " AND bb.status = 'Rejected'";
        }

        query += " ORDER BY bb.created_at DESC";

        const [batches] = await db.query(query, params);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách lô hàng:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách lô hàng: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/batch/:batchId/images
   * Lấy ảnh sản phẩm của lô hàng
   */
  app.get("/api/batch/:batchId/images", async (req, res) => {
    try {
      const batchId = req.params.batchId;

      console.log("📸 Fetching images for batch:", batchId); // ✅ DEBUG

      const [images] = await db.query(
        `SELECT image_url, image_order 
       FROM batch_product_images 
       WHERE batch_id = ? 
       ORDER BY image_order ASC`,
        [batchId],
      );

      console.log("📸 Found images:", images.length); // ✅ DEBUG

      res.json({
        success: true,
        data: {
          images: images.map((img) => img.image_url),
        },
      });
    } catch (error) {
      console.error("Lỗi khi lấy ảnh lô hàng:", error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy ảnh: " + error.message,
      });
    }
  });

  /**
   * GET /api/farmer/my-trees
   * Xem danh sách cây trồng
   * Role: Farmer
   */
  app.get(
    "/api/farmer/my-trees",
    requireAuth,
    requireRole(ROLES.FARMER),
    async (req, res) => {
      try {
        const farmerId = req.session.userId;

        const [trees] = await db.query(
          `SELECT * FROM trees WHERE farmer_id = ? ORDER BY planted_date_iso DESC`,
          [farmerId],
        );

        res.json({
          success: true,
          count: trees.length,
          data: trees,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách cây:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách cây: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 2: Inspector - PHÊ DUYỆT
  // ==========================================

  /**
   * GET /api/inspector/pending-batches
   * Xem danh sách lô hàng chờ phê duyệt
   * Role: inspector/Inspector (role_id = 2)
   */
  app.get(
    "/api/inspector/pending-batches",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const [batches] = await db.query(`
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.address as farmer_address,
          u.email as farmer_email,
          p.product_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE bb.status = 'PendingApproval'
        ORDER BY bb.created_at DESC
      `);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô chờ phê duyệt:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/inspector/all-batches
   * Lấy TẤT CẢ lô hàng (với filter tùy chọn)
   */
  app.get(
    "/api/inspector/all-batches",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const statusFilter = req.query.status; // 'pending', 'approved', 'rejected'

        let whereClause = "WHERE 1=1";
        const params = [];

        if (statusFilter === "pending") {
          whereClause += " AND bb.status = 'PendingApproval'";
        } else if (statusFilter === "approved") {
          whereClause += " AND bb.status = 'Approved'";
        } else if (statusFilter === "rejected") {
          whereClause += " AND bb.status = 'Rejected'";
        }
        // Nếu không có filter hoặc filter = 'all' thì lấy tất cả

        const [batches] = await db.query(
          `SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.address as farmer_address,
          u.email as farmer_email,
          p.product_name,
          inspector.name as inspector_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN users inspector ON bb.approved_by = inspector.uid
        ${whereClause}
        ORDER BY bb.created_at DESC`,
          params,
        );

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy tất cả batches:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/inspector/approved-batches
   * Lấy danh sách lô đã phê duyệt
   */
  app.get(
    "/api/inspector/approved-batches",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const [batches] = await db.query(`
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.address as farmer_address,
          u.email as farmer_email,
          p.product_name,
          inspector.name as inspector_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN users inspector ON bb.approved_by = inspector.uid
        WHERE bb.status = 'Approved'
        ORDER BY bb.approved_on DESC
      `);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô đã duyệt:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/inspector/rejected-batches
   * Lấy danh sách lô bị từ chối
   */
  app.get(
    "/api/inspector/rejected-batches",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const [batches] = await db.query(`
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.address as farmer_address,
          u.email as farmer_email,
          p.product_name,
          inspector.name as inspector_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN users inspector ON bb.approved_by = inspector.uid
        WHERE bb.status = 'Rejected'
        ORDER BY bb.approved_on DESC
      `);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô bị từ chối:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * POST /api/inspector/approve-batch/:batchId
   * Phê duyệt lô hàng
   * Role: Inspector
   */
  app.post(
    "/api/inspector/approve-batch/:batchId",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      let connection;
      try {
        const inspectorId = req.session.userId;
        const blockchainBatchId = req.params.batchId;

        if (!blockchainBatchId || isNaN(blockchainBatchId)) {
          return res.status(400).json({ error: "Batch ID không hợp lệ" });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Kiểm tra DB
        const [batchRows] = await connection.query(
          "SELECT status FROM blockchain_batches WHERE batch_id = ?",
          [blockchainBatchId],
        );

        if (batchRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({ error: "Không tìm thấy lô hàng" });
        }

        // 2. Kiểm tra blockchain
        console.log("🔍 Checking batch on blockchain...");

        const batchDetails = await traceabilityContract.methods
          .getBatchDetails(BigInt(blockchainBatchId))
          .call();

        const statusMap = ["PendingApproval", "Approved", "Rejected"];
        const blockchainStatus = statusMap[batchDetails.status.toString()];

        // Đồng bộ status
        if (batchRows[0].status !== blockchainStatus) {
          console.log(
            `⚠️ Đồng bộ status: DB=${batchRows[0].status} → Blockchain=${blockchainStatus}`,
          );
          await connection.query(
            "UPDATE blockchain_batches SET status = ? WHERE batch_id = ?",
            [blockchainStatus, blockchainBatchId],
          );
        }

        if (batchDetails.status.toString() !== "0") {
          await connection.rollback();
          return res.status(400).json({
            error: `Batch đã ở trạng thái: ${blockchainStatus}`,
            blockchainStatus,
          });
        }

        // 3. Estimate gas
        await traceabilityContract.methods
          .approveBatch(BigInt(blockchainBatchId), BigInt(inspectorId))
          .estimateGas({ from: web3.eth.defaultAccount });

        // 4. Approve trên blockchain
        const result = await traceabilityContract.methods
          .approveBatch(BigInt(blockchainBatchId), BigInt(inspectorId))
          .send({
            from: web3.eth.defaultAccount,
            gas: 5000000,
          });

        console.log("✅ Approved on blockchain:", result.transactionHash);

        // 5. ⭐ UPDATE DB: Lưu approved_by và approved_on
        await connection.query(
          `UPDATE blockchain_batches 
         SET status = 'Approved', 
             approved_by = ?, 
             approved_on = NOW(),
             blockchain_tx_hash = ?
         WHERE batch_id = ?`,
          [inspectorId, result.transactionHash, blockchainBatchId],
        );

        await connection.commit();

        res.json({
          success: true,
          message: "Lô hàng đã được phê duyệt thành công",
          transactionHash: result.transactionHash,
          approvedBy: inspectorId,
        });
      } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Lỗi phê duyệt:", error);

        let errorMessage = error.message;
        let errorDetails = null;

        if (error.receipt && error.receipt.status === 0n) {
          errorMessage = "Transaction bị revert";
          errorDetails = {
            reason: "Batch không tồn tại hoặc status không hợp lệ",
            transactionHash: error.receipt.transactionHash,
          };
        }

        res.status(500).json({
          error: "Không thể phê duyệt: " + errorMessage,
          details: errorDetails,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * POST /api/inspector/reject-batch/:batchId
   * Từ chối lô hàng
   * Role: Inspector
   */
  app.post(
    "/api/inspector/reject-batch/:batchId",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      let connection;
      try {
        const inspectorId = req.session.userId;
        const blockchainBatchId = req.params.batchId;
        const reason = req.body.reason || req.body.data?.reason || "";

        if (!reason || reason.trim() === "") {
          return res.status(400).json({
            error: "Vui lòng nhập lý do từ chối",
          });
        }

        if (!blockchainBatchId || isNaN(blockchainBatchId)) {
          return res.status(400).json({ error: "Batch ID không hợp lệ" });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [batchRows] = await connection.query(
          "SELECT status FROM blockchain_batches WHERE batch_id = ?",
          [blockchainBatchId],
        );

        if (batchRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({ error: "Không tìm thấy lô hàng" });
        }

        if (batchRows[0].status !== "PendingApproval") {
          await connection.rollback();
          return res.status(400).json({ error: "Lô hàng đã được xử lý" });
        }

        const result = await traceabilityContract.methods
          .rejectBatch(
            BigInt(blockchainBatchId),
            BigInt(inspectorId),
            reason.trim(),
          )
          .send({ from: web3.eth.defaultAccount, gas: 5000000 });

        // ⭐ UPDATE DB: Lưu approved_by, approved_on và rejection_reason
        await connection.query(
          `UPDATE blockchain_batches 
         SET status = 'Rejected', 
             approved_by = ?, 
             approved_on = NOW(),
             rejection_reason = ?,
             blockchain_tx_hash = ?
         WHERE batch_id = ?`,
          [
            inspectorId,
            reason.trim(),
            result.transactionHash,
            blockchainBatchId,
          ],
        );

        await connection.commit();

        res.json({
          success: true,
          message: "Lô hàng đã bị từ chối",
          reason: reason.trim(),
          transactionHash: result.transactionHash,
          rejectedBy: inspectorId,
        });
      } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Lỗi từ chối:", error);
        res.status(500).json({
          error: "Không thể từ chối: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * GET /api/inspector/stats
   * Thống kê tổng quan cho inspector
   */
  app.get(
    "/api/inspector/stats",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const inspectorId = req.session.userId;

        // Đếm tổng số lô
        const [stats] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'PendingApproval' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
        FROM blockchain_batches
      `);

        // ⭐ Đếm số lô inspector này đã duyệt (dùng approved_by)
        const [myStats] = await db.query(
          `SELECT COUNT(*) as my_approvals
         FROM blockchain_batches 
         WHERE approved_by = ? AND status IN ('Approved', 'Rejected')`,
          [inspectorId],
        );

        // Lô mới nhất chờ duyệt
        const [latestPending] = await db.query(
          `SELECT 
          bb.*,
          u.name as farmer_name,
          p.product_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE bb.status = 'PendingApproval'
        ORDER BY bb.created_at DESC
        LIMIT 5`,
        );

        res.json({
          success: true,
          data: {
            total: stats[0].total || 0,
            pending: stats[0].pending || 0,
            approved: stats[0].approved || 0,
            rejected: stats[0].rejected || 0,
            myApprovals: myStats[0].my_approvals || 0,
            latestPending: latestPending,
          },
        });
      } catch (error) {
        console.error("❌ Lỗi stats:", error);
        res.status(500).json({
          error: "Không thể lấy thống kê: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/inspector/batch/:id/full-info
   * Lấy đầy đủ thông tin lô hàng để review
   */
  app.get(
    "/api/inspector/batch/:id/full-info",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const batchId = req.params.id;

        // 1. Lấy thông tin batch từ DB (bao gồm rejection_reason)
        const [batchRows] = await db.query(
          `SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.email as farmer_email,
          u.address as farmer_address,
          p.product_name,
          p.product_id,
          inspector.name as inspector_name,
          bb.rejection_reason,
          bb.approved_on
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN users inspector ON bb.approved_by = inspector.uid
        WHERE bb.batch_id = ?`,
          [batchId],
        );

        if (batchRows.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy lô hàng" });
        }

        const batch = batchRows[0];

        // 2. Lấy ảnh sản phẩm - SỬA: dùng batch_product_images
        let images = [];
        try {
          const [productImages] = await db.query(
            `SELECT image_url 
           FROM batch_product_images 
           WHERE batch_id = ?
           ORDER BY image_order ASC, created_at ASC`,
            [batchId],
          );
          images = productImages.map((img) => img.image_url);
        } catch (error) {
          console.warn("⚠️ Không thể lấy ảnh sản phẩm:", error.message);
          // Không throw error, chỉ log warning
        }

        // 3. Lấy ảnh chứng nhận
        let certificateImage = null;
        if (batch.certificate_image_url) {
          certificateImage = batch.certificate_image_url;
        }

        // 4. Lấy danh sách cây nguồn gốc
        let sourceTrees = [];
        try {
          const [trees] = await db.query(
            `SELECT t.*
           FROM tree_batch_links tbl
           JOIN trees t ON tbl.tree_id = t.tree_id
           WHERE tbl.batch_id = ?`,
            [batchId],
          );
          sourceTrees = trees;
        } catch (error) {
          console.warn("⚠️ Không thể lấy cây nguồn gốc:", error.message);
        }

        // 5. Lấy thông tin từ blockchain
        let blockchainData = null;
        try {
          const batchDetails = await traceabilityContract.methods
            .getBatchDetails(BigInt(batchId))
            .call();

          blockchainData = {
            batchId: batchDetails.batchId.toString(),
            sscc: batchDetails.sscc,
            status: ["PendingApproval", "Approved", "Rejected"][
              batchDetails.status.toString()
            ],
            producerId: batchDetails.producerId.toString(),
            currentStage: Number(batchDetails.currentStage),
            productionDate: new Date(
              Number(batchDetails.productionDate) * 1000,
            ).toISOString(),
          };
        } catch (error) {
          console.warn("⚠️ Không thể lấy dữ liệu blockchain:", error.message);
        }

        res.json({
          success: true,
          data: {
            batch,
            images,
            certificateImage,
            sourceTrees,
            blockchain: blockchainData,
          },
        });
      } catch (error) {
        console.error("❌ Lỗi khi lấy chi tiết batch:", error);
        res.status(500).json({
          error: "Không thể lấy thông tin: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/inspector/my-approvals
   * Lịch sử phê duyệt của inspector hiện tại
   */
  app.get(
    "/api/inspector/my-approvals",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const inspectorId = req.session.userId;
        const status = req.query.status; // 'all', 'approved', 'rejected'

        let whereClause = "WHERE bb.approved_by = ?";
        let params = [inspectorId];

        if (status === "approved") {
          whereClause += " AND bb.status = 'Approved'";
        } else if (status === "rejected") {
          whereClause += " AND bb.status = 'Rejected'";
        } else {
          whereClause += " AND bb.status IN ('Approved', 'Rejected')";
        }

        const [batches] = await db.query(
          `SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          p.product_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        ${whereClause}
        ORDER BY bb.approved_on DESC`,
          params,
        );

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("❌ Lỗi my-approvals:", error);
        res.status(500).json({
          error: "Không thể lấy lịch sử: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/inspector/batch/:id/history
   * Lịch sử thay đổi của batch từ blockchain
   */
  app.get(
    "/api/inspector/batch/:id/history",
    requireAuth,
    requireRole(ROLES.INSPECTOR),
    async (req, res) => {
      try {
        const batchId = req.params.id;

        // Lấy events từ blockchain logger
        const [events] = await db.query(
          `
        SELECT * FROM blockchain_event_log
        WHERE event_name IN ('BatchCreated', 'BatchApproved', 'BatchRejected')
        AND JSON_EXTRACT(event_data, '$.batchId') = ?
        ORDER BY timestamp DESC
      `,
          [batchId],
        );

        res.json({
          success: true,
          data: events,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lịch sử batch:", error);
        res.status(500).json({
          error: "Không thể lấy lịch sử: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 3: PURCHASER - THU MUA
  // ==========================================

  /**
   * GET /api/purchaser/approved-batches
   * Xem danh sách lô đã được phê duyệt, sẵn sàng thu mua
   * Role: Purchaser (role_id = 3)
   */
  app.get(
    "/api/purchaser/approved-batches",
    requireAuth,
    requireRole(ROLES.PURCHASER),
    async (req, res) => {
      try {
        const [batches] = await db.query(`
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.address as farmer_address,
          p.product_name,
          p.price
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE bb.status = 'Approved'
          AND bb.current_stage = 'Created'
          AND bb.purchaser_id = 0
        ORDER BY bb.production_date_iso DESC
      `);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô sẵn sàng thu mua:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * POST /api/purchaser/record-purchase
   * Ghi nhận thu mua
   * Role: Purchaser
   */
  app.post(
    "/api/purchaser/record-purchase",
    requireAuth,
    requireRole(ROLES.PURCHASER),
    upload,
    async (req, res) => {
      let connection;
      try {
        const purchaserId = req.session.userId;
        const { batchId, totalQuantity, pricePerUnit, qualityGrade, notes } =
          req.body;

        if (!batchId || !totalQuantity || !pricePerUnit) {
          return res.status(400).json({
            error: "Thiếu thông tin bắt buộc",
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const batchDetails = await traceabilityContract.methods
          .getBatchDetails(batchId)
          .call();

        if (batchDetails.status.toString() !== "1") {
          await connection.rollback();
          return res.status(400).json({
            error: "Lô hàng chưa được phê duyệt",
          });
        }

        if (batchDetails.currentStage.toString() !== "0") {
          await connection.rollback();
          return res.status(400).json({
            error: "Lô hàng đã qua giai đoạn thu mua",
          });
        }

        // ✅ Lấy farmer_id từ blockchain_batches
        const [batchRows] = await connection.query(
          "SELECT producer_id FROM blockchain_batches WHERE batch_id = ?",
          [batchId],
        );

        if (!batchRows || batchRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            error: "Không tìm thấy thông tin lô hàng",
          });
        }

        const farmerId = batchRows[0].producer_id;

        // Upload images
        const purchaseImages = (req.files && req.files["purchaseImages"]) || [];
        let purchaseImageUrls = [];
        for (const file of purchaseImages) {
          const result = await uploadFile(file);
          purchaseImageUrls.push(result.ipfsUrl);
        }

        // Gọi contract
        const result = await traceabilityContract.methods
          .recordPurchase(
            BigInt(batchId),
            BigInt(purchaserId),
            BigInt(Math.round(totalQuantity * 1000)),
            BigInt(Math.round(pricePerUnit * 1000)),
          )
          .send({ from: web3.eth.defaultAccount, gas: 3000000 });

        // Lấy purchaseId từ event
        let purchaseId = null;
        if (result.events?.PurchaseRecorded) {
          purchaseId = Number(
            result.events.PurchaseRecorded.returnValues.purchaseId,
          );
        }

        if (!purchaseId) {
          await connection.rollback();
          return res.status(500).json({
            error: "Không thể lấy purchaseId từ blockchain",
          });
        }

        // ✅ Lấy timestamp từ blockchain
        const receipt = await web3.eth.getTransactionReceipt(
          result.transactionHash,
        );
        const block = await web3.eth.getBlock(receipt.blockNumber);
        const timestamp = Number(block.timestamp);
        const timestampISO = new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        // ✅ Tính total_price
        const totalPrice = parseFloat(totalQuantity) * parseFloat(pricePerUnit);

        // ✅ INSERT đầy đủ vào purchase_records
        await connection.query(
          `INSERT INTO purchase_records
        (purchase_id, batch_id, purchaser_id, farmer_id, purchase_date, purchase_date_iso,
         total_quantity, price_per_unit, total_price, quality_grade, notes, blockchain_tx_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          total_quantity = VALUES(total_quantity),
          price_per_unit = VALUES(price_per_unit),
          total_price = VALUES(total_price),
          quality_grade = VALUES(quality_grade),
          notes = VALUES(notes)`,
          [
            purchaseId,
            parseInt(batchId),
            parseInt(purchaserId),
            parseInt(farmerId),
            timestamp,
            timestampISO,
            parseFloat(totalQuantity),
            parseFloat(pricePerUnit),
            totalPrice,
            qualityGrade || null,
            notes || null,
            result.transactionHash,
          ],
        );

        // ✅ INSERT ảnh vào purchase_images
        if (purchaseImageUrls.length > 0) {
          const imageValues = purchaseImageUrls.map((url) => [purchaseId, url]);
          await connection.query(
            `INSERT INTO purchase_images (purchase_id, image_url) VALUES ?`,
            [imageValues],
          );
        }

        // Update blockchain_batches
        await connection.query(
          `UPDATE blockchain_batches 
         SET current_stage = 'Purchased', purchaser_id = ? 
         WHERE batch_id = ?`,
          [parseInt(purchaserId), parseInt(batchId)],
        );

        // Gọi addPurchaseDetails (off-chain)
        if (qualityGrade || notes) {
          await traceabilityContract.methods
            .addPurchaseDetails(
              BigInt(purchaseId),
              qualityGrade || "",
              notes || "",
            )
            .send({ from: web3.eth.defaultAccount, gas: 1500000 });
        }

        await connection.commit();

        res.json({
          success: true,
          message: "Ghi nhận thu mua thành công",
          data: {
            purchaseId,
            totalPrice: totalPrice.toFixed(2),
            imageUrls: purchaseImageUrls,
            imageCount: purchaseImageUrls.length,
            transactionHash: result.transactionHash,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        cleanupUploadedFiles(req.files);
        console.error("Lỗi thu mua:", error);
        res.status(500).json({
          error: "Không thể ghi nhận thu mua: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * GET /api/purchaser/my-purchases
   * Xem danh sách các lô đã thu mua
   * Role: Purchaser
   */
  app.get(
    "/api/purchaser/my-purchases",
    requireAuth,
    requireRole(ROLES.PURCHASER),
    async (req, res) => {
      try {
        const purchaserId = req.session.userId;

        const [batches] = await db.query(
          `
        SELECT 
          bb.*,
          pr.total_quantity,
          pr.total_price,
          pr.quality_grade,
          pr.purchase_date_iso,
          u.name as farmer_name,
          p.product_name
        FROM blockchain_batches bb
        INNER JOIN purchase_records pr ON bb.batch_id = pr.batch_id
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE bb.purchaser_id = ?
        ORDER BY pr.purchase_date_iso DESC
      `,
          [purchaserId],
        );

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách thu mua:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/purchaser/stats
   * Thống kê tổng quan cho purchaser
   */
  app.get(
    "/api/purchaser/stats",
    requireAuth,
    requireRole(ROLES.PURCHASER),
    async (req, res) => {
      try {
        const purchaserId = req.session.userId;

        // Đếm tổng số lô đã mua
        const [purchaseStats] = await db.query(
          `
        SELECT 
          COUNT(*) as total_purchases,
          COALESCE(SUM(total_quantity), 0) as total_quantity,
          COALESCE(SUM(total_price), 0) as total_amount
        FROM purchase_records
        WHERE purchaser_id = ?
      `,
          [purchaserId],
        );

        // Số lô đã duyệt (sẵn sàng mua)
        const [availableStats] = await db.query(`
        SELECT COUNT(*) as available_batches
        FROM blockchain_batches
        WHERE status = 'Approved' 
        AND current_stage = 'Created'
      `);

        // Lô mua gần nhất
        const [recentPurchases] = await db.query(
          `
        SELECT 
          pr.*,
          bb.batch_name,
          bb.sscc,
          bb.product_type_id,
          prod.product_name,
          u.name as farmer_name
        FROM purchase_records pr
        LEFT JOIN blockchain_batches bb ON pr.batch_id = bb.batch_id
        LEFT JOIN products prod ON bb.product_type_id = prod.product_id
        LEFT JOIN users u ON bb.producer_id = u.uid
        WHERE pr.purchaser_id = ?
        ORDER BY pr.purchase_date_iso DESC
        LIMIT 5
      `,
          [purchaserId],
        );

        res.json({
          success: true,
          data: {
            totalPurchases: purchaseStats[0].total_purchases || 0,
            totalQuantity: purchaseStats[0].total_quantity || 0,
            totalAmount: purchaseStats[0].total_amount || 0,
            availableBatches: availableStats[0].available_batches || 0,
            recentPurchases: recentPurchases,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy thống kê purchaser:", error);
        res.status(500).json({
          error: "Không thể lấy thống kê: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/purchaser/batch/:id/details
   * Lấy chi tiết lô hàng trước khi mua
   */
  app.get(
    "/api/purchaser/batch/:id/details",
    requireAuth,
    requireRole(ROLES.PURCHASER),
    async (req, res) => {
      try {
        const batchId = req.params.id;

        // 1. Lấy thông tin batch
        const [batchRows] = await db.query(
          `
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.email as farmer_email,
          u.address as farmer_address,
          p.product_name,
          p.product_id,
          inspector.name as inspector_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN users inspector ON bb.approved_by = inspector.uid
        WHERE bb.batch_id = ?
      `,
          [batchId],
        );

        if (batchRows.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Không tìm thấy lô hàng",
          });
        }

        const batch = batchRows[0];

        // Kiểm tra lô có thể mua không
        if (batch.status !== "Approved") {
          return res.status(400).json({
            success: false,
            error: "Lô hàng chưa được phê duyệt, không thể mua",
          });
        }

        if (batch.current_stage !== "Created") {
          return res.status(400).json({
            success: false,
            error: "Lô hàng đã được mua, không thể mua lại",
          });
        }

        // 2. Lấy ảnh sản phẩm từ bảng batch_product_images
        const [images] = await db.query(
          `
        SELECT image_url 
        FROM batch_product_images 
        WHERE batch_id = ?
        ORDER BY image_order ASC, created_at ASC
      `,
          [batchId],
        );

        // 3. Lấy ảnh chứng nhận
        const certificateImage = batch.certificate_image_url || null;

        // 4. Lấy cây nguồn gốc
        const [sourceTrees] = await db.query(
          `
        SELECT 
          t.*
        FROM tree_batch_links tbl
        JOIN trees t ON tbl.tree_id = t.tree_id
        WHERE tbl.batch_id = ?
      `,
          [batchId],
        );

        // 5. Kiểm tra xem đã có ai mua chưa (double check)
        const [existingPurchase] = await db.query(
          `
        SELECT purchase_id, purchaser_id, purchase_date_iso
        FROM purchase_records
        WHERE batch_id = ?
        LIMIT 1
      `,
          [batchId],
        );

        // 6. Lấy thông tin blockchain
        let blockchainData = null;
        try {
          const batchDetails = await traceabilityContract.methods
            .getBatchDetails(BigInt(batchId))
            .call();

          blockchainData = {
            batchId: batchDetails.batchId.toString(),
            name: batchDetails.name,
            sscc: batchDetails.sscc,
            status: ["PendingApproval", "Approved", "Rejected"][
              batchDetails.status.toString()
            ],
            currentStage: Number(batchDetails.currentStage),
            producerId: batchDetails.producerId.toString(),
            productionDate: new Date(
              Number(batchDetails.productionDate) * 1000,
            ).toISOString(),
          };
        } catch (error) {
          console.error("Lỗi lấy dữ liệu blockchain:", error);
        }

        res.json({
          success: true,
          data: {
            batch,
            images: images.map((img) => img.image_url),
            certificateImage,
            sourceTrees,
            blockchain: blockchainData,
            alreadyPurchased: existingPurchase.length > 0,
            purchaseInfo: existingPurchase[0] || null,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy chi tiết batch:", error);
        res.status(500).json({
          success: false,
          error: "Không thể lấy thông tin: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/purchaser/purchase/:id/images
   * Lấy ảnh của lần mua hàng
   */
  app.get(
    "/api/purchaser/purchase/:id/images",
    requireAuth,
    requireRole(ROLES.PURCHASER),
    async (req, res) => {
      try {
        const purchaseId = req.params.id;
        const purchaserId = req.session.userId;

        // Kiểm tra purchase thuộc về purchaser này
        const [purchase] = await db.query(
          `
        SELECT purchase_id, batch_id
        FROM purchases
        WHERE purchase_id = ? AND purchaser_id = ?
      `,
          [purchaseId, purchaserId],
        );

        if (purchase.length === 0) {
          return res.status(404).json({
            error:
              "Không tìm thấy giao dịch mua hàng hoặc bạn không có quyền truy cập",
          });
        }

        // Lấy ảnh
        const [images] = await db.query(
          `
        SELECT image_url, created_at
        FROM purchase_images
        WHERE purchase_id = ?
        ORDER BY created_at ASC
      `,
          [purchaseId],
        );

        res.json({
          success: true,
          data: {
            purchaseId: purchaseId,
            batchId: purchase[0].batch_id,
            images: images.map((img) => img.image_url),
            count: images.length,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy ảnh purchase:", error);
        res.status(500).json({
          error: "Không thể lấy ảnh: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/purchaser/batch/:id/purchase-history
   * Kiểm tra lịch sử mua của batch (nếu có)
   */
  app.get(
    "/api/purchaser/batch/:id/purchase-history",
    requireAuth,
    requireRole(ROLES.PURCHASER),
    async (req, res) => {
      try {
        const batchId = req.params.id;

        const [purchases] = await db.query(
          `
        SELECT 
          p.*,
          u.name as purchaser_name,
          u.phone as purchaser_phone
        FROM purchases p
        LEFT JOIN users u ON p.purchaser_id = u.uid
        WHERE p.batch_id = ?
        ORDER BY p.purchase_date DESC
      `,
          [batchId],
        );

        res.json({
          success: true,
          data: purchases,
          hasPurchase: purchases.length > 0,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lịch sử mua:", error);
        res.status(500).json({
          error: "Không thể lấy lịch sử: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 4: TRANSPORTER - VẬN CHUYỂN LẦN 1
  // (Từ nông trại → cơ sở sơ chế)
  // ==========================================
  /**
   * POST /api/transporter/update-status
   * Cập nhật trạng thái vận chuyển
   * Role: Transporter
   * actionCode: 0=Start, 1=Pause, 2=Resume, 3=Complete
   */
  app.post(
    "/api/transporter/update-status",
    requireAuth,
    requireRole(ROLES.TRANSPORTER),
    async (req, res) => {
      let connection;
      try {
        const transporterId = req.session.userId;
        const {
          batchId,
          actionCode,
          action,
          location,
          participantType,
          temperature,
          humidity,
        } = req.body;

        if (!batchId || actionCode === undefined || !action || !location) {
          return res.status(400).json({
            error: "Thiếu thông tin bắt buộc",
          });
        }

        const actionCodeNum = Number(actionCode);
        const validActionMappings = {
          0: ["Bắt đầu vận chuyển", "Bắt đầu", "Start", "start"],
          1: ["Tạm dừng vận chuyển", "Tạm dừng", "Pause", "pause"],
          2: ["Tiếp tục vận chuyển", "Tiếp tục", "Resume", "resume"],
          3: [
            "Hoàn thành vận chuyển",
            "Hoàn thành",
            "Complete",
            "complete",
            "Delivered",
          ],
        };

        const allowedActions = validActionMappings[actionCodeNum];
        if (!allowedActions || !allowedActions.includes(action)) {
          return res.status(400).json({
            error: `Action "${action}" không khớp với actionCode ${actionCodeNum}`,
            expectedActions: allowedActions,
            receivedAction: action,
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const batchDetails = await traceabilityContract.methods
          .getBatchDetails(batchId)
          .call();

        const validStages = ["1", "5"]; // Purchased hoặc QualityInspected
        if (!validStages.includes(batchDetails.currentStage.toString())) {
          await connection.rollback();
          return res.status(400).json({
            error: "Lô hàng không ở giai đoạn cần vận chuyển",
          });
        }

        const [currentBatch] = await connection.query(
          `SELECT detailed_transport_status FROM blockchain_batches WHERE batch_id = ?`,
          [batchId],
        );

        if (!currentBatch || currentBatch.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            error: "Không tìm thấy lô hàng",
          });
        }

        let currentStatus = currentBatch[0].detailed_transport_status;

        if (currentStatus === null) {
          currentStatus = "NotStarted";
        }

        const validationRules = {
          0: ["NotStarted", "Delivered"],
          1: ["InTransit"],
          2: ["Paused"],
          3: ["InTransit"],
        };

        const allowedStatuses = validationRules[actionCodeNum];
        if (!allowedStatuses || !allowedStatuses.includes(currentStatus)) {
          await connection.rollback();

          const errorMessages = {
            0: "Không thể bắt đầu vận chuyển khi lô hàng đang trong quá trình vận chuyển hoặc tạm dừng",
            1: "Chỉ có thể tạm dừng khi lô hàng đang được vận chuyển",
            2: "Chỉ có thể tiếp tục khi lô hàng đang tạm dừng",
            3: "Chỉ có thể hoàn thành khi lô hàng đang được vận chuyển",
          };

          return res.status(400).json({
            error:
              errorMessages[actionCodeNum] ||
              "Hành động không hợp lệ với trạng thái hiện tại",
            currentStatus: currentStatus,
            requestedAction: actionCodeNum,
          });
        }

        const result = await traceabilityContract.methods
          .updateTransportStatus(
            BigInt(batchId),
            BigInt(transporterId),
            BigInt(actionCode),
            temperature ? BigInt(temperature) : BigInt(0),
            humidity ? BigInt(humidity) : BigInt(0),
          )
          .send({ from: web3.eth.defaultAccount, gas: 3000000 });

        const receipt = await web3.eth.getTransactionReceipt(
          result.transactionHash,
        );
        const block = await web3.eth.getBlock(receipt.blockNumber);
        const timestamp = Number(block.timestamp);
        const timestampISO = new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        await connection.query(
          `INSERT INTO transport_events
        (batch_id, participant_id, timestamp, timestamp_iso, action, location, participant_type, temperature, humidity, blockchain_tx_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parseInt(batchId),
            parseInt(transporterId),
            timestamp,
            timestampISO,
            action || "",
            location || null,
            participantType || "Transporter",
            temperature ? parseInt(temperature) : null,
            humidity ? parseInt(humidity) : null,
            result.transactionHash,
          ],
        );

        let detailedStatus;
        switch (actionCodeNum) {
          case 0:
            detailedStatus = "InTransit";
            break;
          case 1:
            detailedStatus = "Paused";
            break;
          case 2:
            detailedStatus = "InTransit";
            break;
          case 3:
            detailedStatus = "Delivered";
            break;
          default:
            detailedStatus = "NotStarted";
        }

        let transportStatus = "NotTransported";
        if (detailedStatus === "Delivered") {
          transportStatus = "Delivered";
        } else if (detailedStatus !== "NotStarted") {
          transportStatus = "InTransit";
        }

        await connection.query(
          `UPDATE blockchain_batches
        SET detailed_transport_status = ?, transport_status = ?
        WHERE batch_id = ?`,
          [detailedStatus, transportStatus, batchId],
        );

        await connection.commit();

        res.json({
          success: true,
          message: "Cập nhật trạng thái vận chuyển thành công",
          data: {
            action,
            detailedTransportStatus: detailedStatus,
            transportStatus: transportStatus,
            transactionHash: result.transactionHash,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        console.error("Lỗi cập nhật trạng thái vận chuyển:", error);
        res.status(500).json({
          error: "Không thể cập nhật trạng thái: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );
  /**
   * ========================================
   * GET BATCH DETAILS FOR TRANSPORT
   * ========================================
   */
  app.get(
    "/api/transporter/batch/:id/details",
    requireAuth,
    requireRole(ROLES.TRANSPORTER),
    async (req, res) => {
      try {
        const batchId = req.params.id;

        const [batchRows] = await db.query(
          `
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.address as farmer_address,
          prod.product_name,
          pr.total_quantity as purchased_quantity,
          pr.total_price as purchase_price,
          purchaser.name as purchaser_name,
          purchaser.address as purchaser_address
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products prod ON bb.product_type_id = prod.product_id
        LEFT JOIN purchase_records pr ON bb.batch_id = pr.batch_id
        LEFT JOIN users purchaser ON pr.purchaser_id = purchaser.uid
        WHERE bb.batch_id = ?
      `,
          [batchId],
        );

        if (batchRows.length === 0) {
          return res.status(404).json({
            error: "Không tìm thấy lô hàng",
            batchId: batchId,
          });
        }

        const batch = batchRows[0];

        // Kiểm tra stage hợp lệ
        if (
          batch.current_stage !== "Purchased" &&
          batch.current_stage !== "QualityInspected"
        ) {
          return res.status(400).json({
            error: "Lô hàng không ở trạng thái cần vận chuyển",
            currentStage: batch.current_stage,
            validStages: ["Purchased", "QualityInspected"],
          });
        }

        // ✅ Lấy lịch sử vận chuyển - FORMAT THEO GIỜ VIỆT NAM
        const [history] = await db.query(
          `
        SELECT 
          te.*,
          u.name as transporter_name,
          DATE_FORMAT(
            CONVERT_TZ(te.timestamp_iso, '+00:00', '+07:00'),
            '%d/%m/%Y %H:%i:%s'
          ) as timestamp_vn
        FROM transport_events te
        LEFT JOIN users u ON te.participant_id = u.uid
        WHERE te.batch_id = ?
        ORDER BY te.timestamp_iso DESC
      `,
          [batchId],
        );

        // Lấy ảnh sản phẩm
        const [images] = await db.query(
          `
        SELECT image_url 
        FROM batch_product_images 
        WHERE batch_id = ?
        ORDER BY image_order ASC, created_at ASC
      `,
          [batchId],
        );

        res.json({
          success: true,
          data: {
            batch,
            history,
            images: images.map((img) => img.image_url),
            transportPhase:
              batch.current_stage === "Purchased" ? "transport1" : "transport2",
            destination:
              batch.current_stage === "Purchased"
                ? "Nhà máy sản xuất"
                : "Kho bãi",
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy chi tiết batch:", error);
        res.status(500).json({
          error: "Không thể lấy thông tin",
          message: error.message,
        });
      }
    },
  );

  /**
   * GET /api/transporter/my-transports
   * Xem lịch sử vận chuyển của transporter
   * Role: Transporter
   */
  app.get(
    "/api/transporter/my-transports",
    requireAuth,
    requireRole(ROLES.TRANSPORTER),
    async (req, res) => {
      try {
        const transporterId = req.session.userId;

        const [transports] = await db.query(
          `
        SELECT 
          te.*,
          bb.batch_name,
          bb.sscc,
          u.name as farmer_name,
          p.product_name
        FROM transport_events te
        INNER JOIN blockchain_batches bb ON te.batch_id = bb.batch_id
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE te.participant_id = ?
        ORDER BY te.timestamp_iso DESC
      `,
          [transporterId],
        );

        res.json({
          success: true,
          count: transports.length,
          data: transports,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lịch sử vận chuyển:", error);
        res.status(500).json({
          error: "Không thể lấy lịch sử: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/transporter/batch/:batchId/transport-history
   * Xem lịch sử vận chuyển của một lô
   */
  app.get(
    "/api/transporter/batch/:batchId/transport-history",
    requireAuth,
    async (req, res) => {
      try {
        const batchId = req.params.batchId;

        const [events] = await db.query(
          `
        SELECT 
          te.*,
          u.name as participant_name,
          u.phone as participant_phone
        FROM transport_events te
        LEFT JOIN users u ON te.participant_id = u.uid
        WHERE te.batch_id = ?
        ORDER BY te.timestamp_iso ASC
      `,
          [batchId],
        );

        res.json({
          success: true,
          count: events.length,
          data: events,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lịch sử vận chuyển:", error);
        res.status(500).json({
          error: "Không thể lấy lịch sử: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/transporter/batches-to-transport
   * Lấy danh sách lô cần vận chuyển
   * Stage = Purchased (lần 1) hoặc QualityInspected (lần 2)
   */
  app.get(
    "/api/transporter/batches-to-transport",
    requireAuth,
    requireRole(ROLES.TRANSPORTER),
    async (req, res) => {
      try {
        const [batches] = await db.query(
          `
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          prod.product_name,
          pr.total_quantity as purchased_quantity,
          pr.total_price as purchase_price,
          pr.purchaser_id,
          purchaser.name as purchaser_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products prod ON bb.product_type_id = prod.product_id
        LEFT JOIN purchase_records pr ON bb.batch_id = pr.batch_id
        LEFT JOIN users purchaser ON pr.purchaser_id = purchaser.uid
        WHERE bb.status = 'Approved' 
        AND bb.current_stage IN ('Purchased', 'QualityInspected')
        ORDER BY bb.created_at DESC
      `,
        );

        // Phân loại theo stage
        const transport1 = batches.filter(
          (b) => b.current_stage === "Purchased",
        );
        const transport2 = batches.filter(
          (b) => b.current_stage === "QualityInspected",
        );

        res.json({
          success: true,
          data: {
            all: batches,
            transport1: transport1, // Từ purchaser đến processor
            transport2: transport2, // Từ processor đến warehouse
            total: batches.length,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô cần vận chuyển:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/transporter/stats
   * Thống kê cho transporter
   */
  app.get(
    "/api/transporter/stats",
    requireAuth,
    requireRole(ROLES.TRANSPORTER),
    async (req, res) => {
      try {
        const transporterId = req.session.userId;

        // Đếm số lô đang vận chuyển (transport_status = InTransit)
        const [inTransit] = await db.query(
          `
        SELECT COUNT(*) as count
        FROM blockchain_batches
        WHERE transport_status = 'InTransit'
      `,
        );

        // Đếm số lô đã hoàn thành vận chuyển bởi transporter này
        const [completed] = await db.query(
          `
        SELECT COUNT(DISTINCT batch_id) as count
        FROM transport_events
        WHERE participant_id = ? AND action LIKE '%hoàn thành%'
      `,
          [transporterId],
        );

        // Lô cần vận chuyển (Purchased hoặc QualityInspected)
        const [pending] = await db.query(
          `
        SELECT COUNT(*) as count
        FROM blockchain_batches
        WHERE status = 'Approved' 
        AND current_stage IN ('Purchased', 'QualityInspected')
      `,
        );

        // Lô đã giao (Delivered) do transporter này
        const [delivered] = await db.query(
          `
        SELECT COUNT(DISTINCT batch_id) as count
        FROM transport_events
        WHERE participant_id = ? 
        AND (action LIKE '%hoàn thành%' OR action LIKE '%Complete%' OR action LIKE '%Delivered%')
      `,
          [transporterId],
        );

        // Lịch sử gần nhất
        const [recentTransports] = await db.query(
          `
        SELECT 
          te.*,
          bb.batch_name,
          bb.sscc,
          bb.current_stage,
          prod.product_name
        FROM transport_events te
        LEFT JOIN blockchain_batches bb ON te.batch_id = bb.batch_id
        LEFT JOIN products prod ON bb.product_type_id = prod.product_id
        WHERE te.participant_id = ?
        ORDER BY te.timestamp_iso DESC
        LIMIT 5
      `,
          [transporterId],
        );

        res.json({
          success: true,
          data: {
            inTransit: inTransit[0].count || 0,
            completed: completed[0].count || 0,
            pending: pending[0].count || 0,
            delivered: delivered[0].count || 0,
            recentTransports: recentTransports,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy thống kê transporter:", error);
        res.status(500).json({
          error: "Không thể lấy thống kê: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/transporter/batch/:id/current-status
   * Lấy trạng thái vận chuyển hiện tại của lô
   */
  app.get(
    "/api/transporter/batch/:id/current-status",
    requireAuth,
    requireRole(ROLES.TRANSPORTER),
    async (req, res) => {
      try {
        const batchId = req.params.id;

        // Lấy thông tin batch
        const [batchRows] = await db.query(
          `
        SELECT 
          bb.*,
          u.name as farmer_name,
          prod.product_name
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products prod ON bb.product_type_id = prod.product_id
        WHERE bb.batch_id = ?
      `,
          [batchId],
        );

        if (batchRows.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy lô hàng" });
        }

        const batch = batchRows[0];

        // FIX: Lấy lịch sử vận chuyển từ transport_events
        const [history] = await db.query(
          `
        SELECT 
          te.*,
          u.name as transporter_name
        FROM transport_events te
        LEFT JOIN users u ON te.participant_id = u.uid
        WHERE te.batch_id = ?
        ORDER BY te.timestamp_iso DESC
      `,
          [batchId],
        );

        // Kiểm tra xem đang ở giai đoạn vận chuyển nào
        let transportPhase = null;
        if (batch.current_stage === "Purchased") {
          transportPhase = "transport1"; // Chờ vận chuyển lần 1
        } else if (batch.current_stage === "QualityInspected") {
          transportPhase = "transport2"; // Chờ vận chuyển lần 2
        } else if (batch.current_stage === "Transported1") {
          transportPhase = "completed1"; // Đã vận chuyển lần 1
        } else if (batch.current_stage === "Warehoused") {
          transportPhase = "completed2"; // Đã vận chuyển lần 2
        }

        // Lấy thông tin từ blockchain
        let blockchainData = null;
        try {
          const batchDetails = await traceabilityContract.methods
            .getBatchDetails(BigInt(batchId))
            .call();

          blockchainData = {
            currentStage: batchDetails.currentStage,
            transportStatus:
              batchDetails.transportStatus === 0n
                ? "NotStarted"
                : batchDetails.transportStatus === 1n
                  ? "InTransit"
                  : "Delivered",
          };
        } catch (error) {
          console.error("Lỗi lấy blockchain data:", error);
        }

        res.json({
          success: true,
          data: {
            batch,
            transportPhase,
            transportStatus: batch.transport_status,
            history,
            blockchain: blockchainData,
            canTransport:
              batch.current_stage === "Purchased" ||
              batch.current_stage === "QualityInspected",
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy trạng thái:", error);
        res.status(500).json({
          error: "Không thể lấy trạng thái: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/transporter/batch/:id/details
   * Lấy chi tiết đầy đủ của lô để cập nhật trạng thái
   */
  app.get(
    "/api/transporter/batch/:id/details",
    requireAuth,
    requireRole(ROLES.TRANSPORTER),
    async (req, res) => {
      try {
        const batchId = req.params.id;

        // FIX: Sử dụng purchase_records thay vì purchases
        const [batchRows] = await db.query(
          `
        SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.address as farmer_address,
          prod.product_name,
          pr.total_quantity as purchased_quantity,
          pr.total_price as purchase_price,
          purchaser.name as purchaser_name,
          purchaser.address as purchaser_address
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products prod ON bb.product_type_id = prod.product_id
        LEFT JOIN purchase_records pr ON bb.batch_id = pr.batch_id
        LEFT JOIN users purchaser ON pr.purchaser_id = purchaser.uid
        WHERE bb.batch_id = ?
      `,
          [batchId],
        );

        if (batchRows.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy lô hàng" });
        }

        const batch = batchRows[0];

        // Kiểm tra có thể vận chuyển không
        if (
          batch.current_stage !== "Purchased" &&
          batch.current_stage !== "QualityInspected"
        ) {
          return res.status(400).json({
            error: "Lô hàng không ở trạng thái cần vận chuyển",
            currentStage: batch.current_stage,
          });
        }

        // FIX: Lấy lịch sử vận chuyển từ transport_events
        const [history] = await db.query(
          `
        SELECT 
          te.*,
          u.name as transporter_name
        FROM transport_events te
        LEFT JOIN users u ON te.participant_id = u.uid
        WHERE te.batch_id = ?
        ORDER BY te.timestamp_iso DESC
      `,
          [batchId],
        );

        // Lấy ảnh sản phẩm
        const [images] = await db.query(
          `
        SELECT image_url 
        FROM batch_product_images 
        WHERE batch_id = ?
        ORDER BY image_order ASC, created_at ASC
      `,
          [batchId],
        );

        res.json({
          success: true,
          data: {
            batch,
            history,
            images: images.map((img) => img.image_url),
            transportPhase:
              batch.current_stage === "Purchased" ? "transport1" : "transport2",
            destination:
              batch.current_stage === "Purchased"
                ? "Nhà máy sản xuất"
                : "Kho bãi",
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy chi tiết batch:", error);
        res.status(500).json({
          error: "Không thể lấy thông tin: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 5: PROCESSOR - SƠ CHẾ VÀ ĐÓNG GÓI
  // ==========================================

  /**
   * GET /api/processor/pending-batches
   * Xem lô hàng cần sơ chế (đã vận chuyển đến)
   * Role: Processor (role_id = 4)
   */
  app.get(
    "/api/processor/pending-batches",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const [batches] = await db.query(`
        SELECT 
          bb.*,
          u.name as farmer_name,
          p.product_name,
          pr.total_quantity,
          te.timestamp_iso as delivered_at
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN purchase_records pr ON bb.batch_id = pr.batch_id
        LEFT JOIN (
          SELECT batch_id, MAX(timestamp_iso) as timestamp_iso
          FROM transport_events
          WHERE action = 'Hoàn thành vận chuyển'
          GROUP BY batch_id
        ) te ON bb.batch_id = te.batch_id
        WHERE bb.current_stage IN ('Purchased', 'Transported1')
          AND bb.transport_status = 'Delivered'
          AND bb.processor_id = 0
        ORDER BY te.timestamp_iso DESC
      `);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô cần sơ chế:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * POST /api/processor/record-processing
   * Ghi nhận sơ chế
   * Role: Processor
   */
  app.post(
    "/api/processor/record-processing",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    upload,
    async (req, res) => {
      let connection;
      try {
        const processorId = req.session.userId;
        const {
          batchId,
          method,
          methodDescription,
          inputWeight,
          outputWeight,
          notes,
        } = req.body;

        if (!batchId || method === undefined || !inputWeight || !outputWeight) {
          return res.status(400).json({
            error: "Thiếu thông tin bắt buộc",
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const batchDetails = await traceabilityContract.methods
          .getBatchDetails(batchId)
          .call();

        const validStages = ["1", "2"]; // Purchased hoặc Transported1
        if (!validStages.includes(batchDetails.currentStage.toString())) {
          await connection.rollback();
          return res.status(400).json({
            error: "Lô hàng chưa sẵn sàng sơ chế",
          });
        }

        // Upload images
        const processingImages = req.files["processingImages"] || [];
        let processingImageUrls = [];
        for (const file of processingImages) {
          const result = await uploadFile(file);
          processingImageUrls.push(result.ipfsUrl);
        }

        // Gọi contract on-chain
        const result = await traceabilityContract.methods
          .recordProcessing(
            BigInt(batchId),
            BigInt(processorId),
            BigInt(method),
            BigInt(Math.round(inputWeight * 1000)),
            BigInt(Math.round(outputWeight * 1000)),
          )
          .send({ from: web3.eth.defaultAccount, gas: 3000000 });

        // Lấy processingId từ event
        let processingId = null;
        if (result.events?.ProcessingRecorded) {
          processingId = Number(
            result.events.ProcessingRecorded.returnValues.processingId,
          );
        }

        if (!processingId) {
          await connection.rollback();
          return res.status(500).json({
            error: "Không thể lấy processingId từ blockchain",
          });
        }

        // Lấy timestamp từ blockchain
        const receipt = await web3.eth.getTransactionReceipt(
          result.transactionHash,
        );
        const block = await web3.eth.getBlock(receipt.blockNumber);
        const timestamp = Number(block.timestamp);
        const timestampISO = new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        // Map method number sang text
        const methodMap = {
          0: "Washing",
          1: "Cutting",
          2: "Drying",
          3: "Freezing",
          4: "Packaging",
        };
        const methodText = methodMap[Number(method)] || "Washing";

        // INSERT vào processing_records
        await connection.query(
          `INSERT INTO processing_records
        (processing_id, batch_id, processor_id, processing_date, processing_date_iso,
         method, input_weight, output_weight, method_description, notes, blockchain_tx_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          method = VALUES(method),
          input_weight = VALUES(input_weight),
          output_weight = VALUES(output_weight),
          method_description = VALUES(method_description),
          notes = VALUES(notes)`,
          [
            processingId,
            parseInt(batchId),
            parseInt(processorId),
            timestamp,
            timestampISO,
            methodText,
            parseFloat(inputWeight),
            parseFloat(outputWeight),
            methodDescription || null,
            notes || null,
            result.transactionHash,
          ],
        );

        // ✅ INSERT ảnh vào processing_images
        if (processingImageUrls.length > 0) {
          const imageValues = processingImageUrls.map((url) => [
            processingId,
            url,
          ]);
          await connection.query(
            `INSERT INTO processing_images (processing_id, image_url) VALUES ?`,
            [imageValues],
          );
        }

        // Update blockchain_batches
        await connection.query(
          `UPDATE blockchain_batches 
         SET current_stage = 'Processed', processor_id = ? 
         WHERE batch_id = ?`,
          [parseInt(processorId), parseInt(batchId)],
        );

        // Gọi addProcessingDetails (off-chain)
        if (methodDescription || notes) {
          await traceabilityContract.methods
            .addProcessingDetails(
              BigInt(processingId),
              methodDescription || "",
              notes || "",
            )
            .send({ from: web3.eth.defaultAccount, gas: 1500000 });
        }

        await connection.commit();

        res.json({
          success: true,
          message: "Ghi nhận sơ chế thành công",
          data: {
            processingId,
            efficiency: ((outputWeight / inputWeight) * 100).toFixed(2) + "%",
            imageUrls: processingImageUrls,
            imageCount: processingImageUrls.length,
            transactionHash: result.transactionHash,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        cleanupUploadedFiles(req.files);
        console.error("Lỗi sơ chế:", error);
        res.status(500).json({
          error: "Không thể ghi nhận sơ chế: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * POST /api/processor/create-products
   * Đóng gói sản phẩm đơn lẻ (sau khi sơ chế)
   * Role: Processor
   */

  // app.post(
  //   "/api/processor/create-products",
  //   requireAuth,
  //   requireRole(ROLES.PROCESSOR),
  //   async (req, res) => {
  //     let connection;
  //     try {
  //       const processorId = req.session.userId;
  //       const { batchId, products } = req.body;

  //       if (
  //         !batchId ||
  //         !products ||
  //         !Array.isArray(products) ||
  //         products.length === 0
  //       ) {
  //         return res.status(400).json({
  //           error: "Thiếu thông tin sản phẩm",
  //         });
  //       }

  //       for (const product of products) {
  //         if (!product.treeId || !product.weight || !product.packageType) {
  //           return res.status(400).json({
  //             error: "Mỗi sản phẩm phải có treeId, weight và packageType",
  //           });
  //         }
  //       }

  //       connection = await db.getConnection();
  //       await connection.beginTransaction();

  //       const batchDetails = await traceabilityContract.methods
  //         .getBatchDetails(batchId)
  //         .call();

  //       if (batchDetails.currentStage.toString() !== "3") {
  //         await connection.rollback();
  //         return res.status(400).json({
  //           error: "Lô hàng chưa được sơ chế",
  //         });
  //       }

  //       if (batchDetails.processorId.toString() !== processorId.toString()) {
  //         await connection.rollback();
  //         return res.status(403).json({
  //           error: "Bạn không phải processor của lô này",
  //         });
  //       }

  //       // Validate treeIds
  //       const treeIds = products.map((p) => parseInt(p.treeId));

  //       const treeValidations = [];
  //       for (const treeId of treeIds) {
  //         const [result] = await connection.query(
  //           `SELECT tree_id FROM tree_batch_links WHERE batch_id = ? AND tree_id = ?`,
  //           [batchId, treeId],
  //         );
  //         treeValidations.push({
  //           treeId,
  //           exists: result.length > 0,
  //         });
  //       }

  //       const invalidTrees = treeValidations.filter((t) => !t.exists);

  //       if (invalidTrees.length > 0) {
  //         await connection.rollback();
  //         return res.status(400).json({
  //           error: `Các cây sau không thuộc lô hàng này: ${invalidTrees
  //             .map((t) => t.treeId)
  //             .join(", ")}`,
  //         });
  //       }

  //       console.log("✅ All trees validated:", treeValidations);

  //       const sourceTreeIds = products.map((p) => BigInt(p.treeId));
  //       const weights = products.map((p) =>
  //         BigInt(Math.round(p.weight * 1000)),
  //       );
  //       const packageType = products[0].packageType;

  //       // Gọi contract
  //       const result = await traceabilityContract.methods
  //         .createProductsInBatch(
  //           BigInt(batchId),
  //           sourceTreeIds,
  //           weights,
  //           packageType,
  //         )
  //         .send({ from: web3.eth.defaultAccount, gas: 5000000 });

  //       console.log("📦 Contract call successful:", result.transactionHash);

  //       // Lấy timestamp
  //       const receipt = await web3.eth.getTransactionReceipt(
  //         result.transactionHash,
  //       );
  //       const block = await web3.eth.getBlock(receipt.blockNumber);
  //       const timestamp = Number(block.timestamp);
  //       const timestampISO = new Date(timestamp * 1000)
  //         .toISOString()
  //         .slice(0, 19)
  //         .replace("T", " ");

  //       // ✅ QUAN TRỌNG: Dùng getPastEvents thay vì result.events
  //       // Vì result.events có thể chỉ trả về event cuối cùng khi có nhiều events cùng loại
  //       const productCreatedEvents = await traceabilityContract.getPastEvents(
  //         "ProductCreated",
  //         {
  //           filter: { batchId: batchId },
  //           fromBlock: receipt.blockNumber,
  //           toBlock: receipt.blockNumber,
  //         },
  //       );

  //       const productTreeLinkedEvents =
  //         await traceabilityContract.getPastEvents("ProductTreeLinked", {
  //           fromBlock: receipt.blockNumber,
  //           toBlock: receipt.blockNumber,
  //         });

  //       // Filter chỉ lấy events của transaction này
  //       const relevantProductEvents = productCreatedEvents.filter(
  //         (e) => e.transactionHash === result.transactionHash,
  //       );

  //       const relevantLinkEvents = productTreeLinkedEvents.filter(
  //         (e) => e.transactionHash === result.transactionHash,
  //       );

  //       console.log(
  //         `📦 Found ${relevantProductEvents.length} ProductCreated events (getPastEvents)`,
  //       );
  //       console.log(
  //         `🌳 Found ${relevantLinkEvents.length} ProductTreeLinked events (getPastEvents)`,
  //       );

  //       if (relevantProductEvents.length === 0) {
  //         await connection.rollback();
  //         return res.status(500).json({
  //           error: "Không thể lấy productIds từ blockchain events",
  //           debug: {
  //             transactionHash: result.transactionHash,
  //             blockNumber: receipt.blockNumber,
  //             totalEventsFound: productCreatedEvents.length,
  //             relevantEventsFound: relevantProductEvents.length,
  //           },
  //         });
  //       }

  //       // ✅ INSERT products vào blockchain_products
  //       const createdProducts = [];

  //       for (const event of relevantProductEvents) {
  //         const productId = Number(event.returnValues.productId);
  //         const qrCode = event.returnValues.productQRCode;
  //         const weight = Number(event.returnValues.weight);
  //         const pkgType = event.returnValues.packageType;

  //         await connection.query(
  //           `INSERT INTO blockchain_products
  //         (product_id, batch_id, product_qr_code, packaged_date, packaged_date_iso,
  //          package_type, weight, is_active, sold_date, blockchain_tx_hash)
  //         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 0, ?)
  //         ON DUPLICATE KEY UPDATE
  //           package_type = VALUES(package_type),
  //           weight = VALUES(weight),
  //           packaged_date = VALUES(packaged_date),
  //           packaged_date_iso = VALUES(packaged_date_iso)`,
  //           [
  //             productId,
  //             parseInt(batchId),
  //             qrCode,
  //             timestamp,
  //             timestampISO,
  //             pkgType,
  //             weight,
  //             result.transactionHash,
  //           ],
  //         );

  //         createdProducts.push({
  //           productId,
  //           qrCode,
  //           weight: weight / 1000,
  //           packageType: pkgType,
  //         });

  //         console.log(`✅ Inserted product ${productId} into DB`);
  //       }

  //       // ✅ INSERT vào product_source_trees
  //       for (const linkEvent of relevantLinkEvents) {
  //         const productId = Number(linkEvent.returnValues.productId);
  //         const treeId = Number(linkEvent.returnValues.treeId);

  //         await connection.query(
  //           `INSERT IGNORE INTO product_source_trees (product_id, tree_id)
  //          VALUES (?, ?)`,
  //           [productId, treeId],
  //         );
  //         console.log(`✅ Linked product ${productId} to tree ${treeId}`);
  //       }

  //       // ✅ Update total_products
  //       await connection.query(
  //         `UPDATE blockchain_batches
  //        SET total_products = total_products + ?
  //        WHERE batch_id = ?`,
  //         [relevantProductEvents.length, parseInt(batchId)],
  //       );

  //       await connection.commit();

  //       // ✅ Map products với sourceTreeId từ productTreeLinkedEvents
  //       const productsWithTrees = createdProducts.map((p) => {
  //         const linkEvent = relevantLinkEvents.find(
  //           (e) => Number(e.returnValues.productId) === p.productId,
  //         );
  //         return {
  //           ...p,
  //           sourceTreeId: linkEvent
  //             ? Number(linkEvent.returnValues.treeId)
  //             : null,
  //         };
  //       });

  //       res.json({
  //         success: true,
  //         message: `Đã tạo ${createdProducts.length} sản phẩm đơn lẻ`,
  //         data: {
  //           batchId,
  //           productCount: createdProducts.length,
  //           products: productsWithTrees,
  //           transactionHash: result.transactionHash,
  //         },
  //       });
  //     } catch (error) {
  //       if (connection) await connection.rollback();
  //       console.error("❌ Lỗi tạo sản phẩm:", error);
  //       res.status(500).json({
  //         error: "Không thể tạo sản phẩm: " + error.message,
  //       });
  //     } finally {
  //       if (connection) connection.release();
  //     }
  //   },
  // );

  /**
   * POST /api/processor/create-products
   * Đóng gói sản phẩm đơn lẻ (sau khi sơ chế)
   * Role: Processor
   */
  app.post(
    "/api/processor/create-products",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      let connection;
      try {
        const processorId = req.session.userId;
        const { batchId, products } = req.body;

        if (
          !batchId ||
          !products ||
          !Array.isArray(products) ||
          products.length === 0
        ) {
          return res.status(400).json({
            error: "Thiếu thông tin sản phẩm",
          });
        }

        // Validate each product has governmentQR
        for (const product of products) {
          if (!product.governmentQR) {
            return res.status(400).json({
              error: "Mỗi sản phẩm phải có mã tem QR Bộ Công An",
            });
          }
          if (!product.treeId || !product.weight || !product.packageType) {
            return res.status(400).json({
              error: "Mỗi sản phẩm phải có treeId, weight và packageType",
            });
          }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Validate batch
        const batchDetails = await traceabilityContract.methods
          .getBatchDetails(batchId)
          .call();

        if (batchDetails.currentStage.toString() !== "3") {
          await connection.rollback();
          return res.status(400).json({
            error: "Lô hàng chưa được sơ chế",
          });
        }

        if (batchDetails.processorId.toString() !== processorId.toString()) {
          await connection.rollback();
          return res.status(403).json({
            error: "Bạn không phải processor của lô này",
          });
        }

        // Validate all government QR stamps
        const governmentQRs = products.map((p) => p.governmentQR);

        const [stamps] = await connection.query(
          `SELECT qr_code, status, used_by_user_id, used_for_product_id
         FROM government_qr_stamps 
         WHERE qr_code IN (?)`,
          [governmentQRs],
        );

        // Check if all stamps exist and are available
        const stampMap = new Map(stamps.map((s) => [s.qr_code, s]));

        for (const qr of governmentQRs) {
          const stamp = stampMap.get(qr);
          if (!stamp) {
            await connection.rollback();
            return res.status(400).json({
              error: `Tem QR không tồn tại: ${qr}`,
            });
          }
          if (stamp.status !== "AVAILABLE") {
            await connection.rollback();

            // ✅ Thông báo chi tiết nếu đã dùng
            if (stamp.status === "USED" && stamp.used_for_product_id) {
              return res.status(400).json({
                error: `Tem QR đã được sử dụng cho sản phẩm #${stamp.used_for_product_id}: ${qr}`,
              });
            }

            return res.status(400).json({
              error: `Tem QR đã được sử dụng: ${qr}`,
            });
          }
        }

        // Validate trees
        const treeIds = products.map((p) => parseInt(p.treeId));
        const [treeLinks] = await connection.query(
          `SELECT tree_id FROM tree_batch_links 
         WHERE batch_id = ? AND tree_id IN (?)`,
          [batchId, treeIds],
        );

        if (treeLinks.length !== treeIds.length) {
          await connection.rollback();
          return res.status(400).json({
            error: "Một số cây không thuộc lô hàng này",
          });
        }

        // ✅ BƯỚC 1: Lock stamps TRƯỚC (set status = USED, nhưng chưa set product_id)
        const [user] = await connection.query(
          `SELECT name FROM users WHERE uid = ?`,
          [processorId],
        );
        const userName = user[0]?.name || "Processor";

        for (const qr of governmentQRs) {
          await connection.query(
            `UPDATE government_qr_stamps 
           SET status = 'USED',
               used_date = NOW(),
               used_by_user_id = ?,
               used_by_user_name = ?,
               used_for_batch_id = ?
           WHERE qr_code = ? AND status = 'AVAILABLE'`,
            [processorId, userName, parseInt(batchId), qr],
          );
        }

        console.log("✅ Stamps locked (status = USED)");

        // ✅ BƯỚC 2: Call blockchain
        const governmentQRCodes = products.map((p) => p.governmentQR);
        const sourceTreeIds = products.map((p) => BigInt(p.treeId));
        const weights = products.map((p) =>
          BigInt(Math.round(p.weight * 1000)),
        );
        const packageType = products[0].packageType;

        const result = await traceabilityContract.methods
          .createProductsInBatch(
            BigInt(batchId),
            governmentQRCodes,
            sourceTreeIds,
            weights,
            packageType,
          )
          .send({ from: web3.eth.defaultAccount, gas: 5000000 });

        console.log("📦 Contract call successful:", result.transactionHash);

        // Get timestamp
        const receipt = await web3.eth.getTransactionReceipt(
          result.transactionHash,
        );
        const block = await web3.eth.getBlock(receipt.blockNumber);
        const timestamp = Number(block.timestamp);
        const timestampISO = new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        // Get events
        const productCreatedEvents = await traceabilityContract.getPastEvents(
          "ProductCreated",
          {
            filter: { batchId: batchId },
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber,
          },
        );

        const productTreeLinkedEvents =
          await traceabilityContract.getPastEvents("ProductTreeLinked", {
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber,
          });

        const relevantProductEvents = productCreatedEvents.filter(
          (e) => e.transactionHash === result.transactionHash,
        );

        const relevantLinkEvents = productTreeLinkedEvents.filter(
          (e) => e.transactionHash === result.transactionHash,
        );

        if (relevantProductEvents.length === 0) {
          await connection.rollback();
          return res.status(500).json({
            error: "Không thể lấy productIds từ blockchain events",
          });
        }

        console.log(`📦 Found ${relevantProductEvents.length} product events`);

        // ✅ BƯỚC 3: Insert products vào DB - Government QR chính là product QR
        const createdProducts = [];
        const productStampMap = []; // Map [productId, stampId] để update sau

        for (let i = 0; i < relevantProductEvents.length; i++) {
          const event = relevantProductEvents[i];
          const productId = Number(event.returnValues.productId);
          const governmentQR = event.returnValues.governmentQRCode; // ✅ Lấy government QR từ event
          const weight = Number(event.returnValues.weight);
          const pkgType = event.returnValues.packageType;

          // Get stamp ID
          const [stampResult] = await connection.query(
            `SELECT id FROM government_qr_stamps WHERE qr_code = ?`,
            [governmentQR],
          );

          const stampId = stampResult[0]?.id;

          if (!stampId) {
            await connection.rollback();
            return res.status(500).json({
              error: `Không tìm thấy tem QR: ${governmentQR}`,
            });
          }

          // ✅ Insert product - product_qr_code CHÍNH LÀ government QR
          await connection.query(
            `INSERT INTO blockchain_products
          (product_id, batch_id, product_qr_code, packaged_date, packaged_date_iso,
           package_type, weight, is_active, sold_date, blockchain_tx_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 0, ?)`,
            [
              productId,
              parseInt(batchId),
              governmentQR, // ✅ Dùng government QR làm product_qr_code
              timestamp,
              timestampISO,
              pkgType,
              weight,
              result.transactionHash,
            ],
          );

          console.log(
            `✅ Inserted product ${productId} with QR: ${governmentQR}`,
          );

          // Save mapping để update sau
          productStampMap.push({ productId, stampId, governmentQR });

          createdProducts.push({
            productId,
            qrCode: governmentQR, // ✅ Government QR chính là QR code
            weight: weight / 1000,
            packageType: pkgType,
            governmentQR,
          });
        }

        // ✅ BƯỚC 4: Update products với government_qr_stamp_id (SAU KHI products đã tồn tại)
        for (const { productId, stampId } of productStampMap) {
          await connection.query(
            `UPDATE blockchain_products 
           SET government_qr_stamp_id = ?
           WHERE product_id = ?`,
            [stampId, productId],
          );
        }

        console.log("✅ Updated products with stamp foreign keys");

        // ✅ BƯỚC 5: Update stamps với used_for_product_id (BÂY GIỜ MỚI SAFE)
        for (const { productId, stampId, governmentQR } of productStampMap) {
          await connection.query(
            `UPDATE government_qr_stamps 
           SET used_for_product_id = ?,
               blockchain_tx_hash = ?
           WHERE id = ?`,
            [productId, result.transactionHash, stampId],
          );
        }

        console.log("✅ Updated stamps with product_id references");

        // Link products with source trees
        for (const linkEvent of relevantLinkEvents) {
          const productId = Number(linkEvent.returnValues.productId);
          const treeId = Number(linkEvent.returnValues.treeId);

          await connection.query(
            `INSERT IGNORE INTO product_source_trees (product_id, tree_id)
           VALUES (?, ?)`,
            [productId, treeId],
          );
        }

        // Update total_products
        await connection.query(
          `UPDATE blockchain_batches 
         SET total_products = total_products + ? 
         WHERE batch_id = ?`,
          [relevantProductEvents.length, parseInt(batchId)],
        );

        await connection.commit();

        // Map products with sourceTreeId
        const productsWithTrees = createdProducts.map((p) => {
          const linkEvent = relevantLinkEvents.find(
            (e) => Number(e.returnValues.productId) === p.productId,
          );
          return {
            ...p,
            sourceTreeId: linkEvent
              ? Number(linkEvent.returnValues.treeId)
              : null,
          };
        });

        res.json({
          success: true,
          message: `Đã tạo ${createdProducts.length} sản phẩm đơn lẻ`,
          data: {
            batchId,
            productCount: createdProducts.length,
            products: productsWithTrees,
            transactionHash: result.transactionHash,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Create products error:", error);
        res.status(500).json({
          error: "Không thể tạo sản phẩm: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * GET /api/processor/my-batches
   * Xem các lô đã sơ chế
   * Role: Processor
   */
  app.get(
    "/api/processor/my-batches",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const processorId = req.session.userId;

        const [batches] = await db.query(
          `
        SELECT 
          bb.*,
          pr.method,
          pr.input_weight,
          pr.output_weight,
          pr.processing_date_iso,
          u.name as farmer_name,
          p.product_name
        FROM blockchain_batches bb
        INNER JOIN processing_records pr ON bb.batch_id = pr.batch_id
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE bb.processor_id = ?
        ORDER BY pr.processing_date_iso DESC
      `,
          [processorId],
        );

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách sơ chế:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // GET /api/processor/stats
  // Thống kê tổng quan processor
  // ==========================================
  app.get(
    "/api/processor/stats",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const processorId = req.session.userId;

        // Tổng số lô đã sơ chế
        const [totalProcessed] = await db.query(
          `SELECT COUNT(DISTINCT batch_id) as count 
         FROM processing_records 
         WHERE processor_id = ?`,
          [processorId],
        );

        // Tổng sản phẩm đã đóng gói
        const [totalProducts] = await db.query(
          `SELECT COUNT(*) as count 
         FROM blockchain_products bp
         INNER JOIN blockchain_batches bb ON bp.batch_id = bb.batch_id
         WHERE bb.processor_id = ?`,
          [processorId],
        );

        // Lô đang chờ sơ chế (đã mua, đã vận chuyển)
        const [pendingBatches] = await db.query(
          `SELECT COUNT(*) as count 
         FROM blockchain_batches 
         WHERE current_stage IN ('Purchased', 'Transported1')
           AND transport_status = 'Delivered'
           AND processor_id = 0
           AND status = 'Approved'`,
        );

        // Lô đã sơ chế nhưng chưa đóng gói hết
        const [needsPackaging] = await db.query(
          `SELECT COUNT(*) as count 
         FROM blockchain_batches 
         WHERE current_stage = 'Processed'
           AND processor_id = ?`,
          [processorId],
        );

        // Hiệu suất sơ chế trung bình
        const [avgEfficiency] = await db.query(
          `SELECT AVG((output_weight / input_weight) * 100) as avg_efficiency
         FROM processing_records
         WHERE processor_id = ? AND input_weight > 0`,
          [processorId],
        );

        // 5 lô mới nhất cần sơ chế
        const [latestPending] = await db.query(
          `SELECT 
          bb.*,
          u.name as farmer_name,
          p.product_name,
          pr.total_quantity,
          te.timestamp_iso as delivered_at
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN purchase_records pr ON bb.batch_id = pr.batch_id
        LEFT JOIN (
          SELECT batch_id, MAX(timestamp_iso) as timestamp_iso
          FROM transport_events
          WHERE action LIKE '%Hoàn thành%' OR action LIKE '%Delivered%'
          GROUP BY batch_id
        ) te ON bb.batch_id = te.batch_id
        WHERE bb.current_stage IN ('Purchased', 'Transported1')
          AND bb.transport_status = 'Delivered'
          AND bb.processor_id = 0
          AND bb.status = 'Approved'
        ORDER BY te.timestamp_iso DESC
        LIMIT 5`,
        );

        res.json({
          success: true,
          data: {
            totalProcessed: totalProcessed[0]?.count || 0,
            totalProducts: totalProducts[0]?.count || 0,
            pendingBatches: pendingBatches[0]?.count || 0,
            needsPackaging: needsPackaging[0]?.count || 0,
            avgEfficiency: parseFloat(
              avgEfficiency[0]?.avg_efficiency || 0,
            ).toFixed(2),
            latestPending: latestPending,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy thống kê processor:", error);
        res.status(500).json({
          error: "Không thể lấy thống kê: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // GET /api/processor/batch/:id/processing-details
  // Chi tiết sơ chế của một lô
  // ==========================================
  app.get(
    "/api/processor/batch/:id/processing-details",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const { id } = req.params;

        // Thông tin batch
        const [batches] = await db.query(
          `SELECT 
          bb.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          u.email as farmer_email,
          p.product_name,
          pr.total_quantity,
          pr.purchase_date_iso
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN purchase_records pr ON bb.batch_id = pr.batch_id
        WHERE bb.batch_id = ?`,
          [id],
        );

        if (batches.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy lô hàng" });
        }

        const batch = batches[0];

        // Processing records
        const [processingRecords] = await db.query(
          `SELECT pr.*, u.name as processor_name
         FROM processing_records pr
         LEFT JOIN users u ON pr.processor_id = u.uid
         WHERE pr.batch_id = ?
         ORDER BY pr.processing_date_iso DESC`,
          [id],
        );

        // Processing images
        const [processingImages] = await db.query(
          `SELECT pi.* 
         FROM processing_images pi
         INNER JOIN processing_records pr ON pi.processing_id = pr.processing_id
         WHERE pr.batch_id = ?`,
          [id],
        );

        // Products created
        const [products] = await db.query(
          `SELECT 
          bp.*,
          GROUP_CONCAT(pst.tree_id) as source_tree_ids
         FROM blockchain_products bp
         LEFT JOIN product_source_trees pst ON bp.product_id = pst.product_id
         WHERE bp.batch_id = ?
         GROUP BY bp.product_id
         ORDER BY bp.packaged_date_iso DESC`,
          [id],
        );

        // Purchase images
        const [purchaseImages] = await db.query(
          `SELECT pi.*
         FROM purchase_images pi
         INNER JOIN purchase_records pr ON pi.purchase_id = pr.purchase_id
         WHERE pr.batch_id = ?`,
          [id],
        );

        // Batch images
        const [batchImages] = await db.query(
          `SELECT * FROM batch_product_images WHERE batch_id = ?`,
          [id],
        );

        res.json({
          success: true,
          data: {
            batch,
            processingRecords,
            processingImages,
            products,
            purchaseImages,
            batchImages,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy chi tiết sơ chế:", error);
        res.status(500).json({
          error: "Không thể lấy chi tiết: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // 3. GET /api/processor/processing/:id/images
  // Lấy ảnh của một processing record
  // ==========================================
  app.get(
    "/api/processor/processing/:id/images",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const { id } = req.params;

        const [images] = await db.query(
          `SELECT * FROM processing_images WHERE processing_id = ?`,
          [id],
        );

        res.json({
          success: true,
          count: images.length,
          data: images,
        });
      } catch (error) {
        console.error("Lỗi khi lấy ảnh sơ chế:", error);
        res.status(500).json({
          error: "Không thể lấy ảnh: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // GET /api/processor/products/by-batch/:id
  // Lấy danh sách sản phẩm đã đóng gói từ một lô
  // ==========================================
  app.get(
    "/api/processor/products/by-batch/:id",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const { id } = req.params;
        const processorId = req.session.userId;

        // Kiểm tra quyền truy cập
        const [batches] = await db.query(
          `SELECT processor_id FROM blockchain_batches WHERE batch_id = ?`,
          [id],
        );

        if (batches.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy lô hàng" });
        }

        if (batches[0].processor_id !== processorId) {
          return res.status(403).json({
            error: "Bạn không có quyền xem sản phẩm của lô này",
          });
        }

        // Lấy products với source trees
        const [products] = await db.query(
          `SELECT 
          bp.*,
          GROUP_CONCAT(DISTINCT pst.tree_id) as source_tree_ids,
          GROUP_CONCAT(DISTINCT t.tree_qr_code) as source_tree_qrs,
          GROUP_CONCAT(DISTINCT t.tree_type) as tree_types
         FROM blockchain_products bp
         LEFT JOIN product_source_trees pst ON bp.product_id = pst.product_id
         LEFT JOIN trees t ON pst.tree_id = t.tree_id
         WHERE bp.batch_id = ?
         GROUP BY bp.product_id
         ORDER BY bp.packaged_date_iso DESC`,
          [id],
        );

        // Thống kê
        const stats = {
          total: products.length,
          active: products.filter((p) => p.is_active).length,
          sold: products.filter((p) => !p.is_active).length,
          totalWeight:
            products.reduce((sum, p) => sum + (p.weight || 0), 0) / 1000,
        };

        res.json({
          success: true,
          count: products.length,
          stats,
          data: products,
        });
      } catch (error) {
        console.error("Lỗi khi lấy sản phẩm:", error);
        res.status(500).json({
          error: "Không thể lấy sản phẩm: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // GET /api/processor/batch/:id/trees
  // Lấy danh sách cây nguồn gốc của lô (để chọn khi đóng gói)
  // ==========================================
  app.get(
    "/api/processor/batch/:id/trees",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const { id } = req.params;

        const [trees] = await db.query(
          `SELECT 
          t.*,
          tbl.harvest_date_iso,
          tbl.harvest_notes
         FROM trees t
         INNER JOIN tree_batch_links tbl ON t.tree_id = tbl.tree_id
         WHERE tbl.batch_id = ?
         ORDER BY t.tree_qr_code ASC`,
          [id],
        );

        res.json({
          success: true,
          count: trees.length,
          data: trees,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách cây:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách cây: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/processor/my-products
   * Lấy tất cả sản phẩm của processor
   */
  app.get(
    "/api/processor/my-products",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const processorId = req.session.userId;

        const [products] = await db.query(
          `SELECT 
          bp.*,
          bb.batch_name,
          bb.sscc,
          bb.product_type_id,
          p.product_name,
          GROUP_CONCAT(DISTINCT pst.tree_id) as source_tree_ids,
          GROUP_CONCAT(DISTINCT t.tree_qr_code) as source_tree_qrs
         FROM blockchain_products bp
         INNER JOIN blockchain_batches bb ON bp.batch_id = bb.batch_id
         LEFT JOIN products p ON bb.product_type_id = p.product_id
         LEFT JOIN product_source_trees pst ON bp.product_id = pst.product_id
         LEFT JOIN trees t ON pst.tree_id = t.tree_id
         WHERE bb.processor_id = ?
         GROUP BY bp.product_id
         ORDER BY bp.packaged_date_iso DESC`,
          [processorId],
        );

        res.json({
          success: true,
          count: products.length,
          data: products,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách sản phẩm:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách sản phẩm: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/processor/product/:id/details
   * Lấy chi tiết sản phẩm bao gồm cây nguồn gốc
   */
  app.get(
    "/api/processor/product/:id/details",
    requireAuth,
    requireRole(ROLES.PROCESSOR),
    async (req, res) => {
      try {
        const { id } = req.params;
        const processorId = req.session.userId;

        // Get product info
        const [products] = await db.query(
          `SELECT 
          bp.*,
          bb.batch_name,
          bb.sscc,
          bb.processor_id,
          p.product_name
         FROM blockchain_products bp
         INNER JOIN blockchain_batches bb ON bp.batch_id = bb.batch_id
         LEFT JOIN products p ON bb.product_type_id = p.product_id
         WHERE bp.product_id = ?`,
          [id],
        );

        if (products.length === 0) {
          return res.status(404).json({
            error: "Không tìm thấy sản phẩm",
          });
        }

        const product = products[0];

        // Check authorization
        if (product.processor_id !== processorId) {
          return res.status(403).json({
            error: "Bạn không có quyền xem sản phẩm này",
          });
        }

        // Get source trees
        const [sourceTrees] = await db.query(
          `SELECT 
          t.*,
          pst.created_at as linked_at
         FROM product_source_trees pst
         INNER JOIN trees t ON pst.tree_id = t.tree_id
         WHERE pst.product_id = ?`,
          [id],
        );

        // Get batch info
        const [batches] = await db.query(
          `SELECT * FROM blockchain_batches WHERE batch_id = ?`,
          [product.batch_id],
        );

        res.json({
          success: true,
          data: {
            product,
            batch: batches[0] || null,
            sourceTrees,
          },
        });
      } catch (error) {
        console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
        res.status(500).json({
          error: "Không thể lấy chi tiết sản phẩm: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 0: GOVERNMENT STAMPS API ENDPOINTS
  // Thêm vào server.js
  // ==========================================

  /**
   * POST /api/government-stamps/generate
   * Tạo tem QR hàng loạt
   * Role: Admin hoặc có quyền quản lý tem
   */
  app.post("/api/government-stamps/generate", requireAuth, async (req, res) => {
    let connection;
    try {
      const {
        prefix,
        year,
        startNumber,
        quantity,
        productType,
        issuedBy,
        batchNumber,
      } = req.body;

      // Validate
      if (!prefix || !year || !startNumber || !quantity) {
        return res.status(400).json({
          error: "Thiếu thông tin bắt buộc",
        });
      }

      if (quantity > 1000) {
        return res.status(400).json({
          error: "Không thể tạo quá 1000 tem cùng lúc",
        });
      }

      connection = await db.getConnection();
      await connection.beginTransaction();

      const stamps = [];

      // Tạo tem hàng loạt
      for (let i = 0; i < quantity; i++) {
        const serialNumber = String(startNumber + i).padStart(8, "0");
        const qrCode = `${prefix}${year}-${serialNumber}`;

        stamps.push([
          qrCode,
          prefix,
          year,
          serialNumber,
          productType || "DURIAN",
          "AVAILABLE",
          issuedBy || "Bộ Công An",
          batchNumber || `BATCH-${year}-${Date.now()}`,
        ]);
      }

      // Bulk insert
      await connection.query(
        `INSERT INTO government_qr_stamps 
        (qr_code, prefix, issue_year, serial_number, product_type, status, issued_by, batch_number)
        VALUES ?`,
        [stamps],
      );

      await connection.commit();

      res.json({
        success: true,
        message: `Đã tạo ${quantity} tem QR thành công`,
        data: {
          quantity,
          firstCode: stamps[0][0],
          lastCode: stamps[stamps.length - 1][0],
          batchNumber: stamps[0][7],
        },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Generate stamps error:", error);

      if (error.code === "ER_DUP_ENTRY") {
        res.status(400).json({
          error: "Mã QR đã tồn tại. Vui lòng chọn số bắt đầu khác.",
        });
      } else {
        res.status(500).json({
          error: "Không thể tạo tem: " + error.message,
        });
      }
    } finally {
      if (connection) connection.release();
    }
  });

  /**
   * GET /api/government-stamps/list
   * Lấy danh sách tem QR
   */
  app.get("/api/government-stamps/list", requireAuth, async (req, res) => {
    try {
      const { status, productType, limit = 100 } = req.query;

      let query = "SELECT * FROM government_qr_stamps WHERE 1=1";
      const params = [];

      if (status) {
        query += " AND status = ?";
        params.push(status);
      }

      if (productType) {
        query += " AND product_type = ?";
        params.push(productType);
      }

      query += " ORDER BY issued_date DESC, serial_number ASC LIMIT ?";
      params.push(parseInt(limit));

      const [stamps] = await db.query(query, params);

      res.json({
        success: true,
        count: stamps.length,
        data: stamps,
      });
    } catch (error) {
      console.error("List stamps error:", error);
      res.status(500).json({
        error: "Không thể lấy danh sách tem: " + error.message,
      });
    }
  });

  /**
   * POST /api/government-stamps/validate
   * Kiểm tra tem QR có hợp lệ không
   */
  app.post("/api/government-stamps/validate", requireAuth, async (req, res) => {
    try {
      const { qrCode } = req.body;

      if (!qrCode) {
        return res.status(400).json({
          error: "Thiếu mã QR",
        });
      }

      // Validate format
      const qrPattern = /^[A-Z]{2,10}\d{4}-\d{8}$/;
      if (!qrPattern.test(qrCode)) {
        return res.json({
          success: true,
          data: {
            isValid: false,
            status: "INVALID_FORMAT",
            message: "Định dạng mã QR không đúng",
          },
        });
      }

      // Check in database
      const [stamps] = await db.query(
        `SELECT * FROM government_qr_stamps WHERE qr_code = ?`,
        [qrCode],
      );

      if (stamps.length === 0) {
        return res.json({
          success: true,
          data: {
            isValid: false,
            status: "NOT_FOUND",
            message: "Mã QR không tồn tại trong hệ thống",
          },
        });
      }

      const stamp = stamps[0];

      if (stamp.status === "USED") {
        return res.json({
          success: true,
          data: {
            isValid: false,
            status: "USED",
            message: `Tem đã được sử dụng bởi: ${stamp.used_by_user_name || "N/A"}`,
            usedDate: stamp.used_date,
            usedBy: stamp.used_by_user_name,
          },
        });
      }

      if (stamp.status === "EXPIRED") {
        return res.json({
          success: true,
          data: {
            isValid: false,
            status: "EXPIRED",
            message: "Tem đã hết hạn sử dụng",
          },
        });
      }

      if (stamp.status === "REVOKED") {
        return res.json({
          success: true,
          data: {
            isValid: false,
            status: "REVOKED",
            message: "Tem đã bị thu hồi",
          },
        });
      }

      // Valid stamp
      res.json({
        success: true,
        data: {
          isValid: true,
          status: "AVAILABLE",
          message: "Tem hợp lệ và có thể sử dụng",
          stamp: {
            id: stamp.id,
            qrCode: stamp.qr_code,
            productType: stamp.product_type,
            issuedDate: stamp.issued_date,
          },
        },
      });
    } catch (error) {
      console.error("Validate stamp error:", error);
      res.status(500).json({
        error: "Không thể kiểm tra tem: " + error.message,
      });
    }
  });

  /**
   * GET /api/government-stamps/statistics
   * Thống kê tem QR
   */
  app.get(
    "/api/government-stamps/statistics",
    requireAuth,
    async (req, res) => {
      try {
        const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'USED' THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'REVOKED' THEN 1 ELSE 0 END) as revoked
      FROM government_qr_stamps
    `);

        res.json({
          success: true,
          data: stats[0],
        });
      } catch (error) {
        console.error("Statistics error:", error);
        res.status(500).json({
          error: "Không thể lấy thống kê: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/government-stamps/:qrCode/details
   * Xem chi tiết tem QR
   */
  app.get(
    "/api/government-stamps/:qrCode/details",
    requireAuth,
    async (req, res) => {
      try {
        const { qrCode } = req.params;

        const [stamps] = await db.query(
          `SELECT 
          gs.*,
          p.product_qr_code,
          p.weight,
          p.package_type,
          b.batch_name,
          b.sscc
        FROM government_qr_stamps gs
        LEFT JOIN blockchain_products p ON gs.used_for_product_id = p.product_id
        LEFT JOIN blockchain_batches b ON gs.used_for_batch_id = b.batch_id
        WHERE gs.qr_code = ?`,
          [qrCode],
        );

        if (stamps.length === 0) {
          return res.status(404).json({
            error: "Không tìm thấy tem QR",
          });
        }

        res.json({
          success: true,
          data: stamps[0],
        });
      } catch (error) {
        console.error("Details error:", error);
        res.status(500).json({
          error: "Không thể lấy chi tiết: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 6: QUALITY_INSPECTOR - KIỂM NGHIỆM
  // ==========================================

  /**
   * GET /api/quality-inspector/pending-batches
   * Xem lô cần kiểm nghiệm (đã sơ chế xong)
   * Role: QualityInspector (role_id = 5)
   */
  app.get(
    "/api/quality-inspector/pending-batches",
    requireAuth,
    requireRole(ROLES.QUALITY_INSPECTOR),
    async (req, res) => {
      try {
        const [batches] = await db.query(`
        SELECT 
          bb.*,
          u.name as farmer_name,
          p.product_name,
          pr.output_weight,
          pr.method,
          pr.processing_date_iso
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN processing_records pr ON bb.batch_id = pr.batch_id
        WHERE bb.current_stage = 'Processed'
          AND bb.quality_inspector_id = 0
        ORDER BY pr.processing_date_iso DESC
      `);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô cần kiểm nghiệm:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * POST /api/quality-inspector/record-test
   * Ghi nhận kết quả kiểm nghiệm
   * Role: QualityInspector
   */
  app.post(
    "/api/quality-inspector/record-test",
    requireAuth,
    requireRole(ROLES.QUALITY_INSPECTOR),
    upload,
    async (req, res) => {
      let connection;
      try {
        const inspectorId = req.session.userId;
        const {
          batchId,
          passed,
          testType,
          testMethod,
          result,
          standard,
          notes,
        } = req.body;

        if (!batchId || passed === undefined) {
          return res.status(400).json({
            error: "Thiếu thông tin bắt buộc",
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const batchDetails = await traceabilityContract.methods
          .getBatchDetails(batchId)
          .call();

        if (batchDetails.currentStage.toString() !== "3") {
          // Processed
          await connection.rollback();
          return res.status(400).json({
            error: "Lô hàng chưa được sơ chế",
          });
        }

        // Upload images
        const testImages = req.files["testImages"] || [];
        let testImageUrls = [];
        for (const file of testImages) {
          const uploadResult = await uploadFile(file);
          testImageUrls.push(uploadResult.ipfsUrl);
        }

        const isPassed = passed === "true" || passed === true;

        // Gọi contract
        const contractResult = await traceabilityContract.methods
          .recordQualityTest(BigInt(batchId), BigInt(inspectorId), isPassed)
          .send({ from: web3.eth.defaultAccount, gas: 3000000 });

        // Lấy testId từ event
        let testId = null;
        if (contractResult.events?.QualityTestRecorded) {
          testId = Number(
            contractResult.events.QualityTestRecorded.returnValues.testId,
          );
        }

        if (!testId) {
          await connection.rollback();
          return res.status(500).json({
            error: "Không thể lấy testId từ blockchain",
          });
        }

        // ✅ Lấy timestamp từ blockchain
        const receipt = await web3.eth.getTransactionReceipt(
          contractResult.transactionHash,
        );
        const block = await web3.eth.getBlock(receipt.blockNumber);
        const timestamp = Number(block.timestamp);
        const timestampISO = new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        // ✅ INSERT đầy đủ vào quality_tests
        await connection.query(
          `INSERT INTO quality_tests
        (test_id, batch_id, inspector_id, test_date, test_date_iso,
         test_type, test_method, result, passed, standard, notes, blockchain_tx_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          test_type = VALUES(test_type),
          test_method = VALUES(test_method),
          result = VALUES(result),
          passed = VALUES(passed),
          standard = VALUES(standard),
          notes = VALUES(notes)`,
          [
            testId,
            parseInt(batchId),
            parseInt(inspectorId),
            timestamp,
            timestampISO,
            testType || null,
            testMethod || null,
            result || null,
            isPassed,
            standard || null,
            notes || null,
            contractResult.transactionHash,
          ],
        );

        // ✅ INSERT ảnh vào quality_test_images
        if (testImageUrls.length > 0) {
          const imageValues = testImageUrls.map((url) => [testId, url]);
          await connection.query(
            `INSERT INTO quality_test_images (test_id, image_url) VALUES ?`,
            [imageValues],
          );
        }

        // ✅ Update blockchain_batches nếu PASSED
        if (isPassed) {
          await connection.query(
            `UPDATE blockchain_batches 
           SET current_stage = 'QualityInspected', quality_inspector_id = ? 
           WHERE batch_id = ?`,
            [parseInt(inspectorId), parseInt(batchId)],
          );
        }

        // Gọi addQualityTestDetails (off-chain)
        if (testType || testMethod || result || standard) {
          await traceabilityContract.methods
            .addQualityTestDetails(
              BigInt(testId),
              BigInt(batchId),
              testType || "",
              testMethod || "",
              result || "",
              standard || "",
            )
            .send({ from: web3.eth.defaultAccount, gas: 2000000 });
        }

        await connection.commit();

        res.json({
          success: true,
          message: isPassed ? "Sản phẩm ĐẠT chất lượng" : "Sản phẩm KHÔNG ĐẠT",
          data: {
            testId,
            passed: isPassed,
            testType: testType || null,
            testMethod: testMethod || null,
            result: result || null,
            standard: standard || null,
            imageUrls: testImageUrls,
            imageCount: testImageUrls.length,
            transactionHash: contractResult.transactionHash,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        cleanupUploadedFiles(req.files);
        console.error("Lỗi kiểm nghiệm:", error);
        res.status(500).json({
          error: "Không thể ghi nhận kiểm nghiệm: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );
  /**
   * GET /api/quality-inspector/my-tests
   * Xem các lô đã kiểm nghiệm
   * Role: QualityInspector
   */
  app.get(
    "/api/quality-inspector/my-tests",
    requireAuth,
    requireRole(ROLES.QUALITY_INSPECTOR),
    async (req, res) => {
      try {
        const inspectorId = req.session.userId;

        const [tests] = await db.query(
          `
        SELECT 
          bb.*,
          qt.test_id,
          qt.passed,
          qt.test_type,
          qt.test_date_iso,
          u.name as farmer_name,
          p.product_name
        FROM blockchain_batches bb
        INNER JOIN quality_tests qt ON bb.batch_id = qt.batch_id
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        WHERE qt.inspector_id = ?
        ORDER BY qt.test_date_iso DESC
      `,
          [inspectorId],
        );

        res.json({
          success: true,
          count: tests.length,
          data: tests,
        });
      } catch (error) {
        console.error("Lỗi khi lấy danh sách kiểm nghiệm:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 7: TRANSPORTER - VẬN CHUYỂN LẦN 2
  // (Đã xử lý ở trên - sử dụng chung API)
  // ==========================================

  // ==========================================
  // BƯỚC 8: WAREHOUSE - XÁC NHẬN NHẬN HÀNG
  // ==========================================

  /**
   * GET /api/warehouse/incoming-batches
   * Xem lô hàng đang trên đường đến kho
   * Role: Warehouse (role_id = 7)
   */
  app.get(
    "/api/warehouse/incoming-batches",
    requireAuth,
    requireRole(ROLES.WAREHOUSE),
    async (req, res) => {
      try {
        const [batches] = await db.query(`
        SELECT 
          bb.*,
          u.name as farmer_name,
          p.product_name,
          qt.passed as quality_passed,
          te.timestamp_iso as last_transport_update
        FROM blockchain_batches bb
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN (
          SELECT batch_id, MAX(passed) as passed
          FROM quality_tests
          GROUP BY batch_id
        ) qt ON bb.batch_id = qt.batch_id
        LEFT JOIN (
          SELECT batch_id, MAX(timestamp_iso) as timestamp_iso
          FROM transport_events
          GROUP BY batch_id
        ) te ON bb.batch_id = te.batch_id
        WHERE bb.current_stage = 'QualityInspected'
          AND bb.transport_status = 'Delivered'
          AND qt.passed = TRUE
        ORDER BY te.timestamp_iso DESC
      `);

        res.json({
          success: true,
          count: batches.length,
          data: batches,
        });
      } catch (error) {
        console.error("Lỗi khi lấy lô đến kho:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách: " + error.message,
        });
      }
    },
  );

  /**
   * POST /api/warehouse/confirm-receipt
   * Xác nhận đã nhận hàng
   * Role: Warehouse
   */
  app.post(
    "/api/warehouse/confirm-receipt",
    requireAuth,
    requireRole(ROLES.WAREHOUSE),
    async (req, res) => {
      let connection;
      try {
        const warehouseId = req.session.userId;
        const { batchId } = req.body;

        if (!batchId) {
          return res.status(400).json({
            error: "Thiếu batchId",
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const batchDetails = await traceabilityContract.methods
          .getBatchDetails(batchId)
          .call();

        // ✅ Kiểm tra điều kiện chính xác hơn
        if (batchDetails.transportStatus.toString() !== "2") {
          // Delivered
          await connection.rollback();
          return res.status(400).json({
            error: "Lô hàng chưa được giao đến kho",
            currentTransportStatus: batchDetails.transportStatus.toString(),
          });
        }

        // ✅ Kiểm tra đã confirm chưa
        const [existingConfirm] = await connection.query(
          `SELECT id FROM warehouse_confirmations WHERE batch_id = ? AND warehouse_id = ?`,
          [batchId, warehouseId],
        );

        if (existingConfirm.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            error: "Bạn đã xác nhận nhận lô hàng này rồi",
          });
        }

        // Gọi contract
        const result = await traceabilityContract.methods
          .warehouseConfirmation(BigInt(batchId), BigInt(warehouseId))
          .send({ from: web3.eth.defaultAccount, gas: 3000000 });

        // ✅ Lấy timestamp từ blockchain
        const receipt = await web3.eth.getTransactionReceipt(
          result.transactionHash,
        );
        const block = await web3.eth.getBlock(receipt.blockNumber);
        const timestamp = Number(block.timestamp);
        const timestampISO = new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        // ✅ INSERT vào warehouse_confirmations
        await connection.query(
          `INSERT INTO warehouse_confirmations
        (batch_id, warehouse_id, confirmed_at, blockchain_tx_hash)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          confirmed_at = VALUES(confirmed_at),
          blockchain_tx_hash = VALUES(blockchain_tx_hash)`,
          [
            parseInt(batchId),
            parseInt(warehouseId),
            timestampISO,
            result.transactionHash,
          ],
        );

        // ✅ Update blockchain_batches
        await connection.query(
          `UPDATE blockchain_batches 
         SET current_stage = 'Warehoused' 
         WHERE batch_id = ?`,
          [parseInt(batchId)],
        );

        await connection.commit();

        res.json({
          success: true,
          message: "Xác nhận nhận hàng thành công",
          data: {
            batchId,
            warehouseId,
            confirmedAt: timestampISO,
            transactionHash: result.transactionHash,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        console.error("Lỗi xác nhận nhận hàng:", error);
        res.status(500).json({
          error: "Không thể xác nhận: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * GET /api/warehouse/my-inventory
   * Xem hàng tồn kho
   * Role: Warehouse
   */
  app.get(
    "/api/warehouse/my-inventory",
    requireAuth,
    requireRole(ROLES.WAREHOUSE),
    async (req, res) => {
      try {
        const warehouseId = req.session.userId;

        const [inventory] = await db.query(
          `
        SELECT 
          bb.*,
          wc.confirmed_at,
          u.name as farmer_name,
          p.product_name,
          COUNT(bp.product_id) as total_products,
          SUM(CASE WHEN bp.is_active = TRUE THEN 1 ELSE 0 END) as available_products
        FROM blockchain_batches bb
        INNER JOIN warehouse_confirmations wc ON bb.batch_id = wc.batch_id
        LEFT JOIN users u ON bb.producer_id = u.uid
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN blockchain_products bp ON bb.batch_id = bp.batch_id
        WHERE wc.warehouse_id = ?
        GROUP BY bb.batch_id
        ORDER BY wc.confirmed_at DESC
      `,
          [warehouseId],
        );

        res.json({
          success: true,
          count: inventory.length,
          data: inventory,
        });
      } catch (error) {
        console.error("Lỗi khi lấy tồn kho:", error);
        res.status(500).json({
          error: "Không thể lấy tồn kho: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // BƯỚC 9: DISTRIBUTOR - PHÂN PHỐI VÀ BÁN HÀNG
  // ==========================================

  /**
   * GET /api/distributor/available-products
   * Xem sản phẩm có thể phân phối (đã về kho)
   * Role: Distributor (role_id = 8)
   */
  app.get(
    "/api/distributor/available-products",
    requireAuth,
    requireRole(ROLES.DISTRIBUTOR),
    async (req, res) => {
      try {
        const { batchId } = req.query;

        let query = `
        SELECT 
          p.product_id,
          p.product_qr_code,
          p.batch_id,
          p.weight / 1000 as weight_kg,
          p.package_type,
          p.packaged_date_iso,
          b.batch_name,
          b.sscc
        FROM blockchain_products p
        JOIN blockchain_batches b ON p.batch_id = b.batch_id
        WHERE p.is_active = TRUE
      `;

        const params = [];
        if (batchId) {
          query += ` AND p.batch_id = ?`;
          params.push(batchId);
        }

        query += ` ORDER BY p.product_id DESC`;

        const [products] = await db.query(query, params);

        res.json({
          success: true,
          data: {
            productCount: products.length,
            products: products,
          },
        });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({
          error: "Không thể lấy danh sách sản phẩm: " + error.message,
        });
      }
    },
  );

  /**
   * POST /api/distributor/mark-sold
   * Đánh dấu sản phẩm đã bán (Ghi nhận bán hàng)
   * Role: Distributor
   */
  app.post(
    "/api/distributor/mark-sold",
    requireAuth,
    requireRole(ROLES.DISTRIBUTOR),
    async (req, res) => {
      let connection;
      try {
        const distributorId = req.session.userId;
        const { productQRCode, notes } = req.body;

        if (!productQRCode) {
          return res.status(400).json({
            error: "Thiếu mã QR sản phẩm",
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // ✅ Kiểm tra product trong database trước
        const [products] = await connection.query(
          `SELECT product_id, batch_id, is_active, sold_date 
         FROM blockchain_products 
         WHERE product_qr_code = ?`,
          [productQRCode],
        );

        if (products.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            error: "Không tìm thấy sản phẩm",
          });
        }

        const product = products[0];

        if (!product.is_active) {
          await connection.rollback();
          return res.status(400).json({
            error: "Sản phẩm đã được bán",
            soldDate: product.sold_date_iso,
          });
        }

        // ✅ Lấy timestamp hiện tại
        const timestamp = Math.floor(Date.now() / 1000);
        const timestampISO = new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        // ✅ Update blockchain_products
        await connection.query(
          `UPDATE blockchain_products 
         SET is_active = FALSE, 
             sold_date = ?,
             sold_date_iso = ?
         WHERE product_qr_code = ?`,
          [timestamp, timestampISO, productQRCode],
        );

        // ✅ INSERT vào product_sales
        await connection.query(
          `INSERT INTO product_sales 
        (product_id, product_qr_code, batch_id, distributor_id, 
         sold_date, sold_date_iso, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            product.product_id,
            productQRCode,
            product.batch_id,
            distributorId,
            timestamp,
            timestampISO,
            notes || null,
          ],
        );

        await connection.commit();

        res.json({
          success: true,
          message: "Đã đánh dấu sản phẩm đã bán",
          data: {
            productQRCode,
            productId: product.product_id,
            batchId: product.batch_id,
            soldAt: timestampISO,
          },
        });
      } catch (error) {
        if (connection) await connection.rollback();
        console.error("Lỗi khi đánh dấu đã bán:", error);
        res.status(500).json({
          error: "Không thể đánh dấu: " + error.message,
        });
      } finally {
        if (connection) connection.release();
      }
    },
  );

  /**
   * GET /api/distributor/sales-history
   * Xem lịch sử bán hàng
   * Role: Distributor
   */
  app.get(
    "/api/distributor/sales-history",
    requireAuth,
    requireRole(ROLES.DISTRIBUTOR),
    async (req, res) => {
      try {
        const distributorId = req.session.userId;

        const [sales] = await db.query(
          `SELECT 
          ps.id,
          ps.product_qr_code,
          ps.sold_date_iso,
          ps.notes,
          p.weight / 1000 as weight_kg,
          p.package_type,
          b.batch_name,
          b.sscc
        FROM product_sales ps
        JOIN blockchain_products p ON ps.product_id = p.product_id
        JOIN blockchain_batches b ON ps.batch_id = b.batch_id
        WHERE ps.distributor_id = ?
        ORDER BY ps.sold_date_iso DESC
        LIMIT 100`,
          [distributorId],
        );

        res.json({
          success: true,
          data: {
            salesCount: sales.length,
            sales: sales,
          },
        });
      } catch (error) {
        console.error("Error fetching sold products:", error);
        res.status(500).json({
          error: "Không thể lấy lịch sử bán hàng: " + error.message,
        });
      }
    },
  );

  // ==========================================
  // PUBLIC API - TRUY XUẤT NGUỒN GỐC (Người tiêu dùng)
  // ==========================================
  /**
   * POST /api/public/scan-product
   * Scan QR để xem thông tin sản phẩm
   * Public - Không cần auth
   */
  app.post(
    "/api/public/scan-product",
    uploadQR.single("qrImage"),
    async (req, res) => {
      try {
        let productQRCode;

        // Xử lý QR từ image hoặc text
        if (req.file) {
          const image = sharp(req.file.buffer);
          const metadata = await image.metadata();
          const buffer = await image.raw().toBuffer();

          const qr = new QrCode();
          const value = await new Promise((resolve, reject) => {
            qr.callback = (err, v) => (err != null ? reject(err) : resolve(v));
            qr.decode({
              width: metadata.width,
              height: metadata.height,
              data: buffer,
            });
          });

          if (!value.result) {
            return res.status(400).json({
              success: false,
              error: "Không thể đọc mã QR",
            });
          }

          productQRCode = value.result.includes(":")
            ? value.result.split(":")[1]
            : value.result;
        } else if (req.body.productQRCode) {
          productQRCode = req.body.productQRCode;
        } else {
          return res.status(400).json({
            success: false,
            error: "Thiếu mã QR",
          });
        }

        // Lấy thông tin sản phẩm từ database
        const [products] = await db.query(
          `SELECT * FROM blockchain_products WHERE product_qr_code = ?`,
          [productQRCode],
        );

        if (products.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Không tìm thấy sản phẩm",
          });
        }

        const product = products[0];

        // Lấy thông tin batch và các thông tin liên quan
        const [batchInfo] = await db.query(
          `
        SELECT 
          bb.*,
          p.product_name,
          p.description,
          p.price,
          p.img as product_image,
          p.uses,
          p.process,
          
          -- Farmer/Producer info
          producer.name as producer_name,
          producer.phone as producer_phone,
          producer.address as producer_address,
          producer.email as producer_email,
          
          -- Region info
          r.region_name,
          prov.province_name,
          dist.district_name,
          w.ward_name
          
        FROM blockchain_batches bb
        LEFT JOIN products p ON bb.product_type_id = p.product_id
        LEFT JOIN users producer ON bb.producer_id = producer.uid
        LEFT JOIN regions r ON producer.region_id = r.region_id
        LEFT JOIN provinces prov ON producer.province_id = prov.province_id
        LEFT JOIN districts dist ON producer.district_id = dist.district_id
        LEFT JOIN wards w ON producer.ward_id = w.ward_id
        WHERE bb.batch_id = ?
        `,
          [product.batch_id],
        );

        if (batchInfo.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Không tìm thấy thông tin lô hàng",
          });
        }

        // Lấy thông tin cây nguồn gốc
        const [sourceTrees] = await db.query(
          `
        SELECT 
          t.*,
          u.name as farmer_name,
          u.phone as farmer_phone,
          COUNT(DISTINCT tal.log_id) as total_activities
        FROM product_source_trees pst
        INNER JOIN trees t ON pst.tree_id = t.tree_id
        LEFT JOIN users u ON t.farmer_id = u.uid
        LEFT JOIN tree_activity_logs tal ON t.tree_id = tal.tree_id
        WHERE pst.product_id = ?
        GROUP BY t.tree_id
        `,
          [product.product_id],
        );

        // Lấy thông tin thu mua
        const [purchaseInfo] = await db.query(
          `
        SELECT 
          pr.*,
          purchaser.name as purchaser_name,
          purchaser.phone as purchaser_phone,
          purchaser.address as purchaser_address
        FROM purchase_records pr
        LEFT JOIN users purchaser ON pr.purchaser_id = purchaser.uid
        WHERE pr.batch_id = ?
        ORDER BY pr.purchase_date_iso DESC
        LIMIT 1
        `,
          [product.batch_id],
        );

        // Lấy thông tin sơ chế
        const [processingInfo] = await db.query(
          `
        SELECT 
          proc.*,
          processor.name as processor_name,
          processor.phone as processor_phone,
          processor.address as processor_address
        FROM processing_records proc
        LEFT JOIN users processor ON proc.processor_id = processor.uid
        WHERE proc.batch_id = ?
        ORDER BY proc.processing_date_iso DESC
        LIMIT 1
        `,
          [product.batch_id],
        );

        // Lấy phụ gia sơ chế (nếu có) - REMOVED: Bảng processing_additives đã xóa
        let processingAdditives = [];
        // Không còn lấy additives nữa vì bảng đã xóa

        // Lấy kết quả kiểm định chất lượng
        const [qualityTests] = await db.query(
          `
        SELECT 
          qt.*,
          inspector.name as inspector_name,
          inspector.phone as inspector_phone
        FROM quality_tests qt
        LEFT JOIN users inspector ON qt.inspector_id = inspector.uid
        WHERE qt.batch_id = ?
        ORDER BY qt.test_date_iso DESC
        `,
          [product.batch_id],
        );

        // Lấy lịch sử vận chuyển
        const [transportHistory] = await db.query(
          `
        SELECT 
          te.*,
          u.name as participant_name,
          u.phone as participant_phone
        FROM transport_events te
        LEFT JOIN users u ON te.participant_id = u.uid
        WHERE te.batch_id = ?
        ORDER BY te.timestamp_iso ASC
        `,
          [product.batch_id],
        );

        // Lấy thông tin kho
        const [warehouseInfo] = await db.query(
          `
        SELECT 
          wc.*,
          warehouse.name as warehouse_name,
          warehouse.address as warehouse_address,
          warehouse.phone as warehouse_phone
        FROM warehouse_confirmations wc
        LEFT JOIN users warehouse ON wc.warehouse_id = warehouse.uid
        WHERE wc.batch_id = ?
        `,
          [product.batch_id],
        );

        // Lấy ảnh sản phẩm/lô hàng
        const [batchImages] = await db.query(
          `SELECT image_url FROM batch_product_images 
         WHERE batch_id = ? 
         ORDER BY image_order`,
          [product.batch_id],
        );

        // Lấy ảnh chứng nhận (nếu có)
        const certificateImage = batchInfo[0].certificate_image_url || null;

        // Tạo timeline
        const timeline = _generateTimeline(
          batchInfo[0],
          purchaseInfo[0],
          processingInfo[0],
          qualityTests,
          transportHistory,
          warehouseInfo,
        );

        res.json({
          success: true,
          data: {
            // Thông tin sản phẩm
            product: {
              productId: product.product_id,
              productQRCode: product.product_qr_code,
              packagedDate: product.packaged_date_iso,
              packageType: product.package_type,
              weight: product.weight,
              isActive: product.is_active,
              soldDate: product.sold_date_iso,
            },

            // Thông tin lô hàng
            batch: {
              batchId: batchInfo[0].batch_id,
              batchName: batchInfo[0].batch_name,
              sscc: batchInfo[0].sscc,
              status: batchInfo[0].status,
              currentStage: batchInfo[0].current_stage,
              productionDate: batchInfo[0].production_date_iso,
              startDate: batchInfo[0].start_date_iso,
              endDate: batchInfo[0].end_date_iso,
              quantity: batchInfo[0].quantity,
              farmPlotNumber: batchInfo[0].farm_plot_number,
              totalProducts: batchInfo[0].total_products,
              transportStatus: batchInfo[0].transport_status,
              certificateImage: certificateImage,
            },

            // Thông tin sản phẩm
            productType: {
              productName: batchInfo[0].product_name,
              description: batchInfo[0].description,
              price: batchInfo[0].price,
              image: batchInfo[0].product_image,
              uses: batchInfo[0].uses,
              process: batchInfo[0].process,
            },

            // Thông tin nông dân/nhà sản xuất
            producer: {
              name: batchInfo[0].producer_name,
              phone: batchInfo[0].producer_phone,
              address: batchInfo[0].producer_address,
              email: batchInfo[0].producer_email,
              region: batchInfo[0].region_name,
              province: batchInfo[0].province_name,
              district: batchInfo[0].district_name,
              ward: batchInfo[0].ward_name,
            },

            // Thông tin cây nguồn gốc
            sourceTrees: sourceTrees.map((tree) => ({
              treeId: tree.tree_id,
              treeQRCode: tree.tree_qr_code,
              treeType: tree.tree_type,
              variety: tree.variety,
              plantedDate: tree.planted_date_iso,
              coordinates: tree.coordinates,
              farmerName: tree.farmer_name,
              farmerPhone: tree.farmer_phone,
              totalActivities: tree.total_activities,
            })),

            // Thông tin thu mua
            purchase:
              purchaseInfo.length > 0
                ? {
                    purchaserName: purchaseInfo[0].purchaser_name,
                    purchaserPhone: purchaseInfo[0].purchaser_phone,
                    purchaserAddress: purchaseInfo[0].purchaser_address,
                    purchaseDate: purchaseInfo[0].purchase_date_iso,
                    totalQuantity: purchaseInfo[0].total_quantity,
                    pricePerUnit: purchaseInfo[0].price_per_unit,
                    totalPrice: purchaseInfo[0].total_price,
                    qualityGrade: purchaseInfo[0].quality_grade,
                    notes: purchaseInfo[0].notes,
                  }
                : null,

            // Thông tin sơ chế
            processing:
              processingInfo.length > 0
                ? {
                    processorName: processingInfo[0].processor_name,
                    processorPhone: processingInfo[0].processor_phone,
                    processorAddress: processingInfo[0].processor_address,
                    processingDate: processingInfo[0].processing_date_iso,
                    method: processingInfo[0].method,
                    methodDescription: processingInfo[0].method_description,
                    inputWeight: processingInfo[0].input_weight,
                    outputWeight: processingInfo[0].output_weight,
                    // additives removed - bảng processing_additives đã xóa
                    notes: processingInfo[0].notes,
                  }
                : null,

            // Kết quả kiểm định
            qualityTests: qualityTests.map((test) => ({
              testType: test.test_type,
              testMethod: test.test_method,
              testDate: test.test_date_iso,
              result: test.result,
              passed: test.passed,
              standard: test.standard,
              inspectorName: test.inspector_name,
              inspectorPhone: test.inspector_phone,
              notes: test.notes,
            })),

            // Lịch sử vận chuyển
            transportHistory: transportHistory.map((event) => ({
              timestamp: event.timestamp_iso,
              action: event.action,
              participantName: event.participant_name,
              participantPhone: event.participant_phone,
              participantType: event.participant_type,
              location: event.location,
              temperature: event.temperature,
              humidity: event.humidity,
            })),

            // Thông tin kho
            warehouses: warehouseInfo.map((wh) => ({
              warehouseName: wh.warehouse_name,
              warehouseAddress: wh.warehouse_address,
              warehousePhone: wh.warehouse_phone,
              confirmedAt: wh.confirmed_at,
            })),

            // Ảnh
            images: batchImages.map((img) => img.image_url),

            // Timeline
            timeline: timeline,
          },
        });
      } catch (error) {
        console.error("Lỗi khi scan sản phẩm:", error);
        res.status(500).json({
          success: false,
          error: "Không thể lấy thông tin: " + error.message,
        });
      }
    },
  );

  /**
   * GET /api/public/batch/:sscc/full-traceability
   * Xem truy xuất nguồn gốc đầy đủ của lô hàng
   * Public - Không cần auth
   */
  app.get("/api/public/batch/:sscc/full-traceability", async (req, res) => {
    try {
      const sscc = req.params.sscc;

      // Lấy thông tin lô hàng
      const [batches] = await db.query(
        `
      SELECT 
        bb.*,
        p.product_name,
        p.description,
        p.price,
        p.img as product_image,
        p.uses,
        p.process,
        
        -- Producer info
        producer.name as producer_name,
        producer.phone as producer_phone,
        producer.address as producer_address,
        producer.email as producer_email,
        
        -- Region info
        r.region_name,
        prov.province_name,
        dist.district_name,
        w.ward_name
        
      FROM blockchain_batches bb
      LEFT JOIN products p ON bb.product_type_id = p.product_id
      LEFT JOIN users producer ON bb.producer_id = producer.uid
      LEFT JOIN regions r ON producer.region_id = r.region_id
      LEFT JOIN provinces prov ON producer.province_id = prov.province_id
      LEFT JOIN districts dist ON producer.district_id = dist.district_id
      LEFT JOIN wards w ON producer.ward_id = w.ward_id
      WHERE bb.sscc = ?
      `,
        [sscc],
      );

      if (batches.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy lô hàng",
        });
      }

      const batch = batches[0];
      const batchId = batch.batch_id;

      // Lấy thông tin thu mua
      const [purchases] = await db.query(
        `
      SELECT 
        pr.*,
        purchaser.name as purchaser_name,
        purchaser.phone as purchaser_phone,
        purchaser.address as purchaser_address,
        farmer.name as farmer_name
      FROM purchase_records pr
      LEFT JOIN users purchaser ON pr.purchaser_id = purchaser.uid
      LEFT JOIN users farmer ON pr.farmer_id = farmer.uid
      WHERE pr.batch_id = ?
      ORDER BY pr.purchase_date_iso DESC
      `,
        [batchId],
      );

      // Lấy ảnh thu mua
      let purchaseImages = [];
      if (purchases.length > 0) {
        [purchaseImages] = await db.query(
          `SELECT image_url FROM purchase_images WHERE purchase_id = ?`,
          [purchases[0].purchase_id],
        );
      }

      // Lấy thông tin sơ chế
      const [processings] = await db.query(
        `
      SELECT 
        proc.*,
        processor.name as processor_name,
        processor.phone as processor_phone,
        processor.address as processor_address
      FROM processing_records proc
      LEFT JOIN users processor ON proc.processor_id = processor.uid
      WHERE proc.batch_id = ?
      ORDER BY proc.processing_date_iso DESC
      `,
        [batchId],
      );

      // Lấy ảnh sơ chế (không còn bảng processing_additives)
      let processingDetails = [];
      for (const proc of processings) {
        const [images] = await db.query(
          `SELECT image_url FROM processing_images WHERE processing_id = ?`,
          [proc.processing_id],
        );

        processingDetails.push({
          ...proc,
          images: images.map((img) => img.image_url),
        });
      }

      // Lấy kết quả kiểm định
      const [qualityTests] = await db.query(
        `
      SELECT 
        qt.*,
        inspector.name as inspector_name,
        inspector.phone as inspector_phone
      FROM quality_tests qt
      LEFT JOIN users inspector ON qt.inspector_id = inspector.uid
      WHERE qt.batch_id = ?
      ORDER BY qt.test_date_iso DESC
      `,
        [batchId],
      );

      // Lấy ảnh kiểm định
      let qualityTestsWithImages = [];
      for (const test of qualityTests) {
        const [images] = await db.query(
          `SELECT image_url FROM quality_test_images WHERE test_id = ?`,
          [test.test_id],
        );
        qualityTestsWithImages.push({
          ...test,
          images: images.map((img) => img.image_url),
        });
      }

      // Lấy lịch sử vận chuyển
      const [transportEvents] = await db.query(
        `
      SELECT 
        te.*,
        u.name as participant_name,
        u.phone as participant_phone
      FROM transport_events te
      LEFT JOIN users u ON te.participant_id = u.uid
      WHERE te.batch_id = ?
      ORDER BY te.timestamp_iso ASC
      `,
        [batchId],
      );

      // Lấy thông tin kho
      const [warehouses] = await db.query(
        `
      SELECT 
        wc.*,
        warehouse.name as warehouse_name,
        warehouse.address as warehouse_address,
        warehouse.phone as warehouse_phone
      FROM warehouse_confirmations wc
      LEFT JOIN users warehouse ON wc.warehouse_id = warehouse.uid
      WHERE wc.batch_id = ?
      `,
        [batchId],
      );

      // Lấy danh sách sản phẩm
      const [products] = await db.query(
        `SELECT * FROM blockchain_products WHERE batch_id = ? ORDER BY product_id`,
        [batchId],
      );

      // Lấy ảnh lô hàng
      const [batchImages] = await db.query(
        `SELECT image_url FROM batch_product_images 
       WHERE batch_id = ? 
       ORDER BY image_order`,
        [batchId],
      );

      // Lấy activity logs
      const [activityLogs] = await db.query(
        `
      SELECT 
        bal.*,
        u.name as participant_name
      FROM batch_activity_logs bal
      LEFT JOIN users u ON bal.participant_id = u.uid
      WHERE bal.batch_id = ?
      ORDER BY bal.timestamp_iso ASC
      `,
        [batchId],
      );

      // Tạo timeline
      const timeline = _generateDetailedTimeline(
        batch,
        purchases[0],
        processings[0],
        qualityTests,
        transportEvents,
        warehouses,
        activityLogs,
      );

      res.json({
        success: true,
        data: {
          // Thông tin lô hàng
          batch: {
            batchId: batch.batch_id,
            batchName: batch.batch_name,
            sscc: batch.sscc,
            status: batch.status,
            currentStage: batch.current_stage,
            productionDate: batch.production_date_iso,
            startDate: batch.start_date_iso,
            endDate: batch.end_date_iso,
            quantity: batch.quantity,
            farmPlotNumber: batch.farm_plot_number,
            totalProducts: batch.total_products,
            transportStatus: batch.transport_status,
            detailedTransportStatus: batch.detailed_transport_status,
            certificateImage: batch.certificate_image_url,
          },

          // Thông tin sản phẩm
          productType: {
            productName: batch.product_name,
            description: batch.description,
            price: batch.price,
            image: batch.product_image,
            uses: batch.uses,
            process: batch.process,
          },

          // Thông tin nhà sản xuất
          producer: {
            name: batch.producer_name,
            phone: batch.producer_phone,
            address: batch.producer_address,
            email: batch.producer_email,
            region: batch.region_name,
            province: batch.province_name,
            district: batch.district_name,
            ward: batch.ward_name,
          },

          // Thông tin thu mua
          purchase:
            purchases.length > 0
              ? {
                  purchaseDate: purchases[0].purchase_date_iso,
                  purchaserName: purchases[0].purchaser_name,
                  purchaserPhone: purchases[0].purchaser_phone,
                  purchaserAddress: purchases[0].purchaser_address,
                  farmerName: purchases[0].farmer_name,
                  totalQuantity: purchases[0].total_quantity,
                  pricePerUnit: purchases[0].price_per_unit,
                  totalPrice: purchases[0].total_price,
                  qualityGrade: purchases[0].quality_grade,
                  notes: purchases[0].notes,
                  images: purchaseImages.map((img) => img.image_url),
                }
              : null,

          // Thông tin sơ chế
          processing: processingDetails,

          // Kết quả kiểm định
          qualityTests: qualityTestsWithImages.map((test) => ({
            testType: test.test_type,
            testMethod: test.test_method,
            testDate: test.test_date_iso,
            result: test.result,
            passed: test.passed,
            standard: test.standard,
            inspectorName: test.inspector_name,
            inspectorPhone: test.inspector_phone,
            notes: test.notes,
            images: test.images,
          })),

          // Lịch sử vận chuyển
          transportEvents: transportEvents.map((event) => ({
            timestamp: event.timestamp_iso,
            action: event.action,
            participantName: event.participant_name,
            participantPhone: event.participant_phone,
            participantType: event.participant_type,
            location: event.location,
            temperature: event.temperature,
            humidity: event.humidity,
          })),

          // Thông tin kho
          warehouses: warehouses.map((wh) => ({
            warehouseName: wh.warehouse_name,
            warehouseAddress: wh.warehouse_address,
            warehousePhone: wh.warehouse_phone,
            confirmedAt: wh.confirmed_at,
          })),

          // Danh sách sản phẩm
          products: products.map((prod) => ({
            productId: prod.product_id,
            productQRCode: prod.product_qr_code,
            packagedDate: prod.packaged_date_iso,
            packageType: prod.package_type,
            weight: prod.weight,
            isActive: prod.is_active,
            soldDate: prod.sold_date_iso,
          })),

          // Nhật ký hoạt động
          activityLogs: activityLogs.map((log) => ({
            timestamp: log.timestamp_iso,
            category: log.category,
            activityName: log.activity_name,
            description: log.description,
            participantName: log.participant_name,
            isSystemActivity: log.is_system_activity,
          })),

          // Ảnh
          images: batchImages.map((img) => img.image_url),

          // Timeline
          timeline: timeline,
        },
      });
    } catch (error) {
      console.error("Lỗi khi lấy truy xuất:", error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy thông tin: " + error.message,
      });
    }
  });

  /**
   * GET /api/public/product/:productQR/tree-history
   * Xem lịch sử cây nguồn gốc của sản phẩm
   * Public
   */
  app.get("/api/public/product/:productQR/tree-history", async (req, res) => {
    try {
      const productQR = req.params.productQR;

      // Lấy thông tin sản phẩm
      const [products] = await db.query(
        "SELECT product_id, batch_id FROM blockchain_products WHERE product_qr_code = ?",
        [productQR],
      );

      if (products.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy sản phẩm",
        });
      }

      const productId = products[0].product_id;

      // Lấy cây nguồn gốc
      const [trees] = await db.query(
        `
      SELECT 
        t.*,
        u.name as farmer_name,
        u.phone as farmer_phone,
        u.address as farmer_address,
        r.region_name,
        prov.province_name
      FROM product_source_trees pst
      INNER JOIN trees t ON pst.tree_id = t.tree_id
      LEFT JOIN users u ON t.farmer_id = u.uid
      LEFT JOIN regions r ON t.region_id = r.region_id
      LEFT JOIN provinces prov ON r.region_id = prov.province_id
      WHERE pst.product_id = ?
      `,
        [productId],
      );

      // Lấy lịch sử chăm sóc cho từng cây
      const treesWithHistory = await Promise.all(
        trees.map(async (tree) => {
          // Lấy activities
          const [activities] = await db.query(
            `
          SELECT 
            tal.*,
            u.name as participant_name,
            u.phone as participant_phone
          FROM tree_activity_logs tal
          LEFT JOIN users u ON tal.participant_id = u.uid
          WHERE tal.tree_id = ?
          ORDER BY tal.timestamp_iso ASC
          `,
            [tree.tree_id],
          );

          // Lấy ảnh cho mỗi activity
          const activitiesWithImages = await Promise.all(
            activities.map(async (activity) => {
              const [images] = await db.query(
                `SELECT image_url FROM tree_activity_images WHERE log_id = ?`,
                [activity.log_id],
              );
              return {
                ...activity,
                images: images.map((img) => img.image_url),
              };
            }),
          );

          return {
            treeId: tree.tree_id,
            treeQRCode: tree.tree_qr_code,
            treeType: tree.tree_type,
            variety: tree.variety,
            plantedDate: tree.planted_date_iso,
            coordinates: tree.coordinates,
            isActive: tree.is_active,

            // Thông tin nông dân
            farmer: {
              name: tree.farmer_name,
              phone: tree.farmer_phone,
              address: tree.farmer_address,
            },

            // Vị trí
            location: {
              region: tree.region_name,
              province: tree.province_name,
            },

            // Lịch sử hoạt động
            activities: activitiesWithImages.map((act) => ({
              timestamp: act.timestamp_iso,
              category: act.category,
              activityName: act.activity_name,
              description: act.description,
              participantName: act.participant_name,
              participantPhone: act.participant_phone,

              // Metadata
              fertilizer: act.fertilizer,
              pesticide: act.pesticide,
              quantity: act.quantity,
              unit: act.unit,
              temperature: act.temperature,
              humidity: act.humidity,
              weather: act.weather,
              healthStatus: act.health_status,
              notes: act.notes,

              // Ảnh
              images: act.images,
            })),

            totalActivities: activitiesWithImages.length,
          };
        }),
      );

      res.json({
        success: true,
        count: treesWithHistory.length,
        data: treesWithHistory,
      });
    } catch (error) {
      console.error("Lỗi khi lấy lịch sử cây:", error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy lịch sử cây: " + error.message,
      });
    }
  });

  /**
   * GET /api/public/tree/:treeQR/details
   * Xem chi tiết thông tin cây
   * Public
   */
  app.get("/api/public/tree/:treeQR/details", async (req, res) => {
    try {
      const treeQR = req.params.treeQR;

      // Lấy thông tin cây
      const [trees] = await db.query(
        `
      SELECT 
        t.*,
        u.name as farmer_name,
        u.phone as farmer_phone,
        u.address as farmer_address,
        u.email as farmer_email,
        r.region_name,
        prov.province_name,
        dist.district_name,
        w.ward_name
      FROM trees t
      LEFT JOIN users u ON t.farmer_id = u.uid
      LEFT JOIN regions r ON t.region_id = r.region_id
      LEFT JOIN provinces prov ON u.province_id = prov.province_id
      LEFT JOIN districts dist ON u.district_id = dist.district_id
      LEFT JOIN wards w ON u.ward_id = w.ward_id
      WHERE t.tree_qr_code = ?
      `,
        [treeQR],
      );

      if (trees.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy cây",
        });
      }

      const tree = trees[0];

      // Lấy lịch sử hoạt động
      const [activities] = await db.query(
        `
      SELECT 
        tal.*,
        u.name as participant_name,
        u.phone as participant_phone
      FROM tree_activity_logs tal
      LEFT JOIN users u ON tal.participant_id = u.uid
      WHERE tal.tree_id = ?
      ORDER BY tal.timestamp_iso DESC
      `,
        [tree.tree_id],
      );

      // Lấy ảnh cho mỗi activity
      const activitiesWithImages = await Promise.all(
        activities.map(async (activity) => {
          const [images] = await db.query(
            `SELECT image_url FROM tree_activity_images WHERE log_id = ?`,
            [activity.log_id],
          );
          return {
            ...activity,
            images: images.map((img) => img.image_url),
          };
        }),
      );

      // Lấy thông tin harvest (nếu có)
      const [harvests] = await db.query(
        `
      SELECT 
        tbl.*,
        bb.batch_name,
        bb.sscc,
        bb.status
      FROM tree_batch_links tbl
      LEFT JOIN blockchain_batches bb ON tbl.batch_id = bb.batch_id
      WHERE tbl.tree_id = ?
      ORDER BY tbl.harvest_date_iso DESC
      `,
        [tree.tree_id],
      );

      res.json({
        success: true,
        data: {
          tree: {
            treeId: tree.tree_id,
            treeQRCode: tree.tree_qr_code,
            treeType: tree.tree_type,
            variety: tree.variety,
            plantedDate: tree.planted_date_iso,
            coordinates: tree.coordinates,
            isActive: tree.is_active,
          },

          farmer: {
            name: tree.farmer_name,
            phone: tree.farmer_phone,
            address: tree.farmer_address,
            email: tree.farmer_email,
          },

          location: {
            region: tree.region_name,
            province: tree.province_name,
            district: tree.district_name,
            ward: tree.ward_name,
          },

          activities: activitiesWithImages.map((act) => ({
            logId: act.log_id,
            timestamp: act.timestamp_iso,
            category: act.category,
            activityName: act.activity_name,
            description: act.description,
            participantName: act.participant_name,
            participantPhone: act.participant_phone,
            isSystemActivity: act.is_system_activity,

            // Metadata
            fertilizer: act.fertilizer,
            pesticide: act.pesticide,
            quantity: act.quantity,
            unit: act.unit,
            temperature: act.temperature,
            humidity: act.humidity,
            weather: act.weather,
            healthStatus: act.health_status,
            notes: act.notes,

            images: act.images,
          })),

          harvests: harvests.map((h) => ({
            harvestDate: h.harvest_date_iso,
            harvestNotes: h.harvest_notes,
            batchName: h.batch_name,
            sscc: h.sscc,
            batchStatus: h.status,
          })),

          statistics: {
            totalActivities: activities.length,
            totalHarvests: harvests.length,
            daysSincePlanted: Math.floor(
              (new Date() - new Date(tree.planted_date_iso)) /
                (1000 * 60 * 60 * 24),
            ),
          },
        },
      });
    } catch (error) {
      console.error("Lỗi khi lấy thông tin cây:", error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy thông tin cây: " + error.message,
      });
    }
  });

  /**
   * GET /api/public/batch/:sscc/products
   * Lấy danh sách sản phẩm trong lô hàng
   * Public
   */
  app.get("/api/public/batch/:sscc/products", async (req, res) => {
    try {
      const sscc = req.params.sscc;
      const { limit = 50, offset = 0, isActive } = req.query;

      // Lấy batchId
      const [batches] = await db.query(
        "SELECT batch_id, batch_name FROM blockchain_batches WHERE sscc = ?",
        [sscc],
      );

      if (batches.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy lô hàng",
        });
      }

      const batchId = batches[0].batch_id;

      // Build query với filters
      let query = `
      SELECT * FROM blockchain_products 
      WHERE batch_id = ?
    `;
      const params = [batchId];

      if (isActive !== undefined) {
        query += ` AND is_active = ?`;
        params.push(isActive === "true" ? 1 : 0);
      }

      query += ` ORDER BY product_id LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [products] = await db.query(query, params);

      // Đếm tổng số
      let countQuery = `
      SELECT COUNT(*) as total FROM blockchain_products 
      WHERE batch_id = ?
    `;
      const countParams = [batchId];

      if (isActive !== undefined) {
        countQuery += ` AND is_active = ?`;
        countParams.push(isActive === "true" ? 1 : 0);
      }

      const [countResult] = await db.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          batchName: batches[0].batch_name,
          products: products.map((p) => ({
            productId: p.product_id,
            productQRCode: p.product_qr_code,
            packagedDate: p.packaged_date_iso,
            packageType: p.package_type,
            weight: p.weight,
            isActive: p.is_active,
            soldDate: p.sold_date_iso,
          })),
          pagination: {
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + products.length < countResult[0].total,
          },
        },
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách sản phẩm:", error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy danh sách sản phẩm: " + error.message,
      });
    }
  });

  /**
   * =================================================================
   * HELPER FUNCTIONS
   * =================================================================
   */

  /**
   * Tạo timeline từ các sự kiện
   */
  function _generateTimeline(
    batch,
    purchase,
    processing,
    qualityTests,
    transportEvents,
    warehouses,
  ) {
    const timeline = [];

    // 1. Tạo lô hàng
    if (batch) {
      timeline.push({
        timestamp: batch.production_date_iso,
        stage: "Created",
        title: "Tạo lô hàng",
        description: `Lô hàng ${batch.batch_name} được tạo`,
        actor: batch.producer_name,
      });
    }

    // 2. Thu mua
    if (purchase) {
      timeline.push({
        timestamp: purchase.purchase_date_iso,
        stage: "Purchased",
        title: "Thu mua",
        description: `Thu mua ${purchase.total_quantity} kg, chất lượng: ${purchase.quality_grade}`,
        actor: purchase.purchaser_name,
      });
    }

    // 3. Sơ chế
    if (processing) {
      timeline.push({
        timestamp: processing.processing_date_iso,
        stage: "Processed",
        title: "Sơ chế",
        description: `Phương pháp: ${processing.method}`,
        actor: processing.processor_name,
      });
    }

    // 4. Kiểm định chất lượng
    qualityTests.forEach((test) => {
      timeline.push({
        timestamp: test.test_date_iso,
        stage: "QualityInspected",
        title: "Kiểm định chất lượng",
        description: `${test.test_type} - ${test.passed ? "Đạt" : "Không đạt"}`,
        actor: test.inspector_name,
        passed: test.passed,
      });
    });

    // 5. Vận chuyển
    transportEvents.forEach((event) => {
      timeline.push({
        timestamp: event.timestamp_iso,
        stage: "Transport",
        title: "Vận chuyển",
        description: event.action,
        actor: event.participant_name,
        location: event.location,
        temperature: event.temperature,
        humidity: event.humidity,
      });
    });

    // 6. Nhập kho
    warehouses.forEach((wh) => {
      timeline.push({
        timestamp: wh.confirmed_at,
        stage: "Warehoused",
        title: "Nhập kho",
        description: `Nhập kho tại ${wh.warehouse_name}`,
        actor: wh.warehouse_name,
      });
    });

    // Sắp xếp theo thời gian
    return timeline.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );
  }

  /**
   * Tạo timeline chi tiết hơn với activity logs
   */
  function _generateDetailedTimeline(
    batch,
    purchase,
    processing,
    qualityTests,
    transportEvents,
    warehouses,
    activityLogs,
  ) {
    const timeline = _generateTimeline(
      batch,
      purchase,
      processing,
      qualityTests,
      transportEvents,
      warehouses,
    );

    // Thêm activity logs vào timeline
    activityLogs.forEach((log) => {
      if (!log.is_system_activity) {
        timeline.push({
          timestamp: log.timestamp_iso,
          stage: log.category,
          title: log.activity_name,
          description: log.description,
          actor: log.participant_name,
          isCustomActivity: true,
        });
      }
    });

    // Sắp xếp lại
    return timeline.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );
  }

  /**
   * Convert BigInt to String for JSON serialization
   */
  function convertBigIntToString(obj) {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === "bigint") {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => convertBigIntToString(item));
    }

    if (typeof obj === "object") {
      const result = {};
      for (const key in obj) {
        result[key] = convertBigIntToString(obj[key]);
      }
      return result;
    }

    return obj;
  }
}

// Graceful Shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");

  if (blockchainLogger) {
    await blockchainLogger.stop();
  }

  if (db) {
    db.end((err) => {
      if (err) console.error("DB close error:", err);
      console.log("✓ DB closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down...");

  if (blockchainLogger) {
    await blockchainLogger.stop();
  }

  if (db) {
    db.end((err) => {
      if (err) console.error("DB close error:", err);
      console.log("✓ DB closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

module.exports = {
  web3,
  traceabilityContract,
  activityLogContract,
  uploadFile,
  checkFileStatusWithRetry,
  setupRoutes,
  upload,
  activityUpload,
  processFiles,
  checkUserExists,
  checkProductExists,
  getProducerById,
  replacer,
  cleanKeys,
  convertBigIntToString,
  BUCKET_NAME,
  generateTreeQRCode,
  generateQRCodeImage,
  uploadQRCodeToS3,
};
