/**
 * MIDDLEWARE XÁC THỰC ROLE THEO QUYẾT ĐỊNH 5272
 * Đảm bảo mỗi endpoint chỉ được truy cập bởi role phù hợp
 */

// Định nghĩa roles (khớp với database)
const ROLES = {
  FARMER: 1, // Nông dân
  INSPECTOR: 2, // Kiểm duyệt
  PURCHASER: 3, // Thu mua
  PROCESSOR: 4, // Sơ chế
  QUALITY_INSPECTOR: 5, // Kiểm nghiệm
  TRANSPORTER: 6, // Vận chuyển
  DISTRIBUTOR: 7, // Phân phối
  WAREHOUSE: 8, // Kho
  ADMIN: 9, // Admin
};

/**
 * Middleware kiểm tra user đã đăng nhập
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: "Vui lòng đăng nhập để tiếp tục",
      code: "UNAUTHORIZED",
    });
  }
  next();
}

/**
 * Middleware kiểm tra role cụ thể
 * @param {Array} allowedRoles - Mảng các role_id được phép
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: "Vui lòng đăng nhập",
        code: "UNAUTHORIZED",
      });
    }

    const userRole = req.session.roleId;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Bạn không có quyền truy cập chức năng này",
        code: "FORBIDDEN",
        requiredRoles: allowedRoles,
        yourRole: userRole,
      });
    }

    next();
  };
}

/**
 * Middleware kiểm tra owner (người tạo batch/product)
 * Sử dụng cho các endpoint update/delete
 */
async function requireOwnership(req, res, next) {
  // Implement logic kiểm tra ownership nếu cần
  // Ví dụ: chỉ farmer tạo batch mới được update batch đó
  next();
}

/**
 * Helper: Lấy tên role từ role_id
 */
function getRoleName(roleId) {
  const roleNames = {
    1: "Nông dân",
    2: "Kiểm duyệt",
    3: "Thu mua",
    4: "Sơ chế",
    5: "Kiểm nghiệm",
    6: "Vận chuyển",
    7: "Phân phối",
    8: "Kho",
    9: "Admin",
  };
  return roleNames[roleId] || "Không xác định";
}

module.exports = {
  ROLES,
  requireAuth,
  requireRole,
  requireOwnership,
  getRoleName,
};
