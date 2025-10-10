const { ethers } = require("ethers");
const fs = require("fs");

// ABI của TraceabilityContract
const traceabilityContractABI = [
  "event BatchCreated(uint256 indexed batchId, string sscc, uint256 producerId)",
  "event BatchApproved(uint256 indexed batchId, uint256 indexed producerId, string sscc)",
  "event ActivityLogAdded(uint256 indexed batchId, uint256 indexed participantId, string activityName, string description, bool isSystemGenerated, string[] imageUrls, uint256[] relatedProductIds)",
  "event TransportStatusUpdated(uint256 indexed batchId, uint8 newStatus, string action, uint256 participantId, string participantType)",
  "event WarehouseConfirmed(uint256 indexed batchId, uint256 indexed warehouseId)"
];

// ABI của ActivityLog
const activityLogContractABI = [
  "event ActivityLogAdded(uint256 indexed batchId, uint256 indexed participantId, string activityName, string description, bool isSystemGenerated, string[] imageUrls, uint256[] relatedProductIds)"
];

// Địa chỉ của TraceabilityContract và ActivityLog đã triển khai
const traceabilityContractAddress = "0x5b1869D9A4C187F2EAa108f3062412ecf0526b24"; // Thay bằng địa chỉ thật
const activityLogContractAddress = "0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab"; // Thay bằng địa chỉ thật
const providerUrl = "http://127.0.0.1:8545"; // URL của node cục bộ
const outputFile = "contract_logs.json";

async function autoExportLogs() {
  try {
    // Kết nối với node Ethereum cục bộ
    const provider = new ethers.JsonRpcProvider(providerUrl);

    // Tạo instance của TraceabilityContract và ActivityLog
    const traceabilityContract = new ethers.Contract(traceabilityContractAddress, traceabilityContractABI, provider);
    const activityLogContract = new ethers.Contract(activityLogContractAddress, activityLogContractABI, provider);

    // Đọc file JSON hiện tại (nếu có)
    let logs = [];
    if (fs.existsSync(outputFile)) {
      const fileContent = fs.readFileSync(outputFile, "utf8");
      logs = JSON.parse(fileContent);
    }

    // Hàm lưu sự kiện vào file JSON
    const saveLogToFile = async (event) => {
      const block = await provider.getBlock(event.blockNumber);
      const logEntry = {
        eventName: event.eventName,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: event.args,
        timestamp: new Date(block.timestamp * 1000).toISOString()
      };

      // Thêm sự kiện mới vào danh sách logs
      logs.push(logEntry);

      // Ghi lại vào file JSON
      fs.writeFileSync(outputFile, JSON.stringify(logs, null, 2));
      console.log(`Đã lưu sự kiện ${event.eventName} vào ${outputFile}`);
    };

    // Lắng nghe các sự kiện từ TraceabilityContract
    console.log("Bắt đầu lắng nghe các sự kiện từ TraceabilityContract...");
    traceabilityContract.on("BatchCreated", async (batchId, sscc, producerId, event) => {
      await saveLogToFile({
        eventName: "BatchCreated",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: { batchId: batchId.toString(), sscc, producerId: producerId.toString() }
      });
    });

    traceabilityContract.on("BatchApproved", async (batchId, producerId, sscc, event) => {
      await saveLogToFile({
        eventName: "BatchApproved",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: { batchId: batchId.toString(), producerId: producerId.toString(), sscc }
      });
    });

    traceabilityContract.on("ActivityLogAdded", async (batchId, participantId, activityName, description, isSystemGenerated, imageUrls, relatedProductIds, event) => {
      await saveLogToFile({
        eventName: "ActivityLogAdded",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: {
          batchId: batchId.toString(),
          participantId: participantId.toString(),
          activityName,
          description,
          isSystemGenerated,
          imageUrls,
          relatedProductIds: relatedProductIds.map(id => id.toString())
        }
      });
    });

    traceabilityContract.on("TransportStatusUpdated", async (batchId, newStatus, action, participantId, participantType, event) => {
      await saveLogToFile({
        eventName: "TransportStatusUpdated",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: {
          batchId: batchId.toString(),
          newStatus: newStatus.toString(),
          action,
          participantId: participantId.toString(),
          participantType
        }
      });
    });

    traceabilityContract.on("WarehouseConfirmed", async (batchId, warehouseId, event) => {
      await saveLogToFile({
        eventName: "WarehouseConfirmed",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: { batchId: batchId.toString(), warehouseId: warehouseId.toString() }
      });
    });

    // Lắng nghe các sự kiện từ ActivityLog
    console.log("Bắt đầu lắng nghe các sự kiện từ ActivityLog...");
    activityLogContract.on("ActivityLogAdded", async (batchId, participantId, activityName, description, isSystemGenerated, imageUrls, relatedProductIds, event) => {
      await saveLogToFile({
        eventName: "ActivityLogAdded",
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: {
          batchId: batchId.toString(),
          participantId: participantId.toString(),
          activityName,
          description,
          isSystemGenerated,
          imageUrls,
          relatedProductIds: relatedProductIds.map(id => id.toString())
        }
      });
    });

    // Giữ script chạy liên tục
    console.log("Script đang chạy và chờ các sự kiện mới...");
  } catch (error) {
    console.error("Lỗi khi thiết lập lắng nghe sự kiện:", error);
  }
}

// Chạy hàm
autoExportLogs();