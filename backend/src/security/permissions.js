const USER_ROLES = [
  { code: 'admin', name: 'ادمین' },
  { code: 'technician', name: 'تکنسین فنی' },
  { code: 'sales', name: 'کارشناس فروش' }
];

const USER_ROLE_CODES = USER_ROLES.map(role => role.code);
const PASSWORD_MIN_LENGTH = 4;

const PERMISSION_CATALOG = [
  { code: 'menus.home', name: 'نمایش منوی صفحه اصلی', group: 'منوها' },
  { code: 'menus.users', name: 'نمایش منوی مدیریت کاربران', group: 'منوها' },
  { code: 'menus.lookups', name: 'نمایش منوی مدیریت اطلاعات پایه', group: 'منوها' },
  { code: 'menus.archive', name: 'نمایش منوی بایگانی', group: 'منوها' },
  { code: 'menus.reports', name: 'نمایش منوی گزارش ها', group: 'منوها' },
  { code: 'menus.logs', name: 'نمایش منوی فعالیت ها', group: 'منوها' },
  { code: 'menus.account', name: 'نمایش منوی تنظیمات حساب کاربری', group: 'منوها' },
  { code: 'orders.view', name: 'مشاهده فاکتورها', group: 'فاکتورها' },
  { code: 'orders.create', name: 'ثبت فاکتور جدید', group: 'فاکتورها' },
  { code: 'orders.update', name: 'ویرایش اطلاعات اصلی فاکتور', group: 'فاکتورها' },
  { code: 'orders.delete', name: 'حذف فاکتور', group: 'فاکتورها' },
  { code: 'orders.priority', name: 'جابجایی اولویت فاکتور', group: 'فاکتورها' },
  { code: 'orders.technical', name: 'مدیریت وضعیت، توضیحات فنی و تکنسین‌ها', group: 'فاکتورها' },
  { code: 'orders.serials', name: 'مدیریت سریال‌ها', group: 'فاکتورها' },
  { code: 'orders.sales_notes', name: 'مدیریت توضیحات فروشنده', group: 'فاکتورها' },
  { code: 'orders.related', name: 'مدیریت فاکتورهای وابسته', group: 'فاکتورها' },
  { code: 'archive.view', name: 'مشاهده بایگانی فاکتورها', group: 'بایگانی' },
  { code: 'reports.view', name: 'مشاهده گزارش ها', group: 'گزارش ها' },
  { code: 'logs.view', name: 'مشاهده فعالیت کاربران', group: 'فعالیت ها' },
  { code: 'account.change_password', name: 'تغییر رمز عبور خود کاربر', group: 'تنظیمات حساب کاربری' },
  { code: 'users.view', name: 'مشاهده کاربران', group: 'مدیریت کاربران' },
  { code: 'users.create', name: 'ساخت کاربر', group: 'مدیریت کاربران' },
  { code: 'users.update', name: 'ویرایش کاربر', group: 'مدیریت کاربران' },
  { code: 'users.delete', name: 'حذف / غیرفعال‌سازی کاربر', group: 'مدیریت کاربران' },
  { code: 'users.permissions', name: 'تعیین دسترسی‌های کاربر', group: 'مدیریت کاربران' },
  { code: 'users.priority', name: 'جابه‌جایی ترتیب کاربران', group: 'مدیریت کاربران' },
  { code: 'lookups.view', name: 'مشاهده اطلاعات پایه', group: 'اطلاعات پایه' },
  { code: 'lookups.create', name: 'افزودن اطلاعات پایه', group: 'اطلاعات پایه' },
  { code: 'lookups.update', name: 'ویرایش اطلاعات پایه', group: 'اطلاعات پایه' },
  { code: 'lookups.delete', name: 'حذف / غیرفعال‌سازی اطلاعات پایه', group: 'اطلاعات پایه' },
  { code: 'lookups.priority', name: 'جابه‌جایی ترتیب اطلاعات پایه', group: 'اطلاعات پایه' }
];

const PERMISSION_CODES = PERMISSION_CATALOG.map(item => item.code);
const ALL_PERMISSIONS = PERMISSION_CODES.reduce((acc, code) => ({ ...acc, [code]: true }), {});

