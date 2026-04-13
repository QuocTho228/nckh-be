// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ActivityLog.sol";

/**
 * Hợp đồng tối ưu: Chỉ lưu dữ liệu quan trọng trên blockchain
 * Chi tiết mở rộng (ảnh, mô tả dài) được lưu off-chain (MySQL)
 */
contract TraceabilityContract {
    ActivityLog private activityLogContract;

    constructor(address _activityLogAddress) {
        require(_activityLogAddress != address(0), "Invalid ActivityLog address");
        activityLogContract = ActivityLog(_activityLogAddress);
    }

    // ===================================
    // COUNTERS
    // ===================================
    uint256 private _batchIdCounter;
    uint256 private _productIdCounter;
    uint256 private _purchaseIdCounter;
    uint256 private _processingIdCounter;
    uint256 private _qualityTestIdCounter;

    // ===================================
    // ENUMS
    // ===================================
    enum SupplyChainStage {
        Created,
        Purchased,
        Transported1,
        Processed,
        QualityInspected,
        Transported2,
        Warehoused,
        DeliveredToConsumer
    }

    enum BatchStatus {
        PendingApproval,
        Approved,
        Rejected
    }

    enum TransportStatus {
        NotTransported,
        InTransit,
        Delivered
    }

    enum DetailedTransportStatus {
        NotStarted,
        InTransit,
        Paused,
        Delivered
    }

    enum ProcessingMethod {
        Washing,
        Cutting,
        Drying,
        Freezing,
        Packaging
    }

    // ===================================
    // OPTIMIZED STRUCTS - Chỉ dữ liệu quan trọng
    // ===================================

    /**
     * @dev Batch - CHỈ lưu thông tin cốt lõi
     * Các trường đã loại bỏ để tiết kiệm gas:
     * - productImageUrls[] -> Lưu MySQL
     * - certificateImageUrl -> Lưu MySQL  
     * - farmPlotNumber -> Lưu MySQL
     * - productIds[] -> Tính toán từ events
     * - warehouseIds[] -> Tính toán từ events
     */
    struct Batch {
        uint256 batchId;
        string sscc;                 // Mã lô (20 chars)
        uint256 producerId;
        uint256 productionDate;
        uint256 startDate;
        uint256 endDate;
        BatchStatus status;
        bytes32 dataHash;            // Hash để verify off-chain data
        uint256 productTypeId;
        
        // Stage tracking
        SupplyChainStage currentStage;
        TransportStatus transportStatus;
        DetailedTransportStatus detailedTransportStatus;
        
        // Participant IDs
        uint256 purchaserId;
        uint256 processorId;
        uint256 qualityInspectorId;
        uint256 lastTransporterId;
        
        // Product count only (không lưu array)
        uint256 totalProducts;
    }

    /**
     * @dev Product - Tối thiểu hóa
     * Loại bỏ: sourceTreeIds[], packageType, soldDate
     * -> Lưu off-chain, link qua events
     */
    struct Product {
        uint256 productId;
        uint256 batchId;
        string governmentQRCode;
        uint256 packagedDate;
        uint256 weight;
        bool isActive;
    }

    /**
     * @dev Purchase - Chỉ số liệu quan trọng
     * Loại bỏ: imageUrls[], notes, qualityGrade
     */
    struct PurchaseRecord {
        uint256 purchaseId;
        uint256 batchId;
        uint256 purchaserId;
        uint256 farmerId;
        uint256 purchaseDate;
        uint256 totalQuantity;       // kg
        uint256 pricePerUnit;        // VND
        uint256 totalPrice;          // VND
        bool isConfirmed;
    }

    /**
     * @dev Processing - Tối thiểu
     * Loại bỏ: methodDescription, additives[], imageUrls[], notes
     */
    struct ProcessingRecord {
        uint256 processingId;
        uint256 batchId;
        uint256 processorId;
        uint256 processingDate;
        ProcessingMethod method;
        uint256 inputWeight;         // kg
        uint256 outputWeight;        // kg
    }

    /**
     * @dev Quality Test - Chỉ kết quả
     */
    struct QualityTest {
        uint256 testId;
        uint256 batchId;
        uint256 inspectorId;
        uint256 testDate;
        bool passed;                 // CHỈ lưu đạt/không đạt
        bytes32 resultHash;          // Hash chi tiết off-chain
    }

    /**
     * @dev Transport Event
     */
    struct TransportEvent {
        uint256 participantId;
        uint256 timestamp;
        uint8 actionCode;            // 0=Start, 1=Pause, 2=Resume, 3=Complete
        int8 temperature;
        uint8 humidity;
    }

    // ===================================
    // MAPPINGS
    // ===================================
    
    mapping(uint256 => Batch) private _batches;
    mapping(string => uint256) private _ssccToBatchId;
    mapping(uint256 => bool) private _approvedBatches;

    mapping(uint256 => Product) private _products;
    mapping(string => uint256) private _governmentQRToProductId;

    mapping(uint256 => PurchaseRecord) private _purchaseRecords;
    mapping(uint256 => ProcessingRecord) private _processingRecords;
    mapping(uint256 => QualityTest[]) private _batchQualityTests;
    mapping(uint256 => TransportEvent[]) private _batchTransportEvents;
    mapping(uint256 => mapping(uint256 => bool)) private _warehouseConfirmations;

    // ===================================
    // EVENTS - Emit để backend sync vào MySQL
    // ===================================
    
    event BatchCreated(
        uint256 indexed batchId,
        string sscc,
        uint256 indexed producerId,
        uint256 productTypeId,
        uint256 productionDate,
        bytes32 dataHash
    );

    event BatchDetailsStored(
        uint256 indexed batchId,
        string name,
        string quantity,
        uint256 startDate,
        uint256 endDate,
        string farmPlotNumber
    );

    event ProductCreated(
        uint256 indexed productId,
        string governmentQRCode,
        uint256 indexed batchId,
        uint256 weight,
        string packageType
    );

    event ProductTreeLinked(
        uint256 indexed productId,
        uint256 indexed treeId
    );

    event BatchApproved(
        uint256 indexed batchId,
        uint256 indexed producerId,
        string sscc
    );

    event BatchRejected(
        uint256 indexed batchId,
        uint256 indexed producerId,
        string sscc,
        string reason
    );

    event StageUpdated(
        uint256 indexed batchId,
        SupplyChainStage newStage,
        uint256 participantId
    );

    event PurchaseRecorded(
        uint256 indexed purchaseId,
        uint256 indexed batchId,
        uint256 purchaserId,
        uint256 totalQuantity,
        uint256 totalPrice
    );

    event PurchaseDetailsStored(
        uint256 indexed purchaseId,
        string qualityGrade,
        string notes
    );

    event ProcessingRecorded(
        uint256 indexed processingId,
        uint256 indexed batchId,
        uint256 processorId,
        ProcessingMethod method
    );

    event ProcessingDetailsStored(
        uint256 indexed processingId,
        string methodDescription,
        string notes
    );

    event QualityTestRecorded(
        uint256 indexed testId,
        uint256 indexed batchId,
        uint256 inspectorId,
        bool passed,
        bytes32 resultHash
    );

    event QualityTestDetailsStored(
        uint256 indexed testId,
        string testType,
        string testMethod,
        string result,
        string standard
    );

    event TransportStatusUpdated(
        uint256 indexed batchId,
        DetailedTransportStatus newStatus,
        uint256 participantId,
        uint8 actionCode
    );

    event TransportDetailsStored(
        uint256 indexed batchId,
        uint256 participantId,
        string action,
        string location,
        string participantType
    );

    event WarehouseConfirmed(
        uint256 indexed batchId,
        uint256 indexed warehouseId
    );

    // ===================================
    // MODIFIERS
    // ===================================
    modifier onlyInStage(uint256 _batchId, SupplyChainStage _requiredStage) {
        require(
            _batches[_batchId].currentStage == _requiredStage,
            "Invalid stage"
        );
        _;
    }

    modifier batchExists(uint256 _batchId) {
        require(_batches[_batchId].batchId != 0, "Batch not exists");
        _;
    }

    modifier batchApproved(uint256 _batchId) {
        require(_batches[_batchId].status == BatchStatus.Approved, "Not approved");
        _;
    }

    // ===================================
    // INTERNAL HELPERS
    // ===================================
    function addSystemActivityLog(
        uint256 _batchId,
        uint256 _participantId,
        string memory _activityName,
        string memory _description
    ) internal {
        activityLogContract.addActivityLog(
            _batchId,
            _participantId,
            _activityName,
            _description,
            true
        );
    }

    // ===================================
    // SSCC GENERATION
    // ===================================
    function generateSSCC(uint256 _producerId) private view returns (string memory) {
        string memory prefix = "00";
        string memory companyPrefix = padLeft(uint2str(_producerId), 6);
        uint256 serialNumber = uint256(keccak256(abi.encodePacked(block.timestamp, _producerId))) % 1000000000;
        string memory serialReference = padLeft(uint2str(serialNumber), 9);
        string memory ssccWithoutCheck = string(abi.encodePacked(prefix, companyPrefix, serialReference));
        uint8 checkDigit = calculateCheckDigit(ssccWithoutCheck);
        return string(abi.encodePacked(ssccWithoutCheck, uint2str(uint256(checkDigit))));
    }

    function padLeft(string memory str, uint256 length) private pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length >= length) return str;
        bytes memory result = new bytes(length);
        uint256 paddingLength = length - strBytes.length;
        for (uint256 i = 0; i < paddingLength; i++) {
            result[i] = bytes1("0");
        }
        for (uint256 i = 0; i < strBytes.length; i++) {
            result[i + paddingLength] = strBytes[i];
        }
        return string(result);
    }

    function calculateCheckDigit(string memory _code) private pure returns (uint8) {
        bytes memory codeBytes = bytes(_code);
        uint256 sum = 0;
        for (uint256 i = 0; i < codeBytes.length; i++) {
            uint8 digit = uint8(codeBytes[i]) - 48;
            sum += (i % 2 == 0) ? digit * 3 : digit;
        }
        return uint8((10 - (sum % 10)) % 10);
    }

    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = 48 + uint8(_i - (_i / 10) * 10);
            bstr[k] = bytes1(temp);
            _i /= 10;
        }
        return string(bstr);
    }

    // ===================================
    // BATCH CREATION - OPTIMIZED
    // ===================================
    
    /**
     * @dev Tạo batch - Tách thành 2 functions để tránh stack too deep
     */
    function createBatch(
        string memory _name,
        uint256 _producerId,
        string memory _quantity,
        uint256 _productTypeId,
        uint256 _startDate,
        uint256 _endDate
    ) public returns (uint256) {
        require(bytes(_name).length > 0, "Name required");
        require(_producerId > 0, "Invalid producer");
        require(_startDate > 0 && _endDate > 0 && _startDate < _endDate, "Invalid dates");

        _batchIdCounter++;
        uint256 newBatchId = _batchIdCounter;
        string memory sscc = generateSSCC(_producerId);
        uint256 productionDate = block.timestamp;
        
        // Calculate hash cho off-chain data
        bytes32 dataHash = keccak256(abi.encodePacked(
            sscc,
            _producerId,
            _quantity,
            productionDate,
            _productTypeId,
            _name
        ));

        // Lưu on-chain (minimal)
        Batch storage batch = _batches[newBatchId];
        batch.batchId = newBatchId;
        batch.sscc = sscc;
        batch.producerId = _producerId;
        batch.productionDate = productionDate;
        batch.startDate = _startDate;
        batch.endDate = _endDate;
        batch.status = BatchStatus.PendingApproval;
        batch.dataHash = dataHash;
        batch.productTypeId = _productTypeId;
        batch.transportStatus = TransportStatus.NotTransported;
        batch.detailedTransportStatus = DetailedTransportStatus.NotStarted;
        batch.currentStage = SupplyChainStage.Created;
        batch.totalProducts = 0;

        _ssccToBatchId[sscc] = newBatchId;

        // Emit event on-chain
        emit BatchCreated(newBatchId, sscc, _producerId, _productTypeId, productionDate, dataHash);
        
        // Emit event off-chain
        emit BatchDetailsStored(newBatchId, _name, _quantity, _startDate, _endDate, "");

        addSystemActivityLog(newBatchId, _producerId, "Batch Created", "New batch created");

        emit StageUpdated(newBatchId, SupplyChainStage.Created, _producerId);

        return newBatchId;
    }

    // ===================================
    // PRODUCT CREATION - OPTIMIZED
    // ===================================
    
    /**
    * @dev Tạo sản phẩm đơn lẻ với Government QR Codes
    * Thêm parameter governmentQRCodes
    */
    function createProductsInBatch(
        uint256 _batchId,
        string[] memory _governmentQRCodes,
        uint256[] memory _sourceTreeIds,
        uint256[] memory _weights,
        string memory _packageType
    ) public batchExists(_batchId) returns (uint256[] memory) {
        require(_governmentQRCodes.length == _sourceTreeIds.length, "Length mismatch");
        require(_sourceTreeIds.length == _weights.length, "Length mismatch");
        require(_batches[_batchId].currentStage >= SupplyChainStage.Processed, "Must be processed");

        uint256[] memory newProductIds = new uint256[](_weights.length);

        for (uint256 i = 0; i < _weights.length; i++) {
            newProductIds[i] = _createSingleProduct(
                _batchId,
                _governmentQRCodes[i],
                _sourceTreeIds[i],
                _weights[i],
                _packageType
            );
        }

        return newProductIds;
    }

    function _createSingleProduct(
        uint256 _batchId,
        string memory _governmentQRCode,
        uint256 _sourceTreeId,
        uint256 _weight,
        string memory _packageType
    ) private returns (uint256) {
        // Kiểm tra government QR chưa được sử dụng
        require(_governmentQRToProductId[_governmentQRCode] == 0, "Government QR already used");
        
        _productIdCounter++;
        uint256 newProductId = _productIdCounter;

        // Lưu on-chain (minimal)
        Product storage newProduct = _products[newProductId];
        newProduct.productId = newProductId;
        newProduct.batchId = _batchId;
        newProduct.governmentQRCode = _governmentQRCode;
        newProduct.packagedDate = block.timestamp;
        newProduct.weight = _weight;
        newProduct.isActive = true;

        _governmentQRToProductId[_governmentQRCode] = newProductId;
        _batches[_batchId].totalProducts++;

        // Emit events
        emit ProductCreated(newProductId, _governmentQRCode, _batchId, _weight, _packageType);
        emit ProductTreeLinked(newProductId, _sourceTreeId);

        // Link tree to batch
        activityLogContract.linkTreeToBatch(
            _sourceTreeId,
            _batchId,
            _batches[_batchId].producerId,
            string(abi.encodePacked("Harvested to product ", _governmentQRCode))
        );

        return newProductId;
    }

    // ===================================
    // STAGE 1: APPROVE/REJECT
    // ===================================
    
    function approveBatch(uint256 _batchId, uint256 _approverId) 
        public 
        batchExists(_batchId) 
    {
        require(_batches[_batchId].status == BatchStatus.PendingApproval, "Not pending");
        require(_batches[_batchId].producerId == _approverId, "Not producer of batch");

        _batches[_batchId].status = BatchStatus.Approved;
        _approvedBatches[_batchId] = true;

        addSystemActivityLog(_batchId, _approverId, "Batch Approved", "Approved");

        emit BatchApproved(_batchId, _batches[_batchId].producerId, _batches[_batchId].sscc);
    }

    function rejectBatch(uint256 _batchId, uint256 _approverId, string memory _reason) 
        public 
        batchExists(_batchId) 
    {
        require(_batches[_batchId].status == BatchStatus.PendingApproval, "Not pending");
        require(_batches[_batchId].producerId == _approverId, "Not producer of batch");

        _batches[_batchId].status = BatchStatus.Rejected;

        addSystemActivityLog(_batchId, _approverId, "Batch Rejected", _reason);

        emit BatchRejected(_batchId, _batches[_batchId].producerId, _batches[_batchId].sscc, _reason);
    }

    // ===================================
    // STAGE 2: PURCHASE - OPTIMIZED
    // ===================================
    
    /**
     * @dev Record purchase - Tách thành 2 functions
     */
    function recordPurchase(
        uint256 _batchId,
        uint256 _purchaserId,
        uint256 _totalQuantity,
        uint256 _pricePerUnit
    ) public 
        batchExists(_batchId)
        batchApproved(_batchId)
        onlyInStage(_batchId, SupplyChainStage.Created)
        returns (uint256) 
    {
        _purchaseIdCounter++;
        uint256 newPurchaseId = _purchaseIdCounter;

        // Lưu on-chain (minimal)
        PurchaseRecord storage purchase = _purchaseRecords[_batchId];
        purchase.purchaseId = newPurchaseId;
        purchase.batchId = _batchId;
        purchase.purchaserId = _purchaserId;
        purchase.farmerId = _batches[_batchId].producerId;
        purchase.purchaseDate = block.timestamp;
        purchase.totalQuantity = _totalQuantity;
        purchase.pricePerUnit = _pricePerUnit;
        purchase.totalPrice = _totalQuantity * _pricePerUnit;
        purchase.isConfirmed = true;

        _batches[_batchId].currentStage = SupplyChainStage.Purchased;
        _batches[_batchId].purchaserId = _purchaserId;

        // Emit events
        emit PurchaseRecorded(newPurchaseId, _batchId, _purchaserId, _totalQuantity, purchase.totalPrice);

        addSystemActivityLog(_batchId, _purchaserId, "Purchase Recorded", "Purchased");

        emit StageUpdated(_batchId, SupplyChainStage.Purchased, _purchaserId);

        return newPurchaseId;
    }

    /**
     * @dev Add purchase details
     */
    function addPurchaseDetails(
        uint256 _purchaseId,
        string memory _qualityGrade,
        string memory _notes
    ) public {
        emit PurchaseDetailsStored(_purchaseId, _qualityGrade, _notes);
    }

    // ===================================
    // STAGE 3: TRANSPORT
    // ===================================
    
    /**
     * @dev Update transport status - Tách thành 2 functions
     */
    function updateTransportStatus(
        uint256 _batchId,
        uint256 _participantId,
        uint8 _actionCode,
        int8 _temperature,
        uint8 _humidity
    ) public batchExists(_batchId) batchApproved(_batchId) {
        Batch storage batch = _batches[_batchId];

        // Lưu on-chain (minimal)
        _batchTransportEvents[_batchId].push(TransportEvent({
            participantId: _participantId,
            timestamp: block.timestamp,
            actionCode: _actionCode,
            temperature: _temperature,
            humidity: _humidity
        }));

        // Action: 0=Start, 1=Pause, 2=Resume, 3=Complete
        if (_actionCode == 0) {
            batch.detailedTransportStatus = DetailedTransportStatus.InTransit;
            batch.transportStatus = TransportStatus.InTransit;
            batch.lastTransporterId = _participantId;
        } else if (_actionCode == 1) {
            batch.detailedTransportStatus = DetailedTransportStatus.Paused;
        } else if (_actionCode == 2) {
            batch.detailedTransportStatus = DetailedTransportStatus.InTransit;
        } else if (_actionCode == 3) {
            batch.detailedTransportStatus = DetailedTransportStatus.Delivered;
            batch.transportStatus = TransportStatus.Delivered;

            if (batch.currentStage == SupplyChainStage.Purchased) {
                batch.currentStage = SupplyChainStage.Transported1;
                emit StageUpdated(_batchId, SupplyChainStage.Transported1, _participantId);
            } else if (batch.currentStage == SupplyChainStage.QualityInspected) {
                batch.currentStage = SupplyChainStage.Transported2;
                emit StageUpdated(_batchId, SupplyChainStage.Transported2, _participantId);
            }
        }

        // Emit event
        emit TransportStatusUpdated(_batchId, batch.detailedTransportStatus, _participantId, _actionCode);

        addSystemActivityLog(_batchId, _participantId, "Transport Updated", "Updated");
    }

    /**
     * @dev Add transport details
     */
    function addTransportDetails(
        uint256 _batchId,
        uint256 _participantId,
        string memory _action,
        string memory _location,
        string memory _participantType
    ) public {
        emit TransportDetailsStored(_batchId, _participantId, _action, _location, _participantType);
    }

    // ===================================
    // STAGE 4: PROCESSING
    // ===================================
    
    /**
     * @dev Record processing - Tách thành 2 functions
     */
    function recordProcessing(
        uint256 _batchId,
        uint256 _processorId,
        ProcessingMethod _method,
        uint256 _inputWeight,
        uint256 _outputWeight
    ) public 
        batchExists(_batchId)
        returns (uint256) 
    {
        require(
            _batches[_batchId].currentStage == SupplyChainStage.Purchased || 
            _batches[_batchId].currentStage == SupplyChainStage.Transported1,
            "Invalid stage"
        );

        _processingIdCounter++;
        uint256 newProcessingId = _processingIdCounter;

        // Lưu on-chain (minimal)
        ProcessingRecord storage processing = _processingRecords[_batchId];
        processing.processingId = newProcessingId;
        processing.batchId = _batchId;
        processing.processorId = _processorId;
        processing.processingDate = block.timestamp;
        processing.method = _method;
        processing.inputWeight = _inputWeight;
        processing.outputWeight = _outputWeight;

        _batches[_batchId].currentStage = SupplyChainStage.Processed;
        _batches[_batchId].processorId = _processorId;

        // Emit events
        emit ProcessingRecorded(newProcessingId, _batchId, _processorId, _method);

        addSystemActivityLog(_batchId, _processorId, "Processing Completed", "Completed");

        emit StageUpdated(_batchId, SupplyChainStage.Processed, _processorId);

        return newProcessingId;
    }

    /**
     * @dev Add processing details
     */
    function addProcessingDetails(
        uint256 _processingId,
        string memory _methodDescription,
        string memory _notes
    ) public {
        emit ProcessingDetailsStored(_processingId, _methodDescription, _notes);
    }

    // ===================================
    // STAGE 5: QUALITY INSPECTION - OPTIMIZED
    // ===================================
    
    /**
     * @dev Record quality test - Tách thành 2 functions
     */
    function recordQualityTest(
        uint256 _batchId,
        uint256 _inspectorId,
        bool _passed
    ) public 
        batchExists(_batchId)
        onlyInStage(_batchId, SupplyChainStage.Processed)
        returns (uint256) 
    {
        _qualityTestIdCounter++;
        uint256 newTestId = _qualityTestIdCounter;

        // Lưu on-chain (minimal)
        QualityTest memory test = QualityTest({
            testId: newTestId,
            batchId: _batchId,
            inspectorId: _inspectorId,
            testDate: block.timestamp,
            passed: _passed,
            resultHash: bytes32(0) // Sẽ update sau
        });

        _batchQualityTests[_batchId].push(test);

        if (_passed) {
            _batches[_batchId].currentStage = SupplyChainStage.QualityInspected;
            _batches[_batchId].qualityInspectorId = _inspectorId;

            addSystemActivityLog(_batchId, _inspectorId, "Quality Test Passed", "Passed");

            emit StageUpdated(_batchId, SupplyChainStage.QualityInspected, _inspectorId);
        } else {
            addSystemActivityLog(_batchId, _inspectorId, "Quality Test Failed", "Failed");
        }

        emit QualityTestRecorded(newTestId, _batchId, _inspectorId, _passed, bytes32(0));

        return newTestId;
    }

    /**
     * @dev Add quality test details
     */
    function addQualityTestDetails(
        uint256 _testId,
        uint256 _batchId,
        string memory _testType,
        string memory _testMethod,
        string memory _result,
        string memory _standard
    ) public {
        // Hash chi tiết kết quả
        bytes32 resultHash = keccak256(abi.encodePacked(
            _testType,
            _testMethod,
            _result,
            _standard
        ));

        // Update resultHash
        QualityTest[] storage tests = _batchQualityTests[_batchId];
        for (uint256 i = 0; i < tests.length; i++) {
            if (tests[i].testId == _testId) {
                tests[i].resultHash = resultHash;
                break;
            }
        }

        // Emit event
        emit QualityTestDetailsStored(_testId, _testType, _testMethod, _result, _standard);
    }

    // ===================================
    // STAGE 6: WAREHOUSE CONFIRMATION
    // ===================================
    
    function warehouseConfirmation(uint256 _batchId, uint256 _warehouseId) 
        public 
        batchExists(_batchId) 
    {
        require(_batches[_batchId].transportStatus == TransportStatus.Delivered, "Not delivered");
        require(!_warehouseConfirmations[_batchId][_warehouseId], "Already confirmed");

        _warehouseConfirmations[_batchId][_warehouseId] = true;
        _batches[_batchId].currentStage = SupplyChainStage.Warehoused;

        addSystemActivityLog(_batchId, _warehouseId, "Warehouse Confirmed", "Received");

        emit WarehouseConfirmed(_batchId, _warehouseId);
        emit StageUpdated(_batchId, SupplyChainStage.Warehoused, _warehouseId);
    }

    // ===================================
    // GETTERS - BATCH
    // ===================================
    
    function getBatchDetails(uint256 _batchId) public view batchExists(_batchId) returns (Batch memory) {
        return _batches[_batchId];
    }

    function getBatchBySSCC(string memory _sscc) public view returns (Batch memory) {
        uint256 batchId = _ssccToBatchId[_sscc];
        require(batchId != 0, "Batch not found");
        return _batches[batchId];
    }

    function getBatchIdBySSCC(string memory _sscc) public view returns (uint256) {
        return _ssccToBatchId[_sscc];
    }

    function isBatchApproved(uint256 _batchId) public view returns (bool) {
        return _approvedBatches[_batchId];
    }

    function getCurrentStage(uint256 _batchId) public view batchExists(_batchId) returns (SupplyChainStage) {
        return _batches[_batchId].currentStage;
    }

    function getBatchTransportStatus(uint256 _batchId) public view batchExists(_batchId) returns (TransportStatus) {
        return _batches[_batchId].transportStatus;
    }

    function getDetailedTransportStatus(uint256 _batchId) public view batchExists(_batchId) returns (DetailedTransportStatus) {
        return _batches[_batchId].detailedTransportStatus;
    }

    function getTotalBatches() public view returns (uint256) {
        return _batchIdCounter;
    }

    // ===================================
    // GETTERS - PRODUCT
    // ===================================
    
    function getProductByGovernmentQR(string memory _governmentQR) public view returns (Product memory) {
        uint256 productId = _governmentQRToProductId[_governmentQR];
        require(productId != 0, "Product not found");
        return _products[productId];
    }

    function getProductDetails(uint256 _productId) public view returns (Product memory) {
        require(_products[_productId].productId != 0, "Product not exists");
        return _products[_productId];
    }

    function getTotalProducts() public view returns (uint256) {
        return _productIdCounter;
    }

    function getBatchProductCount(uint256 _batchId) public view batchExists(_batchId) returns (uint256) {
        return _batches[_batchId].totalProducts;
    }

    // ===================================
    // GETTERS - PURCHASE
    // ===================================
    
    function getPurchaseRecord(uint256 _batchId) public view batchExists(_batchId) returns (PurchaseRecord memory) {
        require(_purchaseRecords[_batchId].purchaseId != 0, "No purchase record");
        return _purchaseRecords[_batchId];
    }

    // ===================================
    // GETTERS - PROCESSING
    // ===================================
    
    function getProcessingRecord(uint256 _batchId) public view batchExists(_batchId) returns (ProcessingRecord memory) {
        require(_processingRecords[_batchId].processingId != 0, "No processing record");
        return _processingRecords[_batchId];
    }

    // ===================================
    // GETTERS - QUALITY TEST
    // ===================================
    
    function getBatchQualityTests(uint256 _batchId) public view batchExists(_batchId) returns (QualityTest[] memory) {
        return _batchQualityTests[_batchId];
    }

    function getLatestQualityTest(uint256 _batchId) public view batchExists(_batchId) returns (QualityTest memory) {
        QualityTest[] memory tests = _batchQualityTests[_batchId];
        require(tests.length > 0, "No quality tests");
        return tests[tests.length - 1];
    }

    // ===================================
    // GETTERS - TRANSPORT
    // ===================================
    
    function getTransportEvents(uint256 _batchId) public view batchExists(_batchId) returns (TransportEvent[] memory) {
        return _batchTransportEvents[_batchId];
    }

    function getTransportHistoryBySSCC(string memory _sscc) public view returns (TransportEvent[] memory) {
        uint256 batchId = _ssccToBatchId[_sscc];
        require(batchId != 0, "Batch not found");
        return _batchTransportEvents[batchId];
    }

    // ===================================
    // GETTERS - WAREHOUSE
    // ===================================
    
    function isWarehouseConfirmed(uint256 _batchId, uint256 _warehouseId) public view returns (bool) {
        return _warehouseConfirmations[_batchId][_warehouseId];
    }

    // ===================================
    // GETTERS - ACTIVITY LOGS
    // ===================================
    
    function getActivityLogs(uint256 _batchId) public view returns (ActivityLog.ActivityLogEntry[] memory) {
        return activityLogContract.getActivityLogs(_batchId);
    }

    function getSystemActivityLogs(uint256 _batchId) public view returns (ActivityLog.ActivityLogEntry[] memory) {
        return activityLogContract.getSystemActivityLogs(_batchId);
    }

    // ===================================
    // BATCH QUERIES
    // ===================================
    
    function getBatchesByProducer(uint256 _producerId) public view returns (Batch[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].producerId == _producerId) {
                count++;
            }
        }

        Batch[] memory batches = new Batch[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].producerId == _producerId) {
                batches[index] = _batches[i];
                index++;
            }
        }
        return batches;
    }

    function getBatchesByStage(SupplyChainStage _stage) public view returns (Batch[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].currentStage == _stage) {
                count++;
            }
        }

        Batch[] memory batches = new Batch[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].currentStage == _stage) {
                batches[index] = _batches[i];
                index++;
            }
        }
        return batches;
    }

    function getAllPendingBatches() public view returns (Batch[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].status == BatchStatus.PendingApproval) {
                count++;
            }
        }

        Batch[] memory batches = new Batch[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].status == BatchStatus.PendingApproval) {
                batches[index] = _batches[i];
                index++;
            }
        }
        return batches;
    }

    function getApprovedBatchesByProducer(uint256 _producerId) public view returns (Batch[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].producerId == _producerId && _batches[i].status == BatchStatus.Approved) {
                count++;
            }
        }

        Batch[] memory batches = new Batch[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= _batchIdCounter; i++) {
            if (_batches[i].producerId == _producerId && _batches[i].status == BatchStatus.Approved) {
                batches[index] = _batches[i];
                index++;
            }
        }
        return batches;
    }

    // ===================================
    // UTILITY FUNCTIONS
    // ===================================
    
    function ssccExists(string memory _sscc) public view returns (bool) {
        return _ssccToBatchId[_sscc] != 0;
    }

    function governmentQRExists(string memory _governmentQR) public view returns (bool) {
        return _governmentQRToProductId[_governmentQR] != 0;
    }

    function isProducerOfBatch(uint256 _batchId, uint256 _producerId) public view returns (bool) {
        return _batches[_batchId].producerId == _producerId;
    }

    /**
     * @dev Verify off-chain data hash
     * Frontend/Backend có thể verify data integrity
     */
    function verifyBatchDataHash(
        uint256 _batchId,
        string memory _sscc,
        uint256 _producerId,
        string memory _quantity,
        uint256 _productionDate,
        string memory _farmPlotNumber,
        uint256 _productTypeId,
        string memory _name
    ) public view returns (bool) {
        bytes32 calculatedHash = keccak256(abi.encodePacked(
            _sscc,
            _producerId,
            _quantity,
            _productionDate,
            _farmPlotNumber,
            _productTypeId,
            _name
        ));
        
        return _batches[_batchId].dataHash == calculatedHash;
    }
}