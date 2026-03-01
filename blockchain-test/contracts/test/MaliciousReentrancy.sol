// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MaliciousReentrancy
 * @dev Contract mô phỏng tấn công Reentrancy vào TraceabilityContract
 * Dùng trong kiểm thử bảo mật - KHÔNG dùng trong production
 */
interface ITraceability {
    function createBatch(
        string memory _sscc,
        uint256 _producerId,
        uint256 _productTypeId,
        string memory _name,
        string memory _quantity,
        uint256 _startDate,
        uint256 _endDate,
        string memory _farmPlotNumber
    ) external returns (uint256);

    function approveBatch(uint256 _batchId, uint256 _producerId) external;
}

contract MaliciousReentrancy {
    ITraceability public target;
    uint256 public attackCount;
    uint256 public maxAttacks;
    bool public attacking;
    
    event AttackAttempted(uint256 count, address attacker);
    event AttackFailed(string reason);

    constructor(address _target) {
        target = ITraceability(_target);
        maxAttacks = 3;
    }

    function setMaxAttacks(uint256 _max) external {
        maxAttacks = _max;
    }

    /**
     * @dev Khởi động tấn công reentrancy
     */
    function attack(uint256 _producerId) external {
        attacking = true;
        attackCount = 0;
        
        try target.createBatch(
            "ATTACK-SSCC-001",
            _producerId,
            1,
            "Attack Batch",
            "100",
            block.timestamp,
            block.timestamp + 30 days,
            "Attack Farm"
        ) returns (uint256 batchId) {
            // Nếu tạo thành công, thử approve ngay trong cùng call
            _attemptReentrant(batchId, _producerId);
        } catch Error(string memory reason) {
            emit AttackFailed(reason);
        }
        
        attacking = false;
    }

    function _attemptReentrant(uint256 _batchId, uint256 _producerId) internal {
        if (attackCount >= maxAttacks) return;
        attackCount++;
        
        emit AttackAttempted(attackCount, address(this));
        
        // Thử approve nhiều lần
        try target.approveBatch(_batchId, _producerId) {
            // Nếu approve thành công, thử lại
            _attemptReentrant(_batchId, _producerId);
        } catch {
            // Expected: approve chỉ được gọi 1 lần
        }
    }

    /**
     * @dev Fallback để nhận ETH (nếu contract có gửi ETH)
     */
    receive() external payable {
        if (attacking && attackCount < maxAttacks) {
            attackCount++;
            emit AttackAttempted(attackCount, address(this));
        }
    }
}
