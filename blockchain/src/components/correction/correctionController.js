/**
 * ============================================================
 * CORRECTION CONTROLLER - Đính chính lô hàng
 * ============================================================
 * Fix so với phiên bản cũ:
 *
 * 1. BLOCKCHAIN: Dùng OWNER_PRIVATE_KEY thay vì accounts[0]
 *    → accounts[0] của Ganache KHÔNG phải owner deploy contract
 *    → onlyOwner modifier revert thầm lặng → tx_hash luôn null
 *    → Fix: privateKeyToAccount(OWNER_PRIVATE_KEY)
 *
 * 2. CASCADE UPDATE: Khi quantity thay đổi → cập nhật luôn
 *    purchase_records (total_quantity).
 *
 * 3. DATA HASH: Tính lại contentHash và ghi lên blockchain.
 *
 * 4. API truy xuất: endpoint /api/correction/history/:batchId
 *    trả thêm blockchain_tx_hash để consumer verify on-chain.
 * ============================================================
 */

const { Web3 } = require("web3");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

// ── Blockchain init ────────────────────────────────────────────────────────
const _web3 = new Web3(process.env.GANACHE_URL || "http://127.0.0.1:8545");

let _correctionContract = null;
try {
  const abi = require("../../../build/contracts/CorrectionRecord.json").abi;
  const addr = process.env.CORRECTION_CONTRACT_ADDRESS;
  if (addr) {
    _correctionContract = new _web3.eth.Contract(abi, addr);
    console.log("✅ CorrectionRecord contract loaded:", addr);
  } else {
    console.warn("⚠️  CORRECTION_CONTRACT_ADDRESS chưa set trong .env");
  }
} catch (e) {
  console.warn("⚠️  Không load được CorrectionRecord ABI:", e.message);
}

// ── Allowed fields ─────────────────────────────────────────────────────────
const ALLOWED_CORRECTION_FIELDS = [
  "batch_name",
  "quantity",
  "farm_plot_number",
];

// ── Auth helpers ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.isLoggedIn && (req.session.userId || req.session.adminId)) {
    return next();
  }
  return res.status(401).json({ success: false, error: "Chưa đăng nhập" });
}

function requireRoleId(roleId) {
  return function (req, res, next) {
    if (req.session?.roleId === roleId) return next();
    return res.status(403).json({ success: false, error: "Không có quyền" });
  };
}

const requireFarmer = (req, res, next) => requireRoleId(1)(req, res, next);
const requireAdmin = (req, res, next) => requireRoleId(3)(req, res, next);

// ── Blockchain helper ──────────────────────────────────────────────────────

/**
 * Tính contentHash để verify tính toàn vẹn off-chain data
 */
function buildContentHash(
  requestId,
  batchId,
  changedFields,
  originalData,
  correctedData,
  reason,
) {
  const content = JSON.stringify({
    requestId,
    batchId,
    changedFields: [...changedFields].sort(),
    originalData,
    correctedData,
    reason,
  });
  return _web3.utils.keccak256(content);
}

/**
 * Ghi bản ghi đính chính lên CorrectionRecord contract
 *
 * FIX CHÍNH: Dùng OWNER_PRIVATE_KEY thay vì accounts[0].
 * Lý do: CorrectionRecord.sol có modifier onlyOwner. Owner là account
 * đã deploy contract (0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1 theo log migrate).
 * accounts[0] từ web3.eth.getAccounts() là account Ganache không nhất thiết
 * trùng với owner → transaction revert → trả về null thầm lặng.
 *
 * Cách lấy OWNER_PRIVATE_KEY:
 *   Ganache UI → tab Accounts → icon 🔑 cạnh account đầu tiên → copy key
 *   Thêm vào .env: OWNER_PRIVATE_KEY=0x<key>
 *
 * @returns {string|null} txHash nếu thành công
 */
