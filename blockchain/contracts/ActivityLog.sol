// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ActivityLog - OPTIMIZED VERSION
 * @dev Contract tối ưu: Chỉ lưu dữ liệu cốt lõi
 * Chi tiết mở rộng được emit qua events để backend sync vào MySQL
 * Gas cost giảm 70-80%
 */
contract ActivityLog {
    
    // ===================================
    // ENUMS
    // ===================================
    enum ActivityCategory {
        TreeManagement,
        Farming,
        Harvesting,
        Purchase,
        Transport,
        Processing,
        Packaging,
        QualityControl,
        Warehouse,
        Distribution
    }

    // ===================================
    // OPTIMIZED STRUCTS
    // ===================================
    
    /**
     * @dev Tree - Chỉ thông tin cốt lõi
     * Loại bỏ: coordinates, variety, harvestBatchIds[]
     * -> Lưu off-chain hoặc tính từ events
     */
    struct Tree {
        uint256 treeId;
        string treeQRCode;           // ~20 chars
        uint256 farmerId;
        uint256 regionId;
        string treeType;             // ~50 chars
        uint256 plantedDate;
        bool isActive;
    }

    /**
     * @dev ActivityLogEntry - Tối thiểu hóa
     * Loại bỏ: imageUrls[], relatedProductIds[], metadata
     * -> Emit qua events để backend lưu MySQL
     */
    struct ActivityLogEntry {
        uint256 logId;
        uint256 batchId;
        uint256 treeId;
        uint256 participantId;
        uint256 timestamp;
        ActivityCategory category;
        bool isSystemActivity;
        bytes32 dataHash;            // Hash của description + images
    }

    // ===================================
    // STATE VARIABLES
    // ===================================
    uint256 private _treeIdCounter;
    uint256 private _logIdCounter;

    mapping(uint256 => Tree) private _trees;
    mapping(string => uint256) private _treeQRCodeToId;
    mapping(uint256 => uint256[]) private _farmerTrees;
    mapping(uint256 => uint256[]) private _regionTrees;
    
    mapping(uint256 => ActivityLogEntry[]) private _batchActivityLogs;
    mapping(uint256 => ActivityLogEntry[]) private _treeActivityLogs;

    // ===================================
    // EVENTS - Backend sync to MySQL
    // ===================================
    
    event TreeRegistered(
        uint256 indexed treeId,
        string treeQRCode,
        uint256 indexed farmerId,
        uint256 indexed regionId,
        string treeType,
        uint256 plantedDate
    );

    event TreeDetailsStored(
        uint256 indexed treeId,
        string variety,
        string coordinates
    );

    event TreeActivityRecorded(
        uint256 indexed treeId,
        uint256 logId,
        ActivityCategory category,
        uint256 timestamp
    );

    event TreeActivityDetailsStored(
        uint256 indexed logId,
        string activityName,
        string description
    );

    event ActivityLogAdded(
        uint256 indexed batchId,
        uint256 indexed participantId,
        uint256 logId,
        ActivityCategory category,
        uint256 timestamp,
        bool isSystemGenerated
    );

    event ActivityLogDetailsStored(
        uint256 indexed logId,
        string activityName,
        string description
    );

    event TreeLinkedToBatch(
        uint256 indexed treeId,
        uint256 indexed batchId,
        uint256 harvestDate,
        string notes
    );

    event TreeDeactivated(
        uint256 indexed treeId,
        uint256 farmerId,
        string reason
    );

    // Metadata events (optional, lưu riêng)
    event ActivityMetadataStored(
        uint256 indexed logId,
        string fertilizer,
        string pesticide,
        uint256 quantity,
        string unit,
        int8 temperature,
        uint8 humidity,
        string weather,
        string healthStatus,
        string notes
    );

    event ActivityImagesStored(
        uint256 indexed logId,
        string[] imageUrls
    );

    event ActivityProductsLinked(
        uint256 indexed logId,
        uint256[] productIds
    );

    // ===================================
    // TREE MANAGEMENT - OPTIMIZED
    // ===================================

    /**
     * @dev Đăng ký cây mới
     * Emit 2 events: TreeRegistered (on-chain) + TreeDetailsStored (off-chain)
     */
    function registerTree(
        string memory _treeQRCode,
        uint256 _farmerId,
        uint256 _regionId,
        string memory _treeType,
        string memory _variety,
        string memory _coordinates
    ) public returns (uint256) {
        require(bytes(_treeQRCode).length > 0, "QR code required");
        require(_treeQRCodeToId[_treeQRCode] == 0, "QR code exists");
        require(_farmerId > 0, "Invalid farmer");
        require(_regionId > 0, "Invalid region");

        _treeIdCounter++;
        uint256 newTreeId = _treeIdCounter;
        uint256 plantedDate = block.timestamp;

        // Lưu on-chain (minimal)
        Tree memory newTree = Tree({
            treeId: newTreeId,
            treeQRCode: _treeQRCode,
            farmerId: _farmerId,
            regionId: _regionId,
            treeType: _treeType,
            plantedDate: plantedDate,
            isActive: true
        });

        _trees[newTreeId] = newTree;
        _treeQRCodeToId[_treeQRCode] = newTreeId;
        _farmerTrees[_farmerId].push(newTreeId);
        _regionTrees[_regionId].push(newTreeId);

        // Emit events
        emit TreeRegistered(newTreeId, _treeQRCode, _farmerId, _regionId, _treeType, plantedDate);
        emit TreeDetailsStored(newTreeId, _variety, _coordinates);

        // Tạo activity log tự động
        _addTreeActivity(
            newTreeId,
            _farmerId,
            ActivityCategory.TreeManagement,
            "Tree Planted",
            string(abi.encodePacked("Tree planted: ", _treeType)),
            true
        );

        return newTreeId;
    }

    /**
     * @dev Thêm hoạt động chăm sóc cây - Tách thành 2 functions
     */
    function addTreeCareActivity(
        uint256 _treeId,
        uint256 _farmerId,
        ActivityCategory _category,
        string memory _activityName,
        string memory _description
    ) public returns (uint256) {
        require(_trees[_treeId].treeId != 0, "Tree not exists");
        require(_trees[_treeId].isActive, "Tree not active");
        require(_trees[_treeId].farmerId == _farmerId, "Not tree owner");

        uint256 logId = _addTreeActivity(
            _treeId,
            _farmerId,
            _category,
            _activityName,
            _description,
            false
        );

        return logId;
    }

    /**
     * @dev Thêm metadata cho tree activity
     */
    function addTreeActivityMetadata(
        uint256 _logId,
        string[] memory _imageUrls,
        string memory _fertilizer,
        string memory _pesticide,
        uint256 _quantity,
        string memory _unit,
        int8 _temperature,
        uint8 _humidity,
        string memory _weather,
        string memory _healthStatus,
        string memory _notes
    ) public {
        // Emit metadata events
        if (_imageUrls.length > 0) {
            emit ActivityImagesStored(_logId, _imageUrls);
        }

        emit ActivityMetadataStored(
            _logId,
            _fertilizer,
            _pesticide,
            _quantity,
            _unit,
            _temperature,
            _humidity,
            _weather,
            _healthStatus,
            _notes
        );
    }

    /**
     * @dev Internal: Thêm tree activity
     */
    function _addTreeActivity(
        uint256 _treeId,
        uint256 _participantId,
        ActivityCategory _category,
        string memory _activityName,
        string memory _description,
        bool _isSystemActivity
    ) internal returns (uint256) {
        _logIdCounter++;
        uint256 newLogId = _logIdCounter;
        uint256 timestamp = block.timestamp;

        // Hash description
        bytes32 dataHash = keccak256(abi.encodePacked(_activityName, _description));

        // Lưu on-chain (minimal)
        ActivityLogEntry memory newLog = ActivityLogEntry({
            logId: newLogId,
            batchId: 0,
            treeId: _treeId,
            participantId: _participantId,
            timestamp: timestamp,
            category: _category,
            isSystemActivity: _isSystemActivity,
            dataHash: dataHash
        });

        _treeActivityLogs[_treeId].push(newLog);

        // Emit events
        emit TreeActivityRecorded(_treeId, newLogId, _category, timestamp);
        emit TreeActivityDetailsStored(newLogId, _activityName, _description);

        return newLogId;
    }

    /**
     * @dev Link cây với lô hàng khi thu hoạch
     */
    function linkTreeToBatch(
        uint256 _treeId,
        uint256 _batchId,
        uint256 _farmerId,
        string memory _harvestNotes
    ) public {
        require(_trees[_treeId].treeId != 0, "Tree not exists");
        require(_trees[_treeId].farmerId == _farmerId, "Not tree owner");

        // Tạo activity log
        _addTreeActivity(
            _treeId,
            _farmerId,
            ActivityCategory.Harvesting,
            "Harvested to Batch",
            string(abi.encodePacked("Harvested to batch #", uint2str(_batchId))),
            true
        );

        emit TreeLinkedToBatch(_treeId, _batchId, block.timestamp, _harvestNotes);
    }

    /**
     * @dev Vô hiệu hóa cây
     */
    function deactivateTree(
        uint256 _treeId,
        uint256 _farmerId,
        string memory _reason
    ) public {
        require(_trees[_treeId].treeId != 0, "Tree not exists");
        require(_trees[_treeId].farmerId == _farmerId, "Not tree owner");
        require(_trees[_treeId].isActive, "Already inactive");

        _trees[_treeId].isActive = false;

        _addTreeActivity(
            _treeId,
            _farmerId,
            ActivityCategory.TreeManagement,
            "Tree Deactivated",
            _reason,
            false
        );

        emit TreeDeactivated(_treeId, _farmerId, _reason);
    }

    // ===================================
    // BATCH ACTIVITY LOG - OPTIMIZED
    // ===================================

    /**
     * @dev Thêm activity log đơn giản
     */
    function addActivityLog(
        uint256 _batchId,
        uint256 _participantId,
        string memory _activityName,
        string memory _description,
        bool _isSystemActivity
    ) public returns (uint256) {
        _logIdCounter++;
        uint256 newLogId = _logIdCounter;
        uint256 timestamp = block.timestamp;

        // Hash description
        bytes32 dataHash = keccak256(abi.encodePacked(_activityName, _description));

        // Lưu on-chain (minimal)
        ActivityLogEntry memory newLog = ActivityLogEntry({
            logId: newLogId,
            batchId: _batchId,
            treeId: 0,
            participantId: _participantId,
            timestamp: timestamp,
            category: ActivityCategory.Farming,
            isSystemActivity: _isSystemActivity,
            dataHash: dataHash
        });

        _batchActivityLogs[_batchId].push(newLog);

        // Emit events
        emit ActivityLogAdded(_batchId, _participantId, newLogId, ActivityCategory.Farming, timestamp, _isSystemActivity);
        emit ActivityLogDetailsStored(newLogId, _activityName, _description);

        return newLogId;
    }

    /**
     * @dev Thêm activity log với metadata đầy đủ - Tách thành 2 functions
     */
    function addDetailedActivityLog(
        uint256 _batchId,
        uint256 _participantId,
        ActivityCategory _category,
        string memory _activityName,
        string memory _description,
        bool _isSystemActivity
    ) public returns (uint256) {
        _logIdCounter++;
        uint256 newLogId = _logIdCounter;
        uint256 timestamp = block.timestamp;

        bytes32 dataHash = keccak256(abi.encodePacked(_activityName, _description));

        ActivityLogEntry memory newLog = ActivityLogEntry({
            logId: newLogId,
            batchId: _batchId,
            treeId: 0,
            participantId: _participantId,
            timestamp: timestamp,
            category: _category,
            isSystemActivity: _isSystemActivity,
            dataHash: dataHash
        });

        _batchActivityLogs[_batchId].push(newLog);

        emit ActivityLogAdded(_batchId, _participantId, newLogId, _category, timestamp, _isSystemActivity);
        emit ActivityLogDetailsStored(newLogId, _activityName, _description);

        return newLogId;
    }

    /**
     * @dev Thêm metadata cho activity log
     */
    function addActivityLogMetadata(
        uint256 _logId,
        string[] memory _imageUrls,
        uint256[] memory _relatedProductIds,
        string memory _fertilizer,
        string memory _pesticide,
        uint256 _quantity,
        string memory _unit,
        int8 _temperature,
        uint8 _humidity,
        string memory _weather,
        string memory _healthStatus,
        string memory _notes
    ) public {
        if (_imageUrls.length > 0) {
            emit ActivityImagesStored(_logId, _imageUrls);
        }

        if (_relatedProductIds.length > 0) {
            emit ActivityProductsLinked(_logId, _relatedProductIds);
        }

        emit ActivityMetadataStored(
            _logId,
            _fertilizer,
            _pesticide,
            _quantity,
            _unit,
            _temperature,
            _humidity,
            _weather,
            _healthStatus,
            _notes
        );
    }

    // ===================================
    // GETTERS - TREE
    // ===================================

    function getTreeByQRCode(string memory _qrCode) public view returns (Tree memory) {
        uint256 treeId = _treeQRCodeToId[_qrCode];
        require(treeId != 0, "Tree not found");
        return _trees[treeId];
    }

    function getTreeDetails(uint256 _treeId) public view returns (Tree memory) {
        require(_trees[_treeId].treeId != 0, "Tree not exists");
        return _trees[_treeId];
    }

    function getFarmerTrees(uint256 _farmerId) public view returns (uint256[] memory) {
        return _farmerTrees[_farmerId];
    }

    function getRegionTrees(uint256 _regionId) public view returns (uint256[] memory) {
        return _regionTrees[_regionId];
    }

    function getTreeActivityLogs(uint256 _treeId) public view returns (ActivityLogEntry[] memory) {
        require(_trees[_treeId].treeId != 0, "Tree not exists");
        return _treeActivityLogs[_treeId];
    }

    function getTotalTrees() public view returns (uint256) {
        return _treeIdCounter;
    }

    function getActiveTrees(uint256 _farmerId) public view returns (uint256) {
        uint256[] memory treeIds = _farmerTrees[_farmerId];
        uint256 count = 0;
        
        for (uint256 i = 0; i < treeIds.length; i++) {
            if (_trees[treeIds[i]].isActive) {
                count++;
            }
        }
        
        return count;
    }

    // ===================================
    // GETTERS - BATCH ACTIVITY
    // ===================================

    function getActivityLogs(uint256 _batchId) public view returns (ActivityLogEntry[] memory) {
        return _batchActivityLogs[_batchId];
    }

    function getSystemActivityLogs(uint256 _batchId) public view returns (ActivityLogEntry[] memory) {
        ActivityLogEntry[] memory allLogs = _batchActivityLogs[_batchId];
        uint256 count = 0;
        
        for (uint256 i = 0; i < allLogs.length; i++) {
            if (allLogs[i].isSystemActivity) {
                count++;
            }
        }

        ActivityLogEntry[] memory systemLogs = new ActivityLogEntry[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allLogs.length; i++) {
            if (allLogs[i].isSystemActivity) {
                systemLogs[index] = allLogs[i];
                index++;
            }
        }

        return systemLogs;
    }

    function getTotalActivityLogs() public view returns (uint256) {
        return _logIdCounter;
    }

    // ===================================
    // VERIFICATION
    // ===================================

    /**
     * @dev Verify activity log data hash
     */
    function verifyActivityDataHash(
        uint256 _logId,
        uint256 _batchId,
        string memory _activityName,
        string memory _description
    ) public view returns (bool) {
        ActivityLogEntry[] memory logs = _batchActivityLogs[_batchId];
        
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].logId == _logId) {
                bytes32 calculatedHash = keccak256(abi.encodePacked(_activityName, _description));
                return logs[i].dataHash == calculatedHash;
            }
        }
        
        return false;
    }

    // ===================================
    // UTILITY FUNCTIONS
    // ===================================

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
}