// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title CorrectionRecord
 * @dev Ghi nhận bất biến mọi lần đính chính dữ liệu lô hàng.
 *      Dữ liệu chi tiết (giá trị cũ/mới) lưu MySQL.
 *      Blockchain chỉ lưu: batchId, adminId, timestamp, contentHash.
 *      → Không thể chối cãi: ai sửa gì, lúc nào.
 */
contract CorrectionRecord {

    // ===================================
    // OWNER
    // ===================================
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ===================================
    // STRUCT
    // ===================================

    /**
     * @dev Một bản ghi đính chính
     * Không lưu giá trị cụ thể (tiết kiệm gas, tránh lưu PII)
     * contentHash = keccak256(batchId + changedFields + oldValues + newValues + reason)
     * → Dùng để verify dữ liệu MySQL không bị giả mạo
     */
    struct Correction {
        uint256 correctionId;       // ID tự tăng
        uint256 batchId;            // ID lô hàng (tham chiếu với MySQL)
        uint256 requestId;          // ID yêu cầu đính chính (batch_correction_requests.id)
        uint256 adminId;            // ID admin phê duyệt
        uint256 farmerId;           // ID nông dân yêu cầu
        uint256 timestamp;          // Unix timestamp lúc ghi
        bytes32 contentHash;        // Hash nội dung để verify off-chain data
        uint8   changedFieldCount;  // Số lượng field bị thay đổi
    }

    // ===================================
    // STORAGE
    // ===================================

    uint256 private _correctionIdCounter;

    // correctionId → Correction
    mapping(uint256 => Correction) private _corrections;

    // batchId → danh sách correctionId
    mapping(uint256 => uint256[]) private _batchCorrections;

    // requestId → correctionId (1-1, để tránh ghi 2 lần)
    mapping(uint256 => uint256) private _requestToCorrectionId;

    // Tổng số lần đính chính
    uint256 public totalCorrections;

    // ===================================
    // EVENTS
    // ===================================

    /**
     * @dev Emit khi một lần đính chính được ghi lên chain
     * Backend lắng nghe event này để cập nhật blockchain_tx_hash vào MySQL
     */
    event CorrectionLogged(
        uint256 indexed correctionId,
        uint256 indexed batchId,
        uint256 indexed requestId,
        uint256 adminId,
        uint256 farmerId,
        uint256 timestamp,
        bytes32 contentHash,
        uint8   changedFieldCount
    );

    // ===================================
    // WRITE FUNCTIONS
    // ===================================

    /**
     * @dev Ghi một bản ghi đính chính lên blockchain
     * Chỉ owner (backend server) mới được gọi
     *
     * @param _batchId          ID lô hàng
     * @param _requestId        ID yêu cầu đính chính (MySQL PK)
     * @param _adminId          ID admin phê duyệt
     * @param _farmerId         ID nông dân
     * @param _contentHash      keccak256 của nội dung thay đổi
     * @param _changedFieldCount Số field bị thay đổi
     */
    function logCorrection(
        uint256 _batchId,
        uint256 _requestId,
        uint256 _adminId,
        uint256 _farmerId,
        bytes32 _contentHash,
        uint8   _changedFieldCount
    ) external onlyOwner returns (uint256) {
        require(_batchId > 0,            "Invalid batchId");
        require(_requestId > 0,          "Invalid requestId");
        require(_adminId > 0,            "Invalid adminId");
        require(_farmerId > 0,           "Invalid farmerId");
        require(_contentHash != bytes32(0), "Invalid contentHash");

        // Tránh ghi 2 lần cho cùng 1 requestId
        require(
            _requestToCorrectionId[_requestId] == 0,
            "Correction already logged for this request"
        );

        _correctionIdCounter++;
        uint256 newId = _correctionIdCounter;

        _corrections[newId] = Correction({
            correctionId:      newId,
            batchId:           _batchId,
            requestId:         _requestId,
            adminId:           _adminId,
            farmerId:          _farmerId,
            timestamp:         block.timestamp,
            contentHash:       _contentHash,
            changedFieldCount: _changedFieldCount
        });

        _batchCorrections[_batchId].push(newId);
        _requestToCorrectionId[_requestId] = newId;
        totalCorrections++;

        emit CorrectionLogged(
            newId,
            _batchId,
            _requestId,
            _adminId,
            _farmerId,
            block.timestamp,
            _contentHash,
            _changedFieldCount
        );

        return newId;
    }

    // ===================================
    // READ FUNCTIONS
    // ===================================

    /**
     * @dev Lấy thông tin một bản ghi đính chính theo correctionId
     */
    function getCorrection(uint256 _correctionId)
        external
        view
        returns (Correction memory)
    {
        require(
            _corrections[_correctionId].correctionId != 0,
            "Correction not found"
        );
        return _corrections[_correctionId];
    }

    /**
     * @dev Lấy danh sách correctionId của một lô hàng
     */
    function getBatchCorrectionIds(uint256 _batchId)
        external
        view
        returns (uint256[] memory)
    {
        return _batchCorrections[_batchId];
    }

    /**
     * @dev Lấy số lần đính chính của một lô hàng
     */
    function getBatchCorrectionCount(uint256 _batchId)
        external
        view
        returns (uint256)
    {
        return _batchCorrections[_batchId].length;
    }

    /**
     * @dev Lấy correctionId từ requestId (MySQL PK)
     * Trả về 0 nếu chưa được ghi lên chain
     */
    function getCorrectionIdByRequest(uint256 _requestId)
        external
        view
        returns (uint256)
    {
        return _requestToCorrectionId[_requestId];
    }

    /**
     * @dev Verify nội dung đính chính có khớp với hash trên chain không
     * Dùng để kiểm tra tính toàn vẹn của dữ liệu MySQL
     *
     * @param _correctionId  ID bản ghi cần verify
     * @param _contentHash   Hash tính lại từ dữ liệu MySQL
     * @return true nếu khớp
     */
    function verifyCorrection(uint256 _correctionId, bytes32 _contentHash)
        external
        view
        returns (bool)
    {
        Correction memory c = _corrections[_correctionId];
        require(c.correctionId != 0, "Correction not found");
        return c.contentHash == _contentHash;
    }

    /**
     * @dev Tổng số bản ghi đính chính đã lưu
     */
    function getTotalCorrections() external view returns (uint256) {
        return totalCorrections;
    }
}