async function logCorrectionOnChain({
  requestId,
  batchId,
  adminId,
  farmerId,
  changedFields,
  originalData,
  correctedData,
  reason,
}) {
  if (!_correctionContract) {
    console.warn("[Correction] Contract chưa được load, bỏ qua blockchain log");
    return null;
  }

  const ownerKey = process.env.OWNER_PRIVATE_KEY;
  if (!ownerKey) {
    console.warn(
      "[Correction] ⚠️  OWNER_PRIVATE_KEY chưa set trong .env\n" +
        "             Lấy từ Ganache UI → icon 🔑 cạnh account deploy → paste vào .env:\n" +
        "             OWNER_PRIVATE_KEY=0x<private_key>",
    );
    return null;
  }

  try {
    // Thêm owner account vào wallet (idempotent nếu gọi nhiều lần)
    const ownerAccount = _web3.eth.accounts.privateKeyToAccount(ownerKey);
    _web3.eth.accounts.wallet.add(ownerAccount);
    const from = ownerAccount.address;

    console.log(`[Correction] 🔑 Dùng owner account: ${from}`);

    const contentHash = buildContentHash(
      requestId,
      batchId,
      changedFields,
      originalData,
      correctedData,
      reason,
    );

    // Estimate gas để tránh out-of-gas hoặc underflow
    let gasLimit;
    try {
      const gasEstimate = await _correctionContract.methods
        .logCorrection(
          batchId,
          requestId,
          adminId,
          farmerId,
          contentHash,
          changedFields.length,
        )
        .estimateGas({ from });
      gasLimit = Math.floor(Number(gasEstimate) * 1.3); // buffer 30%
    } catch (estimateErr) {
      // Nếu estimateGas thất bại (ví dụ revert), log ra để debug
      console.error(
        "[Correction] ❌ estimateGas thất bại:",
        estimateErr.message,
      );
      if (estimateErr.message.includes("Only owner")) {
        console.error(
          "[Correction] ❌ onlyOwner revert!\n" +
            `             Owner account:  ${from}\n` +
            `             Contract addr:  ${process.env.CORRECTION_CONTRACT_ADDRESS}\n` +
            "             → OWNER_PRIVATE_KEY không khớp với account đã deploy contract.\n" +
            "             → Kiểm tra lại Ganache và file .env.",
        );
      }
      return null;
    }

    const tx = await _correctionContract.methods
      .logCorrection(
        batchId,
        requestId,
        adminId,
        farmerId,
        contentHash,
        changedFields.length,
      )
      .send({ from, gas: gasLimit });

    console.log(
      `[Correction] ✅ Blockchain ghi thành công. TX: ${tx.transactionHash}`,
    );
    return tx.transactionHash;
  } catch (err) {
    console.error("[Correction] ❌ Blockchain log thất bại:", err.message);
    return null; // Không throw — DB đã commit, blockchain failure không rollback
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

function setupCorrectionRoutes(app, db) {
  // ==========================================================================
  // FARMER: Tạo yêu cầu đính chính
  // POST /api/correction/request
  // ==========================================================================
  app.post(
    "/api/correction/request",
    requireAuth,
    requireFarmer,
    async (req, res) => {
      try {
        const farmerId = req.session.userId;
        const { batchId, reason, correctedData } = req.body;

        if (!batchId || !reason || !correctedData) {
          return res.status(400).json({
            success: false,
            error:
              "Thiếu thông tin: batchId, reason, correctedData là bắt buộc",
          });
        }
        if (reason.trim().length < 10) {
          return res
            .status(400)
            .json({ success: false, error: "Lý do phải có ít nhất 10 ký tự" });
        }

        // Kiểm tra field hợp lệ
        const correctedFields = Object.keys(correctedData);
        const invalidFields = correctedFields.filter(
          (f) => !ALLOWED_CORRECTION_FIELDS.includes(f),
        );
        if (invalidFields.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Không được phép sửa: ${invalidFields.join(", ")}`,
          });
        }

        // Lấy batch hiện tại
        const [batches] = await db.query(
          `SELECT batch_id, sscc, producer_id, status,
                  batch_name, quantity, farm_plot_number,
                  start_date_iso, end_date_iso
           FROM blockchain_batches
           WHERE batch_id = ? AND producer_id = ?`,
          [batchId, farmerId],
        );

        if (batches.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Không tìm thấy lô hàng hoặc không có quyền",
          });
        }

        const batch = batches[0];

        if (batch.status === "Rejected") {
          return res.status(400).json({
            success: false,
            error: "Không thể đính chính lô đã bị từ chối",
          });
        }

        // Không cho tạo nếu đang có pending
        const [pending] = await db.query(
          `SELECT id FROM batch_correction_requests WHERE batch_id = ? AND status = 'pending'`,
          [batchId],
        );
        if (pending.length > 0) {
          return res.status(400).json({
            success: false,
            error:
              "Lô này đang có yêu cầu đính chính chờ duyệt. Vui lòng chờ Admin xử lý.",
          });
        }

        // Tính changed_fields
        const changedFields = correctedFields.filter((f) => {
          return String(batch[f] ?? "") !== String(correctedData[f] ?? "");
        });

        if (changedFields.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Không có gì thay đổi so với giá trị hiện tại",
          });
        }

        const originalData = {
          batch_name: batch.batch_name,
          quantity: batch.quantity,
          farm_plot_number: batch.farm_plot_number,
        };

        const [ins] = await db.query(
          `INSERT INTO batch_correction_requests
             (batch_id, requested_by, reason, original_data, corrected_data, changed_fields, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          [
            batchId,
            farmerId,
            reason.trim(),
            JSON.stringify(originalData),
            JSON.stringify(correctedData),
            JSON.stringify(changedFields),
          ],
        );

        const requestId = ins.insertId;

        const [[farmer]] = await db.query(
          `SELECT name FROM users WHERE uid = ?`,
          [farmerId],
        );
        const farmerName = farmer?.name || "Nông dân";

        await db.query(
          `INSERT INTO batch_correction_history
             (correction_request_id, batch_id, changed_by_user_id, changed_by_name,
              changed_by_role, action, note)
           VALUES (?, ?, ?, ?, 'farmer', 'requested', ?)`,
          [requestId, batchId, farmerId, farmerName, reason.trim()],
        );

        return res.json({
          success: true,
          message: "Gửi yêu cầu thành công. Chờ Admin phê duyệt.",
          data: {
            correctionRequestId: requestId,
            batchId,
            changedFields,
            status: "pending",
          },
        });
      } catch (err) {
        console.error("[Correction] Request error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // ==========================================================================
  // FARMER: Danh sách yêu cầu của mình
  // GET /api/correction/my-requests
  // ==========================================================================
  app.get(
    "/api/correction/my-requests",
    requireAuth,
    requireFarmer,
    async (req, res) => {
      try {
        const farmerId = req.session.userId;
        const { status } = req.query;

        let where = "WHERE cr.requested_by = ?";
        const params = [farmerId];
        if (status && ["pending", "approved", "rejected"].includes(status)) {
          where += " AND cr.status = ?";
          params.push(status);
        }

        const [rows] = await db.query(
          `SELECT cr.id, cr.batch_id, bb.sscc, bb.batch_name AS current_batch_name,
                  cr.reason, cr.status, cr.changed_fields, cr.original_data, cr.corrected_data,
                  cr.review_note, cr.requested_at, cr.reviewed_at,
                  cr.blockchain_tx_hash, cr.blockchain_logged_at,
                  a.admin_name AS reviewed_by_name
           FROM batch_correction_requests cr
           JOIN blockchain_batches bb ON cr.batch_id = bb.batch_id
           LEFT JOIN admin a ON cr.reviewed_by = a.id
           ${where}
           ORDER BY cr.requested_at DESC`,
          params,
        );

        return res.json({
          success: true,
          data: rows.map((r) => ({
            ...r,
            changed_fields: parseJSON(r.changed_fields, []),
            original_data: parseJSON(r.original_data, {}),
            corrected_data: parseJSON(r.corrected_data, {}),
          })),
        });
      } catch (err) {
        console.error("[Correction] My-requests error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // ==========================================================================
  // ADMIN: Danh sách yêu cầu (filter + phân trang)
  // GET /api/correction/pending
  // ==========================================================================
  app.get(
    "/api/correction/pending",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const { status = "pending", page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [rows] = await db.query(
          `SELECT cr.id, cr.batch_id, bb.sscc, bb.batch_name, bb.status AS batch_status,
                  cr.reason, cr.status AS correction_status,
                  cr.changed_fields, cr.original_data, cr.corrected_data,
                  cr.requested_at, cr.reviewed_at, cr.review_note,
                  cr.blockchain_tx_hash,
                  u.name AS farmer_name, u.email AS farmer_email, u.phone AS farmer_phone,
                  a.admin_name AS reviewed_by_name
           FROM batch_correction_requests cr
           JOIN blockchain_batches bb ON cr.batch_id = bb.batch_id
           JOIN users u ON cr.requested_by = u.uid
           LEFT JOIN admin a ON cr.reviewed_by = a.id
           WHERE cr.status = ?
           ORDER BY cr.requested_at DESC
           LIMIT ? OFFSET ?`,
          [status, parseInt(limit), offset],
        );

        const [[{ total }]] = await db.query(
          `SELECT COUNT(*) AS total FROM batch_correction_requests WHERE status = ?`,
          [status],
        );

        return res.json({
          success: true,
          data: rows.map((r) => ({
            ...r,
            changed_fields: parseJSON(r.changed_fields, []),
            original_data: parseJSON(r.original_data, {}),
            corrected_data: parseJSON(r.corrected_data, {}),
          })),
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        });
      } catch (err) {
        console.error("[Correction] Pending list error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // ==========================================================================
  // ADMIN: Phê duyệt yêu cầu
  // POST /api/correction/:id/approve
  // ==========================================================================
  app.post(
    "/api/correction/:id/approve",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const adminId = req.session.adminId;
        const { id } = req.params;
        const { note = "" } = req.body;

        // 1. Lấy yêu cầu
        const [reqs] = await conn.query(
          `SELECT cr.*, cr.requested_by AS farmer_id, bb.batch_name
           FROM batch_correction_requests cr
           JOIN blockchain_batches bb ON cr.batch_id = bb.batch_id
           WHERE cr.id = ? AND cr.status = 'pending'`,
          [id],
        );

        if (reqs.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            success: false,
            error: "Không tìm thấy hoặc đã xử lý",
          });
        }

        const request = reqs[0];
        const correctedData = parseJSON(request.corrected_data, {});
        const changedFields = parseJSON(request.changed_fields, []);
        const originalData = parseJSON(request.original_data, {});

        // 2. Cập nhật blockchain_batches
        const allowedUpdates = {};
        for (const f of changedFields) {
          if (ALLOWED_CORRECTION_FIELDS.includes(f))
            allowedUpdates[f] = correctedData[f];
        }

        if (Object.keys(allowedUpdates).length > 0) {
          const setClauses = Object.keys(allowedUpdates)
            .map((f) => `\`${f}\` = ?`)
            .join(", ");
          await conn.query(
            `UPDATE blockchain_batches
             SET ${setClauses},
                 is_corrected      = TRUE,
                 correction_count  = correction_count + 1,
                 last_corrected_at = NOW()
             WHERE batch_id = ?`,
            [...Object.values(allowedUpdates), request.batch_id],
          );
        }

        // 3. CASCADE: Nếu quantity thay đổi → cập nhật purchase_records
        if (
          changedFields.includes("quantity") &&
          correctedData.quantity !== undefined
        ) {
          const newQty = parseFloat(
            String(correctedData.quantity).replace(/[^0-9.]/g, ""),
          );
          if (!isNaN(newQty) && newQty > 0) {
            await conn.query(
              `UPDATE purchase_records
               SET total_quantity = ?,
                   notes = CONCAT(IFNULL(notes,''), ' [Đã cập nhật theo đính chính lô hàng]')
               WHERE batch_id = ?`,
              [newQty, request.batch_id],
            );
            console.log(
              `[Correction] ✅ Cascade: purchase_records.total_quantity → ${newQty}`,
            );
          }
        }

        // 4. Lấy tên admin
        const [[adminRow]] = await conn.query(
          `SELECT admin_name FROM admin WHERE id = ?`,
          [adminId],
        );
        const adminName = adminRow?.admin_name || "Admin";

        // 5. Cập nhật trạng thái request
        await conn.query(
          `UPDATE batch_correction_requests
           SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
           WHERE id = ?`,
          [adminId, note.trim(), id],
        );

        // 6. Audit history cho từng field
        for (const field of changedFields) {
          await conn.query(
            `INSERT INTO batch_correction_history
               (correction_request_id, batch_id, changed_by_admin_id, changed_by_name,
                changed_by_role, action, field_name, old_value, new_value, note)
             VALUES (?, ?, ?, ?, 'admin', 'approved', ?, ?, ?, ?)`,
            [
              id,
              request.batch_id,
              adminId,
              adminName,
              field,
              String(originalData[field] ?? ""),
              String(correctedData[field] ?? ""),
              note.trim(),
            ],
          );
        }

        await conn.commit(); // DB commit trước, blockchain ghi sau

        // 7. Ghi lên blockchain (ngoài transaction)
        const txHash = await logCorrectionOnChain({
          requestId: parseInt(id),
          batchId: request.batch_id,
          adminId,
          farmerId: request.farmer_id,
          changedFields,
          originalData,
          correctedData,
          reason: request.reason,
        });

        // 8. Nếu ghi chain thành công → lưu tx_hash vào DB
        if (txHash) {
          await db.query(
            `UPDATE batch_correction_requests
             SET blockchain_tx_hash = ?, blockchain_logged_at = NOW()
             WHERE id = ?`,
            [txHash, id],
          );

          await db.query(
            `INSERT INTO batch_correction_history
               (correction_request_id, batch_id, changed_by_admin_id, changed_by_name,
                changed_by_role, action, blockchain_tx_hash, note)
             VALUES (?, ?, ?, ?, 'admin', 'blockchain_recorded', ?, 'Đã ghi lên blockchain')`,
            [id, request.batch_id, adminId, adminName, txHash],
          );
        } else {
          console.warn(
            `[Correction] ⚠️  Blockchain log thất bại cho request #${id}. ` +
              "DB đã commit OK. Kiểm tra OWNER_PRIVATE_KEY trong .env.",
          );
        }

        return res.json({
          success: true,
          message: `Phê duyệt thành công. Đã cập nhật ${changedFields.length} trường trên toàn bộ chuỗi cung ứng.`,
          data: {
            correctionRequestId: parseInt(id),
            batchId: request.batch_id,
            changedFields,
            updatedData: allowedUpdates,
            blockchainTxHash: txHash || null,
            blockchainStatus: txHash ? "recorded" : "pending_manual",
          },
        });
      } catch (err) {
        await conn.rollback();
        console.error("[Correction] Approve error:", err);
        return res.status(500).json({ success: false, error: err.message });
      } finally {
        conn.release();
      }
    },
  );

  // ==========================================================================
  // ADMIN: Từ chối yêu cầu
  // POST /api/correction/:id/reject
  // ==========================================================================
  app.post(
    "/api/correction/:id/reject",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const adminId = req.session.adminId;
        const { id } = req.params;
        const { note } = req.body;

        if (!note || note.trim().length < 5) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            error: "Vui lòng nhập lý do từ chối (≥5 ký tự)",
          });
        }

        const [reqs] = await conn.query(
          `SELECT * FROM batch_correction_requests WHERE id = ? AND status = 'pending'`,
          [id],
        );
        if (reqs.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            success: false,
            error: "Không tìm thấy hoặc đã xử lý",
          });
        }

        const request = reqs[0];
        const [[adminRow]] = await conn.query(
          `SELECT admin_name FROM admin WHERE id = ?`,
          [adminId],
        );
        const adminName = adminRow?.admin_name || "Admin";

        await conn.query(
          `UPDATE batch_correction_requests
           SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
           WHERE id = ?`,
          [adminId, note.trim(), id],
        );

        await conn.query(
          `INSERT INTO batch_correction_history
             (correction_request_id, batch_id, changed_by_admin_id, changed_by_name,
              changed_by_role, action, note)
           VALUES (?, ?, ?, ?, 'admin', 'rejected', ?)`,
          [id, request.batch_id, adminId, adminName, note.trim()],
        );

        await conn.commit();

        return res.json({
          success: true,
          message: "Đã từ chối yêu cầu đính chính",
          data: { correctionRequestId: parseInt(id) },
        });
      } catch (err) {
        await conn.rollback();
        console.error("[Correction] Reject error:", err);
        return res.status(500).json({ success: false, error: err.message });
      } finally {
        conn.release();
      }
    },
  );

  // ==========================================================================
  // ADMIN: Thống kê
  // GET /api/correction/stats
  // ==========================================================================
  app.get(
    "/api/correction/stats",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const [[stats]] = await db.query(
          `SELECT COUNT(*) AS total,
                  SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending,
                  SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
                  SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected
           FROM batch_correction_requests`,
        );
        return res.json({ success: true, data: stats });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // ==========================================================================
  // PUBLIC: Lịch sử đính chính của lô hàng
  // GET /api/correction/history/:batchId
  // ==========================================================================
  app.get("/api/correction/history/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;

      const [history] = await db.query(
        `SELECT cr.id, cr.status, cr.reason, cr.changed_fields,
                cr.original_data, cr.corrected_data,
                cr.requested_at, cr.reviewed_at, cr.review_note,
                cr.blockchain_tx_hash,
                u.name AS farmer_name,
                a.admin_name AS reviewed_by_name
         FROM batch_correction_requests cr
         JOIN users u ON cr.requested_by = u.uid
         LEFT JOIN admin a ON cr.reviewed_by = a.id
         WHERE cr.batch_id = ? AND cr.status = 'approved'
         ORDER BY cr.reviewed_at DESC`,
        [batchId],
      );

      return res.json({
        success: true,
        data: history.map((h) => ({
          ...h,
          changed_fields: parseJSON(h.changed_fields, []),
          original_data: parseJSON(h.original_data, {}),
          corrected_data: parseJSON(h.corrected_data, {}),
          verifiable: !!h.blockchain_tx_hash,
        })),
      });
    } catch (err) {
      console.error("[Correction] History error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  console.log("✅ Correction routes registered");
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseJSON(str, fallback) {
  try {
    if (typeof str === "object") return str;
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = { setupCorrectionRoutes };