const ROLE_DEFAULT_PERMISSIONS = {
  admin: ALL_PERMISSIONS,
  technician: {
    'menus.home': true,
    'menus.archive': true,
    'menus.account': true,
    'orders.view': true,
    'archive.view': true,
    'account.change_password': true
  },
  sales: {
    'menus.home': true,
    'menus.archive': true,
    'menus.account': true,
    'orders.view': true,
    'archive.view': true,
    'account.change_password': true
  }
};

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(role) {
  return USER_ROLE_CODES.includes(role) ? role : 'sales';
}

function normalizeRoles(input = []) {
  const source = Array.isArray(input) ? input : [input].filter(Boolean);
  const roles = source.map(normalizeRole).filter((role, index, arr) => arr.indexOf(role) === index);
  return roles.length ? roles : ['sales'];
}

function getRoleName(role) {
  const found = USER_ROLES.find(item => item.code === role);
  return found ? found.name : role;
}

function getRoleNames(roles = []) {
  return normalizeRoles(roles).map(getRoleName).join('، ');
}

function buildDefaultPermissionsForRoles(roles = ['sales']) {
  const output = {};
  normalizeRoles(roles).forEach(role => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] || {};
    Object.entries(defaults).forEach(([code, value]) => {
      if (value) output[code] = true;
      else if (!Object.prototype.hasOwnProperty.call(output, code)) output[code] = false;
    });
  });
  return output;
}

function normalizePermissions(roleOrRoles, input = {}) {
  const roles = Array.isArray(roleOrRoles) ? normalizeRoles(roleOrRoles) : normalizeRoles([roleOrRoles]);
  const base = buildDefaultPermissionsForRoles(roles);
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const output = {};
  PERMISSION_CODES.forEach(code => {
    output[code] = Boolean(Object.prototype.hasOwnProperty.call(source, code) ? source[code] : base[code]);
  });
  return output;
}

function sanitizeUser(row) {
  if (!row) return null;
  const roles = normalizeRoles(row.roles && Array.isArray(row.roles) ? row.roles : [row.role]);
  const role = normalizeRole(row.role || roles[0]);
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role,
    roles,
    role_name: getRoleName(role),
    role_names: getRoleNames(roles),
    is_active: Boolean(row.is_active),
    seller_lookup_id: row.seller_lookup_id || null,
    display_order: Number(row.display_order || 0),
    permissions: normalizePermissions(roles, row.permissions || {})
  };
}

function userHasPermission(user, permission) {
  if (!user) return false;
  return Boolean((user.permissions || {})[permission]);
}

function createAuthHelpers({ pool, verifyToken }) {
  async function authenticateRequest(request, reply) {
    const header = request.headers.authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    if (!match) return reply.status(401).send({ error: 'برای استفاده از سیستم ابتدا وارد شوید.' });

    let payload;
    try {
      payload = verifyToken(match[1]);
    } catch (err) {
      payload = null;
    }

    if (!payload || !payload.sub) {
      return reply.status(401).send({ error: 'نشست شما نامعتبر یا منقضی شده است.' });
    }

    const result = await pool.query(
      'SELECT id, username, full_name, role, roles, permissions, is_active, seller_lookup_id FROM app_users WHERE id = $1',
      [payload.sub]
    );

    if (result.rowCount === 0 || !result.rows[0].is_active) {
      return reply.status(401).send({ error: 'کاربر غیرفعال یا حذف شده است.' });
    }

    request.user = sanitizeUser(result.rows[0]);
  }

  function requirePermission(request, reply, permission) {
    if (!userHasPermission(request.user, permission)) {
      reply.status(403).send({ error: 'شما دسترسی لازم برای این عملیات را ندارید.' });
      return false;
    }
    return true;
  }

  return { authenticateRequest, requirePermission };
}

module.exports = {
  USER_ROLES,
  USER_ROLE_CODES,
  PASSWORD_MIN_LENGTH,
  PERMISSION_CATALOG,
  PERMISSION_CODES,
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  normalizeUsername,
  normalizeRole,
  normalizeRoles,
  getRoleName,
  getRoleNames,
  normalizePermissions,
  sanitizeUser,
  userHasPermission,
  createAuthHelpers
};
