// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MaliciousInteraction
 * @dev Contract mô phỏng các tấn công tương tác độc hại
 * - Thử ghi dữ liệu sai
 * - Thử bypass access control
 * - Thử gửi calldata độc hại
 */
interface IActivityLog {
    function addActivityLog(
        uint256 _batchId,
        uint256 _participantId,
        string memory _activityName,
        string memory _description,
        bool _isSystemActivity
    ) external returns (uint256);
    
    function verifyActivityDataHash(
        uint256 _logId,
        uint256 _batchId,
        string memory _activityName,
        string memory _description
    ) external view returns (bool);
}

contract MaliciousInteraction {
    IActivityLog public target;
    
    event InjectionAttempt(uint256 batchId, string payload);
    event SpoofAttempt(uint256 logId, bool result);
    
    constructor(address _target) {
        target = IActivityLog(_target);
    }

    /**
     * @dev Thử SQL Injection / Script Injection qua string input
     */
    function attemptInjection(uint256 _batchId, uint256 _participantId) external returns (uint256) {
        string memory maliciousPayload = "'; DROP TABLE batches; --<script>alert('XSS')</script>";
        
        emit InjectionAttempt(_batchId, maliciousPayload);
        
        // Blockchain sẽ lưu đúng nguyên văn - không thực thi SQL/JS
        return target.addActivityLog(
            _batchId,
            _participantId,
            maliciousPayload,
            "Injection attempt description",
            false
        );
    }

    /**
     * @dev Thử spoof hash để giả mạo dữ liệu
     */
    function attemptHashSpoof(
        uint256 _logId,
        uint256 _batchId,
        string memory _fakeActivity,
        string memory _fakeDescription
    ) external view returns (bool) {
        // Thử verify với dữ liệu giả - sẽ trả về false
        bool result = target.verifyActivityDataHash(_logId, _batchId, _fakeActivity, _fakeDescription);
        return result;
    }

    /**
     * @dev Thử gửi empty/null data
     */
    function attemptEmptyData(uint256 _batchId, uint256 _participantId) external returns (bool) {
        try target.addActivityLog(_batchId, _participantId, "", "", false) returns (uint256) {
            return true; // Nếu accept được empty, đây là lỗ hổng
        } catch {
            return false; // Expected: contract nên reject empty data
        }
    }

    /**
     * @dev Thử overflow participantId
     */
    function attemptOverflow(uint256 _batchId) external returns (uint256) {
        uint256 overflowId = type(uint256).max;
        return target.addActivityLog(
            _batchId,
            overflowId,
            "Overflow Test",
            "Testing max uint256",
            false
        );
    }
}
