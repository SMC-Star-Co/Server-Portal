const fastify = require('fastify')({ logger: true });
const { APP_TIME_ZONE, INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_PASSWORD } = require('./config/env');
const { pool } = require('./config/database');
const { registerInvoiceMedia, initMediaTable, cleanMedia } = require('./invoice-media');
const { realtimeClients, broadcastRealtimeEvent } = require('./realtime/events');
const {
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
} = require('./security/permissions');
const { hashPassword, verifyPassword } = require('./security/password');
const { createJwtHelpers } = require('./security/jwt');
const {
  toJalaliDateTime,
  toJalaliDateTimeWithSeconds,
  getJalaliDatePart,
  getAppTimeParts,
  pad2
} = require('./utils/jalali-date');

const { signToken, verifyToken, secondsUntilNextServerMidnight } = createJwtHelpers({ getAppTimeParts, pad2 });
const { authenticateRequest, requirePermission } = createAuthHelpers({ pool, verifyToken });


function getBackendStatusLabel(status) {
  const found = FIXED_ORDER_STATUSES.find(item => item.code === status);
  return found ? found.name : (status || '-');
}

function actorDisplayName(user) {
  if (!user) return 'کاربر سیستم';
  return `${user.full_name || 'کاربر'} (${user.username || '-'})`;
}

function normalizeLogDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  return details;
}

const ALLOWED_ACTIVITY_ACTIONS = new Set([
  'order.created',
  'order.status_changed',
  'order.serials_updated',
  'order.serial_copied',
  'order.technical_note_created',
  'order.technical_note_updated',
  'order.technical_note_deleted',
  'order.technicians_updated',
  'order.seller_note_created',
  'order.seller_note_updated',
  'order.seller_note_deleted',
  'order.related_updated',
  'order.priority_changed',
  'order.updated',
  'order.deleted',
  'order.media_uploaded',
  'order.media_deleted',
  'order.media_replaced'
]);

async function writeActivityLog(payload = {}, client = pool) {
  if (!ALLOWED_ACTIVITY_ACTIONS.has(payload.action_type || 'activity')) return;
  try {
    const actor = payload.user || payload.request?.user || null;
    const createdAtJalali = toJalaliDateTimeWithSeconds(new Date());
    await client.query(
      `INSERT INTO activity_logs
       (user_id, username, user_full_name, action_type, entity_type, entity_id, invoice_number, message, details, created_at_jalali)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        actor?.id || null,
        actor?.username || null,
        actor?.full_name || null,
        payload.action_type || 'activity',
        payload.entity_type || null,
        payload.entity_id || null,
        payload.invoice_number || null,
        payload.message || 'فعالیت ثبت شد.',
        JSON.stringify(normalizeLogDetails(payload.details)),
        createdAtJalali
      ]
    );
  } catch (err) {
    console.error('Activity Log Error:', err.message);
  }
}

function parseLogNoteTexts(value) {
  return parseLogNotes(value).map(item => item.text).filter(Boolean);
}

function parseLogNotes(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (item && typeof item === 'object') {
          return {
            id: String(item.id || `row-${index}`),
            text: String(item.text ?? '').trim(),
            created_at: String(item.created_at || '')
          };
        }
        return { id: `row-${index}`, text: String(item ?? '').trim(), created_at: '' };
      })
      .filter(item => item.text);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseLogNotes(parsed);
    } catch (e) {
      return String(value).split('\n').map((text, index) => ({ id: `line-${index}`, text: text.trim(), created_at: '' })).filter(item => item.text);
    }
  }
  return [];
}

function readableDetails(lines = []) {
  const cleanLines = (Array.isArray(lines) ? lines : [lines]).map(item => String(item || '').trim()).filter(Boolean);
  return cleanLines.length ? { lines: cleanLines } : {};
}

function buildTextListChangeDetails(beforeTexts = [], afterTexts = []) {
  const lines = [];
  const max = Math.max(beforeTexts.length, afterTexts.length);
  for (let i = 0; i < max; i++) {
    const beforeText = beforeTexts[i] || '';
    const afterText = afterTexts[i] || '';
    if (beforeText && !afterText) lines.push(`حذف شد: ${beforeText}`);
    else if (!beforeText && afterText) lines.push(`ثبت شد: ${afterText}`);
    else if (beforeText !== afterText) {
      lines.push(`ویرایش شد:`);
      lines.push(`قبل: ${beforeText || '-'}`);
      lines.push(`بعد: ${afterText || '-'}`);
    }
  }
  return readableDetails(lines);
}

function buildNoteChangeMessages(beforeValue, afterValue, invoice, options = {}) {
  const beforeNotes = parseLogNotes(beforeValue);
  const afterNotes = parseLogNotes(afterValue);
  const beforeById = new Map(beforeNotes.map(note => [note.id, note]));
  const afterById = new Map(afterNotes.map(note => [note.id, note]));
  const usedBefore = new Set();
  const messages = [];
  const label = options.label || 'توضیح';
  const createdType = options.createdType || 'order.note_created';
  const updatedType = options.updatedType || 'order.note_updated';
  const deletedType = options.deletedType || 'order.note_deleted';

  afterNotes.forEach((afterNote, index) => {
    let beforeNote = beforeById.get(afterNote.id);
    if (!beforeNote && beforeNotes[index] && !afterById.has(beforeNotes[index].id)) beforeNote = beforeNotes[index];
    if (beforeNote) {
      usedBefore.add(beforeNote.id);
      if (beforeNote.text !== afterNote.text) {
        messages.push({
          action_type: updatedType,
          message: `${label} فاکتور ${invoice} ویرایش شد.`,
          details: readableDetails([`قبل: ${beforeNote.text || '-'}`, `بعد: ${afterNote.text || '-'}`])
        });
      }
    } else {
      messages.push({
        action_type: createdType,
        message: `${label} جدید برای فاکتور ${invoice} ثبت شد.`,
        details: readableDetails([`متن ثبت‌شده: ${afterNote.text}`])
      });
    }
  });

  beforeNotes.forEach(beforeNote => {
    if (!usedBefore.has(beforeNote.id) && !afterById.has(beforeNote.id)) {
      messages.push({
        action_type: deletedType,
        message: `${label} فاکتور ${invoice} حذف شد.`,
        details: readableDetails([`متن حذف‌شده: ${beforeNote.text}`])
      });
    }
  });

  return messages;
}

function activeTechnicianList(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.entries(source).filter(([, isActive]) => Boolean(isActive)).map(([name]) => name);
}

function buildSerialChangeDetails(beforeValue = '', afterValue = '') {
  const beforeList = String(beforeValue || '').split(',').map(item => item.trim()).filter(Boolean);
  const afterList = String(afterValue || '').split(',').map(item => item.trim()).filter(Boolean);
  const lines = [];
  const max = Math.max(beforeList.length, afterList.length);
  for (let i = 0; i < max; i++) {
    const beforeSerial = beforeList[i] || '';
    const afterSerial = afterList[i] || '';
    if (beforeSerial && !afterSerial) lines.push(`سریال حذف‌شده: ${beforeSerial}`);
    else if (!beforeSerial && afterSerial) lines.push(`سریال ثبت‌شده: ${afterSerial}`);
    else if (beforeSerial !== afterSerial) {
      lines.push(`سریال ویرایش‌شده:`);
      lines.push(`قبل: ${beforeSerial || '-'}`);
      lines.push(`بعد: ${afterSerial || '-'}`);
    }
  }
  if (!lines.length && (beforeList.length || afterList.length)) {
    lines.push(`قبل: ${beforeList.join(', ') || '-'}`);
    lines.push(`بعد: ${afterList.join(', ') || '-'}`);
  }
  return readableDetails(lines);
}

function buildOrderChangeMessages(before = {}, after = {}, body = {}) {
  const messages = [];
  const invoice = after.invoice_number || before.invoice_number || '-';

  if (Object.prototype.hasOwnProperty.call(body, 'status') && before.status !== after.status) {
    const fromLabel = getBackendStatusLabel(before.status);
    const toLabel = getBackendStatusLabel(after.status);
    messages.push({
      action_type: 'order.status_changed',
      message: `وضعیت فاکتور ${invoice} از ${fromLabel} به ${toLabel} تغییر کرد.`,
      details: readableDetails([`وضعیت قبلی: ${fromLabel}`, `وضعیت جدید: ${toLabel}`])
    });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'serials') && String(before.serials || '') !== String(after.serials || '')) {
    messages.push({ action_type: 'order.serials_updated', message: `سریال‌های فاکتور ${invoice} مدیریت شد.`, details: buildSerialChangeDetails(before.serials, after.serials) });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'technical_notes')) {
    messages.push(...buildNoteChangeMessages(before.technical_notes, after.technical_notes, invoice, {
      label: 'توضیح فنی',
      createdType: 'order.technical_note_created',
      updatedType: 'order.technical_note_updated',
      deletedType: 'order.technical_note_deleted'
    }));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'seller_notes')) {
    messages.push(...buildNoteChangeMessages(before.seller_notes, after.seller_notes, invoice, {
      label: 'توضیح فروشنده',
      createdType: 'order.seller_note_created',
      updatedType: 'order.seller_note_updated',
      deletedType: 'order.seller_note_deleted'
    }));
  }

  if (Object.prototype.hasOwnProperty.call(body, 'technician_assignments')) {
    const beforeActive = activeTechnicianList(before.technician_assignments);
    const afterActive = activeTechnicianList(after.technician_assignments);
    if (JSON.stringify(beforeActive) !== JSON.stringify(afterActive)) {
      messages.push({
        action_type: 'order.technicians_updated',
        message: `تکنسین‌های در حال انجام کار فاکتور ${invoice} به‌روزرسانی شد.`,
        details: readableDetails([
          `قبل: ${beforeActive.length ? beforeActive.join('، ') : 'بدون تکنسین فعال'}`,
          `بعد: ${afterActive.length ? afterActive.join('، ') : 'بدون تکنسین فعال'}`
        ])
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'related_invoices') && String(before.related_invoices || '') !== String(after.related_invoices || '')) {
    messages.push({
      action_type: 'order.related_updated',
      message: `فاکتورهای وابسته فاکتور ${invoice} به‌روزرسانی شد.`,
      details: readableDetails([`قبل: ${before.related_invoices || '-'}`, `بعد: ${after.related_invoices || '-'}`])
    });
  }

  return messages;
}

async function createSellerLookupForUser(client, fullName) {
  const existing = await client.query('SELECT id FROM sellers WHERE TRIM(name) = TRIM($1) LIMIT 1', [fullName]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const inserted = await client.query('INSERT INTO sellers (name) VALUES ($1) RETURNING id', [fullName]);
  return inserted.rows[0].id;
}

async function syncUserSellerLookup(client, userId, role, fullName, currentSellerLookupId = null) {
  if (role !== 'sales') {
    await client.query('UPDATE app_users SET seller_lookup_id = NULL, updated_at = NOW() WHERE id = $1', [userId]);
    return null;
  }

  let sellerId = currentSellerLookupId;
  if (sellerId) {
    await client.query('UPDATE sellers SET name = $1 WHERE id = $2', [fullName, sellerId]);
  } else {
    sellerId = await createSellerLookupForUser(client, fullName);
  }

  await client.query('UPDATE app_users SET seller_lookup_id = $1, updated_at = NOW() WHERE id = $2', [sellerId, userId]);
  return sellerId;
}

async function getActiveTechnicianNames(client = pool) {
  const result = await client.query(
    "SELECT full_name FROM app_users WHERE (role = 'technician' OR COALESCE(roles, jsonb_build_array(role)) ? 'technician') AND is_active = true ORDER BY display_order ASC, full_name ASC"
  );
  return result.rows.map(row => row.full_name);
}

const FIXED_ORDER_STATUSES = [
  { code: 'Pending', name: 'در انتظار انجام' },
  { code: 'Waiting-Goods', name: 'در انتظار دریافت کالا' },
  { code: 'In-Progress', name: 'در حال انجام' },
  { code: 'Cancelled', name: 'کنسل شده' },
  { code: 'Returned', name: 'برگشت خورده' },
  { code: 'Completed', name: 'تکمیل شده' }
];

const VALID_STATUS_CODES = FIXED_ORDER_STATUSES.map(status => status.code);
const MANAGED_LOOKUP_TABLES = new Set([
  'sellers',
  'cities',
  'device_models',
  'warehouses',
  'warranties',
  'config_types',
  'order_statuses'
]);

function assertManagedLookupTable(tableName) {
  if (!MANAGED_LOOKUP_TABLES.has(tableName)) {
    throw new Error(`Invalid lookup table: ${tableName}`);
  }
}

async function resetLookupSequence(client, tableName) {
  assertManagedLookupTable(tableName);
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence($1, 'id'),
      COALESCE((SELECT MAX(id) FROM ${tableName}), 1),
      true
    )
  `, [tableName]);
}

async function ensureLookupTable(client, tableName, nameColumnType = 'TEXT') {
  assertManagedLookupTable(tableName);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id SERIAL PRIMARY KEY,
      name ${nameColumnType} NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true
    )
  `);

  await client.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
  await client.query(`UPDATE ${tableName} SET display_order = id WHERE display_order IS NULL OR display_order = 0`);
  await client.query(`CREATE INDEX IF NOT EXISTS ${tableName}_display_order_idx ON ${tableName} (display_order ASC, id ASC)`);
  await client.query(`DROP INDEX IF EXISTS ${tableName}_name_unique_idx`);
  await client.query(`CREATE UNIQUE INDEX ${tableName}_name_unique_idx ON ${tableName} (name)`);
  await resetLookupSequence(client, tableName);
}

async function syncOrderStatuses(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS order_statuses (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    )
  `);

  for (let i = 0; i < FIXED_ORDER_STATUSES.length; i++) {
    const status = FIXED_ORDER_STATUSES[i];
    await client.query(
      `INSERT INTO order_statuses (id, code, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name`,
      [i + 1, status.code, status.name]
    );
  }

  await client.query(
    `DELETE FROM order_statuses WHERE NOT (code = ANY($1::text[]))`,
    [VALID_STATUS_CODES]
  );

  await resetLookupSequence(client, 'order_statuses');

  await client.query(`
    UPDATE orders
    SET status = CASE
      WHEN status = 'Pending' THEN 'Pending'
      WHEN status = 'Waiting-Goods' THEN 'Waiting-Goods'
      WHEN status = 'In-Progress' THEN 'In-Progress'
      WHEN status = 'Cancelled' THEN 'Cancelled'
      WHEN status = 'Returned' THEN 'Returned'
      WHEN status = 'Completed' THEN 'Completed'
      WHEN status ILIKE '%دریافت کالا%' THEN 'Waiting-Goods'
      WHEN status ILIKE '%در حال%' THEN 'In-Progress'
      WHEN status ILIKE '%تکمیل%' THEN 'Completed'
      WHEN status ILIKE '%کنسل%' THEN 'Cancelled'
      WHEN status ILIKE '%برگشت%' THEN 'Returned'
      ELSE 'Pending'
    END
    WHERE status IS NULL OR NOT (status = ANY($1::text[]))
  `, [VALID_STATUS_CODES]);
}

function normalizeTechnicianAssignments(value = {}, allowedNames = []) {
  const output = {};
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const baseNames = Array.isArray(allowedNames) && allowedNames.length ? allowedNames : Object.keys(source);
  const names = Array.from(new Set(baseNames));
  names.forEach(name => {
    output[name] = Boolean(source[name]);
  });
  return output;
}

function normalizeTechnicalNotes(value = []) {
  const rawNotes = Array.isArray(value) ? value : [];
  return rawNotes
    .map((note, index) => ({
      id: String(note && note.id ? note.id : `${Date.now()}-${index}`),
      text: String(note && note.text ? note.text : '').trim(),
      created_at: String(note && note.created_at ? note.created_at : '')
    }))
    .filter(note => note.text);
}

function normalizeSellerNotes(value = []) {
  return normalizeTechnicalNotes(value);
}

async function syncSellers(client) {
  await ensureLookupTable(client, 'sellers', 'VARCHAR(50)');
}

async function syncCities(client) {
  await ensureLookupTable(client, 'cities', 'VARCHAR(50)');
}

async function syncDeviceModels(client) {
  await ensureLookupTable(client, 'device_models', 'VARCHAR(255)');
}

async function syncWarehouses(client) {
  await ensureLookupTable(client, 'warehouses', 'VARCHAR(50)');
}

async function syncConfigTypes(client) {
  await ensureLookupTable(client, 'config_types', 'TEXT');
}

const LOOKUP_RESOURCE_CONFIG = {
  cities: {
    table: 'cities',
    title: 'شهرها',
    nameLabel: 'شهر',
    orderColumn: 'city_id',
    usageSql: 'SELECT COUNT(*)::int AS count FROM orders WHERE city_id = $1'
  },
  device_models: {
    table: 'device_models',
    title: 'مدل سرورها',
    nameLabel: 'مدل سرور',
    orderColumn: 'device_model',
    usageSql: 'SELECT COUNT(*)::int AS count FROM orders WHERE device_model = $1'
  },
  warehouses: {
    table: 'warehouses',
    title: 'انبارها',
    nameLabel: 'انبار',
    orderColumn: 'warehouse_id',
    usageSql: 'SELECT COUNT(*)::int AS count FROM orders WHERE warehouse_id = $1'
  },
  warranties: {
    table: 'warranties',
    title: 'گارانتی‌ها',
    nameLabel: 'گارانتی',
    orderColumn: 'warranty',
    usageSql: 'SELECT COUNT(*)::int AS count FROM orders WHERE warranty = $1::text OR warranty = $2'
  },
  config_types: {
    table: 'config_types',
    title: 'نوع کانفیگ‌ها',
    nameLabel: 'نوع کانفیگ',
    orderColumn: 'config_type',
    usageSql: 'SELECT COUNT(*)::int AS count FROM orders WHERE config_type = $1',
    usageParam: 'name'
  }
};

function getLookupConfig(type) {
  const config = LOOKUP_RESOURCE_CONFIG[String(type || '').trim()];
  if (!config) return null;
  assertManagedLookupTable(config.table);
  return config;
}

function normalizeLookupName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

async function getLookupUsageCount(client, config, id, name) {
  let params;
  if (config.usageParam === 'name') {
    params = [String(name || '')];
  } else if (String(config.usageSql || '').includes('$2')) {
    params = [Number(id), String(name || '')];
  } else {
    params = [Number(id)];
  }
  const result = await client.query(config.usageSql, params);
  return Number(result.rows[0]?.count || 0);
}

async function normalizeLookupDisplayOrder(client, tableName) {
  assertManagedLookupTable(tableName);
  await client.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY display_order ASC, id ASC) AS rn
      FROM ${tableName}
    )
    UPDATE ${tableName}
    SET display_order = ranked.rn
    FROM ranked
    WHERE ${tableName}.id = ranked.id
  `);
}

async function ensureLookupNameIsUnique(client, tableName, name, exceptId = null) {
  assertManagedLookupTable(tableName);
  const values = [name];
  let idClause = '';
  if (exceptId) {
    values.push(Number(exceptId));
    idClause = `AND id <> $${values.length}`;
  }
  const duplicate = await client.query(
    `SELECT id FROM ${tableName} WHERE LOWER(name) = LOWER($1) ${idClause} LIMIT 1`,
    values
  );
  return duplicate.rowCount === 0;
}


async function syncUsersSecurity(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      roles JSONB NOT NULL DEFAULT '[]'::jsonb,
      password_hash TEXT NOT NULL,
      permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      seller_lookup_id INTEGER,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS seller_lookup_id INTEGER`);
  await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
  await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS roles JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await client.query(`UPDATE app_users SET roles = jsonb_build_array(role) WHERE roles IS NULL OR jsonb_typeof(roles) <> 'array' OR jsonb_array_length(roles) = 0`);
  await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await client.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);
  await client.query(`CREATE INDEX IF NOT EXISTS app_users_role_active_idx ON app_users (role, is_active)`);
  await client.query(`CREATE INDEX IF NOT EXISTS app_users_role_order_idx ON app_users (role, display_order)`);

  const admin = await client.query('SELECT id FROM app_users WHERE username = $1', [normalizeUsername(INITIAL_ADMIN_USERNAME)]);
  if (admin.rowCount === 0) {
    await client.query(
      `INSERT INTO app_users (username, full_name, role, roles, password_hash, permissions, is_active)
       VALUES ($1, $2, 'admin', '["admin"]'::jsonb, $3, $4::jsonb, true)`,
      [normalizeUsername(INITIAL_ADMIN_USERNAME), 'ادمین سیستم', hashPassword(INITIAL_ADMIN_PASSWORD), JSON.stringify(ALL_PERMISSIONS)]
    );
  } else {
    await client.query(
      `UPDATE app_users SET role = 'admin', roles = '["admin"]'::jsonb, is_active = true, updated_at = NOW() WHERE id = $1`,
      [admin.rows[0].id]
    );
  }

  // از این مرحله به بعد، کاربر فروش/تکنسین فقط از داخل پنل مدیریت کاربران ساخته می‌شود.
  // دیتای اولیه فروشندگان و تکنسین‌ها دیگر به‌صورت خودکار از کد وارد دیتابیس نمی‌شود.

  await client.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY role ORDER BY NULLIF(display_order, 0) ASC NULLS LAST, created_at ASC, id ASC) AS rn
      FROM app_users
    )
    UPDATE app_users
    SET display_order = ranked.rn
    FROM ranked
    WHERE app_users.id = ranked.id
      AND (app_users.display_order IS NULL OR app_users.display_order = 0)
  `);

  const users = await client.query('SELECT id, role, roles, permissions FROM app_users');
  for (const user of users.rows) {
    const roles = normalizeRoles(user.roles && Array.isArray(user.roles) ? user.roles : [user.role]);
    await client.query(
      'UPDATE app_users SET roles = $1::jsonb, permissions = $2::jsonb WHERE id = $3',
      [JSON.stringify(roles), JSON.stringify(normalizePermissions(roles, user.permissions)), user.id]
    );
  }
}

// اضافه شدن Methods برای رفع خطای ارتباطی (CORS Preflight)
fastify.register(require('@fastify/cors'), {
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// همگام‌سازی دیتابیس برای فیلدهای جدید و پاکسازی لیست‌های پایه
const initDB = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        priority INTEGER DEFAULT 1,
        invoice_number VARCHAR(100),
        quantity INTEGER DEFAULT 1,
        device_model INTEGER,
        seller_id INTEGER,
        city_id INTEGER,
        warehouse_id INTEGER,
        order_date DATE DEFAULT CURRENT_DATE,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        buyer_name VARCHAR(255),
        config_type VARCHAR(50),
        seller_description TEXT,
        technical_description TEXT,
        serials TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS warranties (id SERIAL PRIMARY KEY, name TEXT, display_order INTEGER NOT NULL DEFAULT 0);
      ALTER TABLE warranties ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS purchase_number TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS warranty TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS related_invoices TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at_jalali TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS config_type VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS technical_description TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS technical_notes JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_notes JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS technician_assignments JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS serials TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username TEXT,
        user_full_name TEXT,
        action_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        invoice_number TEXT,
        message TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_jalali TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS activity_logs_user_idx ON activity_logs (user_id);
      CREATE INDEX IF NOT EXISTS activity_logs_invoice_idx ON activity_logs (invoice_number);
      CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON activity_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS activity_logs_jalali_idx ON activity_logs (created_at_jalali);
    `);

    await syncOrderStatuses(client);
    await syncSellers(client);
    await syncCities(client);
    await syncDeviceModels(client);
    await syncConfigTypes(client);
    await syncWarehouses(client);
    await syncUsersSecurity(client);

    const oldOrders = await client.query(`
      SELECT id, created_at
      FROM orders
      WHERE created_at IS NOT NULL
        AND (created_at_jalali IS NULL OR created_at_jalali = '')
    `);

    for (const order of oldOrders.rows) {
      await client.query(
        'UPDATE orders SET created_at_jalali = $1 WHERE id = $2',
        [toJalaliDateTime(order.created_at), order.id]
      );
    }

    await client.query(`
      UPDATE orders
      SET created_at_jalali = regexp_replace(created_at_jalali, '( - [0-9]{2})/([0-9]{2})$', '\\1:\\2')
      WHERE created_at_jalali ~ ' - [0-9]{2}/[0-9]{2}$'
    `);

    await client.query(`
      UPDATE orders
      SET technical_notes = jsonb_build_array(
        jsonb_build_object(
          'id', 'old-' || id::text,
          'text', technical_description,
          'created_at', COALESCE(created_at_jalali, '')
        )
      )
      WHERE technical_description IS NOT NULL
        AND TRIM(technical_description) <> ''
        AND technical_notes = '[]'::jsonb
    `);

    await client.query(`
      UPDATE orders
      SET seller_notes = '[]'::jsonb
      WHERE seller_notes IS NULL
    `);

    await client.query(`
      UPDATE orders
      SET technician_assignments = $1::jsonb
      WHERE technician_assignments IS NULL
    `, [JSON.stringify(normalizeTechnicianAssignments())]);

    await ensureLookupTable(client, 'warranties', 'TEXT');
    await initMediaTable(client);

    await client.query('COMMIT');
    console.log('Database synced successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB Init Error:', err);
  } finally {
    client.release();
  }
};
const dbReadyPromise = initDB();


fastify.post('/api/auth/login', async (request, reply) => {
  const { username, password } = request.body || {};
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return reply.status(400).send({ error: 'نام کاربری و رمز عبور الزامی است.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, full_name, role, roles, password_hash, permissions, is_active, seller_lookup_id FROM app_users WHERE username = $1',
      [normalizedUsername]
    );

    if (result.rowCount === 0 || !result.rows[0].is_active || !verifyPassword(password, result.rows[0].password_hash)) {
      return reply.status(401).send({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
    }

    const user = sanitizeUser(result.rows[0]);
    const ttl = secondsUntilNextServerMidnight();
    const token = signToken({ sub: user.id, username: user.username, role: user.role }, ttl);
    return { token, user, expires_in: ttl };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.addHook('preHandler', async (request, reply) => {
  if (request.method === 'OPTIONS') return;
  if (!request.url.startsWith('/api/')) return;
  if (request.url.startsWith('/api/auth/login')) return;
  if (request.url.startsWith('/api/events')) return;
  // A 120-second random media ticket is issued only after authenticated permission checks.
  if (request.url.startsWith('/api/media-transfer/')) return;
  await authenticateRequest(request, reply);
});

registerInvoiceMedia(fastify, { pool, requirePermission, writeActivityLog, broadcastRealtimeEvent });

fastify.get('/api/auth/me', async (request) => {
  return { user: request.user };
});


fastify.get('/api/events', async (request, reply) => {
  const token = String((request.query || {}).token || '');
  const payload = verifyToken(token);
  if (!payload || !payload.sub) {
    return reply.status(401).send({ error: 'نشست شما نامعتبر یا منقضی شده است.' });
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  reply.raw.write(`event: portal-update\ndata: ${JSON.stringify({ type: 'connected', at: new Date().toISOString() })}\n\n`);
  realtimeClients.add(reply.raw);
  request.raw.on('close', () => realtimeClients.delete(reply.raw));
  return reply;
});


fastify.post('/api/account/change-password', async (request, reply) => {
  if (!requirePermission(request, reply, 'account.change_password')) return;
  const currentPassword = String((request.body || {}).current_password || '');
  const newPassword = String((request.body || {}).new_password || '');

  if (!currentPassword || !newPassword) {
    return reply.status(400).send({ error: 'رمز فعلی و رمز جدید الزامی است.' });
  }
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return reply.status(400).send({ error: 'رمز عبور جدید باید حداقل ۴ کاراکتر باشد.' });
  }

  try {
    const current = await pool.query('SELECT id, password_hash FROM app_users WHERE id = $1', [request.user.id]);
    if (current.rowCount === 0 || !verifyPassword(currentPassword, current.rows[0].password_hash)) {
      return reply.status(400).send({ error: 'رمز عبور فعلی اشتباه است.' });
    }
    if (verifyPassword(newPassword, current.rows[0].password_hash)) {
      return reply.status(400).send({ error: 'رمز عبور جدید نباید با رمز عبور فعلی یکسان باشد.' });
    }

    await pool.query('UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashPassword(newPassword), request.user.id]);
    return { success: true };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.get('/api/activity-logs/users', async (request, reply) => {
  if (!requirePermission(request, reply, 'logs.view')) return;
  try {
    const result = await pool.query(`
      SELECT DISTINCT user_id AS id, username, user_full_name AS full_name
      FROM activity_logs
      WHERE user_id IS NOT NULL
      ORDER BY user_full_name ASC, username ASC
    `);
    return result.rows;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.get('/api/activity-logs', async (request, reply) => {
  if (!requirePermission(request, reply, 'logs.view')) return;
  const query = request.query || {};
  const conditions = [];
  const values = [];

  if (query.user_id) {
    values.push(Number(query.user_id));
    conditions.push(`user_id = $${values.length}`);
  }
  if (query.invoice_number) {
    values.push(String(query.invoice_number));
    conditions.push(`invoice_number = $${values.length}`);
  }
  if (query.date) {
    values.push(String(query.date));
    conditions.push(`split_part(COALESCE(created_at_jalali, ''), ' - ', 1) = $${values.length}`);
  }

  const limit = Math.min(Math.max(parseInt(query.limit || '500', 10) || 500, 1), 1000);
  values.push(limit);

  try {
    const result = await pool.query(`
      SELECT id, user_id, username, user_full_name, action_type, entity_type, entity_id,
             invoice_number, message, details, created_at, created_at_jalali
      FROM activity_logs
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT $${values.length}
    `, values);
    return result.rows;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.get('/api/security/catalog', async (request, reply) => {
  if (!requirePermission(request, reply, 'users.view')) return;
  return {
    roles: USER_ROLES,
    permissions: PERMISSION_CATALOG,
    role_defaults: ROLE_DEFAULT_PERMISSIONS
  };
});

fastify.get('/api/users', async (request, reply) => {
  if (!requirePermission(request, reply, 'users.view')) return;

  try {
    const result = await pool.query(`
      SELECT id, username, full_name, role, roles, permissions, is_active, seller_lookup_id, display_order, created_at, updated_at
      FROM app_users
      ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'technician' THEN 2 WHEN 'sales' THEN 3 ELSE 9 END, display_order ASC, full_name ASC, id ASC
    `);
    return result.rows.map(sanitizeUser);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.post('/api/users', async (request, reply) => {
  if (!requirePermission(request, reply, 'users.create')) return;
  if (!requirePermission(request, reply, 'users.permissions')) return;

  const body = request.body || {};
  const username = normalizeUsername(body.username);
  const fullName = String(body.full_name || '').trim();
  const roles = normalizeRoles(body.roles || [body.role]);
  const role = roles[0] || 'sales';
  const password = String(body.password || '');
  const isActive = body.is_active !== false;
  const permissions = normalizePermissions(roles, body.permissions || {});

  if (!username || !fullName || !password) {
    return reply.status(400).send({ error: 'نام کاربری، نام کامل و رمز عبور الزامی است.' });
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return reply.status(400).send({ error: 'رمز عبور باید حداقل ۴ کاراکتر باشد.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO app_users (username, full_name, role, roles, password_hash, permissions, is_active, display_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM app_users WHERE role = $3))
       RETURNING id, username, full_name, role, permissions, is_active, seller_lookup_id, display_order`,
      [username, fullName, role, JSON.stringify(roles), hashPassword(password), JSON.stringify(permissions), isActive]
    );

    await syncUserSellerLookup(client, inserted.rows[0].id, roles.includes('sales') ? 'sales' : role, fullName, null);
    const refreshed = await client.query(
      'SELECT id, username, full_name, role, roles, permissions, is_active, seller_lookup_id, display_order FROM app_users WHERE id = $1',
      [inserted.rows[0].id]
    );
    await writeActivityLog({
      request,
      action_type: 'user.created',
      entity_type: 'user',
      entity_id: String(refreshed.rows[0].id),
      message: `${actorDisplayName(request.user)} کاربر ${refreshed.rows[0].full_name} (${refreshed.rows[0].username}) را ایجاد کرد.`,
      details: { full_name: refreshed.rows[0].full_name, username: refreshed.rows[0].username, roles: normalizeRoles(refreshed.rows[0].roles || [refreshed.rows[0].role]) }
    }, client);
    await client.query('COMMIT');
    broadcastRealtimeEvent('users.changed', { user_id: refreshed.rows[0].id });
    return sanitizeUser(refreshed.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return reply.status(409).send({ error: 'این نام کاربری قبلاً ثبت شده است.' });
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

fastify.put('/api/users/:id', async (request, reply) => {
  if (!requirePermission(request, reply, 'users.update')) return;
  if (!requirePermission(request, reply, 'users.permissions')) return;

  const { id } = request.params;
  const body = request.body || {};
  const username = normalizeUsername(body.username);
  const fullName = String(body.full_name || '').trim();
  const roles = normalizeRoles(body.roles || [body.role]);
  const role = roles[0] || 'sales';
  const isActive = body.is_active !== false;
  const permissions = normalizePermissions(roles, body.permissions || {});

  if (!username || !fullName) {
    return reply.status(400).send({ error: 'نام کاربری و نام کامل کاربر الزامی است.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT id, role, roles, seller_lookup_id FROM app_users WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.status(404).send({ error: 'کاربر یافت نشد.' });
    }

    const roleChanged = current.rows[0].role !== role;
    const newDisplayOrder = roleChanged
      ? Number((await client.query('SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM app_users WHERE role = $1', [role])).rows[0].next_order)
      : null;

    await client.query(
      `UPDATE app_users
       SET username = $1,
           full_name = $2,
           role = $3,
           roles = $4::jsonb,
           is_active = $5,
           permissions = $6::jsonb,
           display_order = CASE WHEN $7::boolean THEN $8 ELSE display_order END,
           password_hash = CASE WHEN $9::text <> '' THEN $10 ELSE password_hash END,
           updated_at = NOW()
       WHERE id = $11`,
      [username, fullName, role, JSON.stringify(roles), isActive, JSON.stringify(permissions), roleChanged, newDisplayOrder, String(body.password || ''), body.password ? hashPassword(String(body.password)) : '', id]
    );
    await syncUserSellerLookup(client, id, roles.includes('sales') ? 'sales' : role, fullName, current.rows[0].seller_lookup_id);

    const refreshed = await client.query(
      'SELECT id, username, full_name, role, roles, permissions, is_active, seller_lookup_id, display_order FROM app_users WHERE id = $1',
      [id]
    );
    await writeActivityLog({
      request,
      action_type: 'user.updated',
      entity_type: 'user',
      entity_id: String(refreshed.rows[0].id),
      message: `${actorDisplayName(request.user)} اطلاعات کاربر ${refreshed.rows[0].full_name} (${refreshed.rows[0].username}) را مدیریت کرد.`,
      details: { full_name: refreshed.rows[0].full_name, username: refreshed.rows[0].username, roles: normalizeRoles(refreshed.rows[0].roles || [refreshed.rows[0].role]), is_active: refreshed.rows[0].is_active }
    }, client);
    await client.query('COMMIT');
    broadcastRealtimeEvent('users.changed', { user_id: refreshed.rows[0].id });
    return sanitizeUser(refreshed.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return reply.status(409).send({ error: 'این نام کاربری قبلاً ثبت شده است.' });
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});


fastify.patch('/api/users/:id/move', async (request, reply) => {
  if (!requirePermission(request, reply, 'users.priority')) return;

  const { id } = request.params;
  const direction = String((request.body || {}).direction || '').toLowerCase();
  if (!['up', 'down'].includes(direction)) {
    return reply.status(400).send({ error: 'جهت جابه‌جایی نامعتبر است.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT id, role, display_order FROM app_users WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.status(404).send({ error: 'کاربر یافت نشد.' });
    }

    const currentUser = current.rows[0];
    const target = direction === 'up'
      ? await client.query(
          `SELECT id, display_order FROM app_users
           WHERE role = $1 AND display_order < $2
           ORDER BY display_order DESC, id DESC LIMIT 1`,
          [currentUser.role, currentUser.display_order]
        )
      : await client.query(
          `SELECT id, display_order FROM app_users
           WHERE role = $1 AND display_order > $2
           ORDER BY display_order ASC, id ASC LIMIT 1`,
          [currentUser.role, currentUser.display_order]
        );

    if (target.rowCount === 0) {
      await client.query('COMMIT');
      return { success: true };
    }

    await client.query('UPDATE app_users SET display_order = $1, updated_at = NOW() WHERE id = $2', [target.rows[0].display_order, currentUser.id]);
    await client.query('UPDATE app_users SET display_order = $1, updated_at = NOW() WHERE id = $2', [currentUser.display_order, target.rows[0].id]);
    await writeActivityLog({
      request,
      action_type: 'user.priority_changed',
      entity_type: 'user',
      entity_id: String(currentUser.id),
      message: `${actorDisplayName(request.user)} ترتیب نمایش کاربر شماره ${currentUser.id} را ${direction === 'up' ? 'به بالا' : 'به پایین'} جابه‌جا کرد.`
    }, client);
    await client.query('COMMIT');
    broadcastRealtimeEvent('users.changed', { user_id: currentUser.id });
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

fastify.post('/api/users/:id/reset-password', async (request, reply) => {
  if (!requirePermission(request, reply, 'users.reset_password')) return;

  const { id } = request.params;
  const password = String((request.body || {}).password || '');
  if (password.length < PASSWORD_MIN_LENGTH) {
    return reply.status(400).send({ error: 'رمز عبور جدید باید حداقل ۴ کاراکتر باشد.' });
  }

  try {
    const result = await pool.query(
      'UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, full_name',
      [hashPassword(password), id]
    );
    if (result.rowCount === 0) return reply.status(404).send({ error: 'کاربر یافت نشد.' });
    broadcastRealtimeEvent('users.changed', { user_id: id });
    return { success: true };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.delete('/api/users/:id', async (request, reply) => {
  if (!requirePermission(request, reply, 'users.delete')) return;

  const { id } = request.params;
  if (String(request.user.id) === String(id)) {
    return reply.status(400).send({ error: 'کاربر جاری را نمی‌توانید حذف کنید.' });
  }

  try {
    const result = await pool.query(
      'UPDATE app_users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, username, full_name',
      [id]
    );
    if (result.rowCount === 0) return reply.status(404).send({ error: 'کاربر یافت نشد.' });
    await writeActivityLog({
      request,
      action_type: 'user.deactivated',
      entity_type: 'user',
      entity_id: String(result.rows[0].id),
      message: `${actorDisplayName(request.user)} کاربر ${result.rows[0].full_name} (${result.rows[0].username}) را غیرفعال کرد.`,
      details: { full_name: result.rows[0].full_name, username: result.rows[0].username }
    });
    broadcastRealtimeEvent('users.changed', { user_id: id });
    return { success: true, deactivated: true };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});


// مدیریت اطلاعات پایه
fastify.get('/api/lookups/:type', async (request, reply) => {
  if (!requirePermission(request, reply, 'lookups.view')) return;
  const config = getLookupConfig(request.params.type);
  if (!config) return reply.status(404).send({ error: 'نوع اطلاعات پایه معتبر نیست.' });

  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const result = await pool.query(`SELECT id, name, display_order, is_active FROM ${config.table} ORDER BY display_order ASC, id ASC`);
    const rows = [];
    for (const row of result.rows) {
      const usageCount = await getLookupUsageCount(pool, config, row.id, row.name);
      rows.push({ ...row, usage_count: usageCount });
    }
    return { type: request.params.type, title: config.title, rows };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.post('/api/lookups/:type', async (request, reply) => {
  if (!requirePermission(request, reply, 'lookups.create')) return;
  const config = getLookupConfig(request.params.type);
  if (!config) return reply.status(404).send({ error: 'نوع اطلاعات پایه معتبر نیست.' });

  const name = normalizeLookupName(request.body?.name);
  if (!name) return reply.status(400).send({ error: `${config.nameLabel} نمی‌تواند خالی باشد.` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const isUnique = await ensureLookupNameIsUnique(client, config.table, name);
    if (!isUnique) {
      await client.query('ROLLBACK');
      return reply.status(409).send({ error: `${config.nameLabel} تکراری است.` });
    }

    const orderResult = await client.query(`SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM ${config.table}`);
    const displayOrder = Number(orderResult.rows[0]?.next_order || 1);
    const result = await client.query(
      `INSERT INTO ${config.table} (name, display_order, is_active) VALUES ($1, $2, true) RETURNING id, name, display_order, is_active`,
      [name, displayOrder]
    );
    await writeActivityLog({
      request,
      action_type: 'lookup.created',
      entity_type: config.table,
      entity_id: String(result.rows[0].id),
      message: `${config.nameLabel} «${name}» اضافه شد.`,
      details: { table: config.table, name }
    }, client);
    await client.query('COMMIT');
    broadcastRealtimeEvent('lookups.changed', { type: request.params.type });
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

fastify.put('/api/lookups/:type/:id', async (request, reply) => {
  if (!requirePermission(request, reply, 'lookups.update')) return;
  const config = getLookupConfig(request.params.type);
  if (!config) return reply.status(404).send({ error: 'نوع اطلاعات پایه معتبر نیست.' });

  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return reply.status(400).send({ error: 'شناسه معتبر نیست.' });

  const name = normalizeLookupName(request.body?.name);
  const hasName = Object.prototype.hasOwnProperty.call(request.body || {}, 'name');
  const hasActive = Object.prototype.hasOwnProperty.call(request.body || {}, 'is_active');
  if (hasName && !name) return reply.status(400).send({ error: `${config.nameLabel} نمی‌تواند خالی باشد.` });
  if (!hasName && !hasActive) return reply.status(400).send({ error: 'هیچ تغییری ارسال نشده است.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await client.query(`SELECT id, name, display_order, is_active FROM ${config.table} WHERE id = $1`, [id]);
    if (before.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.status(404).send({ error: 'رکورد موردنظر پیدا نشد.' });
    }

    const finalName = hasName ? name : before.rows[0].name;
    if (hasName) {
      const isUnique = await ensureLookupNameIsUnique(client, config.table, finalName, id);
      if (!isUnique) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: `${config.nameLabel} تکراری است.` });
      }
    }
    const finalActive = hasActive ? Boolean(request.body.is_active) : Boolean(before.rows[0].is_active);
    const result = await client.query(
      `UPDATE ${config.table} SET name = $1, is_active = $2 WHERE id = $3 RETURNING id, name, display_order, is_active`,
      [finalName, finalActive, id]
    );
    await writeActivityLog({
      request,
      action_type: 'lookup.updated',
      entity_type: config.table,
      entity_id: String(id),
      message: `${config.nameLabel} «${before.rows[0].name}» ویرایش شد.`,
      details: { table: config.table, before: before.rows[0], after: result.rows[0] }
    }, client);
    await client.query('COMMIT');
    broadcastRealtimeEvent('lookups.changed', { type: request.params.type });
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

fastify.delete('/api/lookups/:type/:id', async (request, reply) => {
  if (!requirePermission(request, reply, 'lookups.delete')) return;
  const config = getLookupConfig(request.params.type);
  if (!config) return reply.status(404).send({ error: 'نوع اطلاعات پایه معتبر نیست.' });

  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) return reply.status(400).send({ error: 'شناسه معتبر نیست.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await client.query(`SELECT id, name, display_order, is_active FROM ${config.table} WHERE id = $1`, [id]);
    if (before.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.status(404).send({ error: 'رکورد موردنظر پیدا نشد.' });
    }
    const row = before.rows[0];
    const usageCount = await getLookupUsageCount(client, config, row.id, row.name);

    if (usageCount > 0) {
      await client.query(`UPDATE ${config.table} SET is_active = false WHERE id = $1`, [id]);
      await writeActivityLog({
        request,
        action_type: 'lookup.deactivated',
        entity_type: config.table,
        entity_id: String(id),
        message: `${config.nameLabel} «${row.name}» به‌دلیل استفاده در ${usageCount} فاکتور غیرفعال شد.`,
        details: { table: config.table, name: row.name, usage_count: usageCount }
      }, client);
      await client.query('COMMIT');
      broadcastRealtimeEvent('lookups.changed', { type: request.params.type });
      return { success: true, deactivated: true, usage_count: usageCount };
    }

    await client.query(`DELETE FROM ${config.table} WHERE id = $1`, [id]);
    await normalizeLookupDisplayOrder(client, config.table);
    await resetLookupSequence(client, config.table);
    await writeActivityLog({
      request,
      action_type: 'lookup.deleted',
      entity_type: config.table,
      entity_id: String(id),
      message: `${config.nameLabel} «${row.name}» حذف شد.`,
      details: { table: config.table, name: row.name }
    }, client);
    await client.query('COMMIT');
    broadcastRealtimeEvent('lookups.changed', { type: request.params.type });
    return { success: true, deleted: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

fastify.post('/api/lookups/:type/:id/move', async (request, reply) => {
  if (!requirePermission(request, reply, 'lookups.priority')) return;
  const config = getLookupConfig(request.params.type);
  if (!config) return reply.status(404).send({ error: 'نوع اطلاعات پایه معتبر نیست.' });

  const id = Number(request.params.id);
  const direction = String(request.body?.direction || '').trim();
  if (!Number.isInteger(id) || id <= 0) return reply.status(400).send({ error: 'شناسه معتبر نیست.' });
  if (!['up', 'down'].includes(direction)) return reply.status(400).send({ error: 'جهت جابه‌جایی معتبر نیست.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await normalizeLookupDisplayOrder(client, config.table);
    const current = await client.query(`SELECT id, name, display_order FROM ${config.table} WHERE id = $1`, [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.status(404).send({ error: 'رکورد موردنظر پیدا نشد.' });
    }
    const comparator = direction === 'up' ? '<' : '>';
    const orderDirection = direction === 'up' ? 'DESC' : 'ASC';
    const neighbor = await client.query(
      `SELECT id, name, display_order FROM ${config.table} WHERE display_order ${comparator} $1 ORDER BY display_order ${orderDirection}, id ${orderDirection} LIMIT 1`,
      [current.rows[0].display_order]
    );
    if (neighbor.rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: true, unchanged: true };
    }

    await client.query(`UPDATE ${config.table} SET display_order = $1 WHERE id = $2`, [neighbor.rows[0].display_order, current.rows[0].id]);
    await client.query(`UPDATE ${config.table} SET display_order = $1 WHERE id = $2`, [current.rows[0].display_order, neighbor.rows[0].id]);
    await normalizeLookupDisplayOrder(client, config.table);
    await writeActivityLog({
      request,
      action_type: 'lookup.priority_changed',
      entity_type: config.table,
      entity_id: String(id),
      message: `ترتیب ${config.nameLabel} «${current.rows[0].name}» جابه‌جا شد.`,
      details: { table: config.table, direction, swapped_with: neighbor.rows[0].name }
    }, client);
    await client.query('COMMIT');
    broadcastRealtimeEvent('lookups.changed', { type: request.params.type });
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

// دریافت تاریخ و ساعت فعلی سرور به صورت شمسی
fastify.get('/api/server-time', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.view')) return;
  return { formatted_date: toJalaliDateTime(new Date()) };
});

// دریافت متادیتا (فروشندگان، مدل‌ها، شهرها، انبارها، گارانتی‌ها)
fastify.get('/api/metadata', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.view')) return;
  try {
    const cities = await pool.query('SELECT * FROM cities WHERE is_active = true ORDER BY display_order ASC, id ASC');
    const warehouses = await pool.query('SELECT * FROM warehouses WHERE is_active = true ORDER BY display_order ASC, id ASC');
    const sellers = await pool.query("SELECT seller_lookup_id AS id, full_name AS name FROM app_users WHERE (role = 'sales' OR COALESCE(roles, jsonb_build_array(role)) ? 'sales') AND is_active = true AND seller_lookup_id IS NOT NULL ORDER BY display_order ASC, full_name ASC");
    const technicians = await pool.query("SELECT id, full_name AS name FROM app_users WHERE (role = 'technician' OR COALESCE(roles, jsonb_build_array(role)) ? 'technician') AND is_active = true ORDER BY display_order ASC, full_name ASC");
    const models = await pool.query('SELECT * FROM device_models WHERE is_active = true ORDER BY display_order ASC, id ASC');
    const warranties = await pool.query('SELECT * FROM warranties WHERE is_active = true ORDER BY display_order ASC, id ASC');
    const configTypes = await pool.query('SELECT * FROM config_types WHERE is_active = true ORDER BY display_order ASC, id ASC');
    const statuses = await pool.query('SELECT * FROM order_statuses ORDER BY id ASC');

    return {
      cities: cities.rows,
      warehouses: warehouses.rows,
      sellers: sellers.rows,
      technicians: technicians.rows,
      models: models.rows,
      warranties: warranties.rows,
      config_types: configTypes.rows,
      statuses: statuses.rows
    };
  } catch (err) { return { error: err.message }; }
});

// دریافت لیست تمامی سفارش‌ها
fastify.get('/api/orders', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.view')) return;
  try {
    const res = await pool.query(`
      SELECT o.*,
             c.name as city_name,
             w.name as warehouse_name,
             s.name as seller_name,
             m.name as model_name,
             COALESCE(o.created_at_jalali, '') as formatted_date
      FROM orders o
      LEFT JOIN cities c ON o.city_id = c.id
      LEFT JOIN warehouses w ON o.warehouse_id = w.id
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN device_models m ON o.device_model = m.id
      ORDER BY o.priority ASC, o.created_at DESC
    `);
    return res.rows;
  } catch (err) { return { error: err.message }; }
});

// ثبت فاکتور جدید
fastify.post('/api/orders', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.create')) return;
  const {
    invoice_number, device_model, quantity,
    seller_id, city_id, warehouse_id,
    buyer_name, config_type, seller_description,
    purchase_number, warranty, related_invoices
  } = request.body;

  try {
    const sellerCheck = await pool.query("SELECT 1 FROM app_users WHERE (role = 'sales' OR COALESCE(roles, jsonb_build_array(role)) ? 'sales') AND is_active = true AND seller_lookup_id = $1", [seller_id]);
    if (sellerCheck.rowCount === 0) {
      return reply.status(400).send({ error: 'کارشناس فروش انتخاب‌شده معتبر یا فعال نیست.' });
    }

    const createdAtJalali = toJalaliDateTime(new Date());
    const createdAtJalaliDate = getJalaliDatePart(createdAtJalali);
    const createdAtJalaliYear = createdAtJalaliDate.split('/')[0] || '';

    const duplicateInvoice = await pool.query(`
      SELECT id FROM orders
      WHERE invoice_number = $1
        AND split_part(COALESCE(created_at_jalali, ''), '/', 1) = $2
      LIMIT 1
    `, [String(invoice_number || '').trim(), createdAtJalaliYear]);
    if (duplicateInvoice.rowCount > 0) {
      return reply.status(409).send({ error: 'ثبت شماره فاکتور تکراری در همان سال مجاز نیست.' });
    }

    const lastPriority = await pool.query(`
      SELECT MAX(priority) as max_p
      FROM orders
      WHERE split_part(COALESCE(created_at_jalali, ''), ' - ', 1) = $1
    `, [createdAtJalaliDate]);

    const newPriority = (lastPriority.rows[0].max_p || 0) + 1;
    const configTypeCheck = await pool.query('SELECT name FROM config_types WHERE name = $1 AND is_active = true LIMIT 1', [String(config_type || '').trim()]);
    if (configTypeCheck.rowCount === 0) {
      return reply.status(400).send({ error: 'نوع کانفیگ انتخاب‌شده معتبر نیست.' });
    }
    const safeConfigType = configTypeCheck.rows[0].name;
    const result = await pool.query(
      `INSERT INTO orders
      (invoice_number, device_model, quantity, seller_id, city_id, warehouse_id, buyer_name, config_type, seller_description, purchase_number, warranty, related_invoices, created_at_jalali, status, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Pending', $14)
      RETURNING *`,
      [invoice_number, device_model, quantity, seller_id, city_id, warehouse_id, buyer_name, safeConfigType, seller_description, purchase_number, warranty, related_invoices, createdAtJalali, newPriority]
    );
    await writeActivityLog({
      request,
      action_type: 'order.created',
      entity_type: 'order',
      entity_id: String(result.rows[0].id),
      invoice_number: result.rows[0].invoice_number,
      message: `فاکتور ${result.rows[0].invoice_number} ثبت شد.`,
      details: {}
    });
    broadcastRealtimeEvent('orders.created', { order_id: result.rows[0].id });
    return result.rows[0];
  } catch (err) { return reply.status(500).send({ error: err.message }); }
});

// جابجایی هوشمند اولویت (Swap)
fastify.post('/api/orders/:id/swap', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.priority')) return;
  const { id } = request.params;
  const { direction } = request.body;

  try {
    await pool.query('BEGIN');

    const currRes = await pool.query(`
      SELECT id, priority, split_part(COALESCE(created_at_jalali, ''), ' - ', 1) as date_created
      FROM orders
      WHERE id = $1
    `, [id]);

    if (currRes.rowCount === 0) {
      await pool.query('ROLLBACK');
      return reply.status(404).send({ error: 'سفارش یافت نشد' });
    }

    const currentOrder = currRes.rows[0];
    const todayJalali = getJalaliDatePart(toJalaliDateTime(new Date()));

    if (currentOrder.date_created !== todayJalali) {
      await pool.query('ROLLBACK');
      return reply.status(400).send({ error: 'جابجایی اولویت فقط برای سفارش‌های روز جاری امکان‌پذیر است.' });
    }

    let targetRes;
    if (direction === 'up') {
      targetRes = await pool.query(`
        SELECT id, priority FROM orders
        WHERE split_part(COALESCE(created_at_jalali, ''), ' - ', 1) = $1 AND priority < $2
        ORDER BY priority DESC LIMIT 1
      `, [currentOrder.date_created, currentOrder.priority]);
    } else {
      targetRes = await pool.query(`
        SELECT id, priority FROM orders
        WHERE split_part(COALESCE(created_at_jalali, ''), ' - ', 1) = $1 AND priority > $2
        ORDER BY priority ASC LIMIT 1
      `, [currentOrder.date_created, currentOrder.priority]);
    }

    if (targetRes.rowCount > 0) {
      const targetOrder = targetRes.rows[0];
      const targetInvoiceRes = await pool.query('SELECT invoice_number FROM orders WHERE id = $1', [targetOrder.id]);
      await pool.query('UPDATE orders SET priority = $1 WHERE id = $2', [targetOrder.priority, currentOrder.id]);
      await pool.query('UPDATE orders SET priority = $1 WHERE id = $2', [currentOrder.priority, targetOrder.id]);
      const invoiceRes = await pool.query('SELECT invoice_number FROM orders WHERE id = $1', [currentOrder.id]);
      await pool.query('COMMIT');
      const invoiceNumber = invoiceRes.rows[0]?.invoice_number || String(currentOrder.id);
      const targetInvoiceNumber = targetInvoiceRes.rows[0]?.invoice_number || String(targetOrder.id);
      await writeActivityLog({
        request,
        action_type: 'order.priority_changed',
        entity_type: 'order',
        entity_id: String(currentOrder.id),
        invoice_number: invoiceNumber,
        message: `اولویت فاکتور ${invoiceNumber} جابه‌جا شد.`,
        details: readableDetails([
          `جهت جابه‌جایی: ${direction === 'up' ? 'بالا' : 'پایین'}`,
          `اولویت قبلی فاکتور ${invoiceNumber}: ${currentOrder.priority}`,
          `اولویت جدید فاکتور ${invoiceNumber}: ${targetOrder.priority}`,
          `فاکتور جابه‌جا شده با آن: ${targetInvoiceNumber}`
        ])
      });
      broadcastRealtimeEvent('orders.changed', { order_id: currentOrder.id });
      return { success: true };
    } else {
      await pool.query('ROLLBACK');
      return reply.status(400).send({ error: 'امکان جابجایی در این جهت وجود ندارد.' });
    }
  } catch (err) {
    await pool.query('ROLLBACK');
    return reply.status(500).send({ error: err.message });
  }
});


fastify.post('/api/orders/:id/serial-copy-log', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.view')) return;
  const { id } = request.params;
  const serial = String((request.body || {}).serial || '').trim();
  try {
    const orderRes = await pool.query('SELECT id, invoice_number FROM orders WHERE id = $1', [id]);
    if (orderRes.rowCount === 0) return reply.status(404).send({ error: 'Order not found' });
    await writeActivityLog({
      request,
      action_type: 'order.serial_copied',
      entity_type: 'order',
      entity_id: String(orderRes.rows[0].id),
      invoice_number: orderRes.rows[0].invoice_number || null,
      message: `سریال فاکتور ${orderRes.rows[0].invoice_number || id} کپی شد.`,
      details: readableDetails([`سریال کپی‌شده: ${serial || '-'}`])
    });
    broadcastRealtimeEvent('logs.changed', { order_id: id });
    return { success: true };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

// به‌روزرسانی مدیریت سطر (وضعیت، توضیحات فنی، تکنسین‌ها، سریال‌ها و فاکتورهای وابسته)
fastify.patch('/api/orders/:id', async (request, reply) => {
  const { id } = request.params;
  const body = request.body || {};

  const requestedPermissions = new Set();
  if (Object.prototype.hasOwnProperty.call(body, 'status') || Object.prototype.hasOwnProperty.call(body, 'technical_description') || Object.prototype.hasOwnProperty.call(body, 'technical_notes') || Object.prototype.hasOwnProperty.call(body, 'technician_assignments')) requestedPermissions.add('orders.technical');
  if (Object.prototype.hasOwnProperty.call(body, 'serials')) requestedPermissions.add('orders.serials');
  if (Object.prototype.hasOwnProperty.call(body, 'seller_notes')) requestedPermissions.add('orders.sales_notes');
  if (Object.prototype.hasOwnProperty.call(body, 'related_invoices')) requestedPermissions.add('orders.related');
  if (requestedPermissions.size === 0) requestedPermissions.add('orders.update');
  for (const permission of requestedPermissions) {
    if (!requirePermission(request, reply, permission)) return;
  }

  try {
    const beforeResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (beforeResult.rowCount === 0) return reply.status(404).send({ error: 'Order not found' });
    const beforeOrder = beforeResult.rows[0];

    const fields = [];
    const values = [];

    const addField = (sqlExpression, value) => {
      values.push(value);
      fields.push(sqlExpression.replace('?', `$${values.length}`));
    };

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      if (!VALID_STATUS_CODES.includes(body.status)) {
        return reply.status(400).send({ error: 'وضعیت انتخاب‌شده معتبر نیست.' });
      }
      addField('status = ?', body.status);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'technical_description')) {
      addField('technical_description = ?', body.technical_description || '');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'technical_notes')) {
      addField('technical_notes = ?::jsonb', JSON.stringify(normalizeTechnicalNotes(body.technical_notes)));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'seller_notes')) {
      addField('seller_notes = ?::jsonb', JSON.stringify(normalizeSellerNotes(body.seller_notes)));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'technician_assignments')) {
      const activeTechnicians = await getActiveTechnicianNames(pool);
      addField('technician_assignments = ?::jsonb', JSON.stringify(normalizeTechnicianAssignments(body.technician_assignments, activeTechnicians)));
    }

    if (Object.prototype.hasOwnProperty.call(body, 'serials')) {
      addField('serials = ?', body.serials || '');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'related_invoices')) {
      addField('related_invoices = ?', body.related_invoices || '');
    }

    if (fields.length === 0) {
      return beforeOrder;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE orders
       SET ${fields.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const afterOrder = result.rows[0];
    const messages = buildOrderChangeMessages(beforeOrder, afterOrder, body);
    for (const item of messages) {
      const message = item.message;
      await writeActivityLog({
        request,
        action_type: item.action_type,
        entity_type: 'order',
        entity_id: String(afterOrder.id),
        invoice_number: afterOrder.invoice_number || beforeOrder.invoice_number || null,
        message,
        details: item.details
      });
    }

    broadcastRealtimeEvent('orders.changed', { order_id: afterOrder.id });
    return afterOrder;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});



async function resolveOrderLogValue(field, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const lookupTables = {
    seller_id: 'sellers',
    city_id: 'cities',
    device_model: 'device_models',
    warehouse_id: 'warehouses',
    warranty: 'warranties'
  };
  if (field === 'status') return getBackendStatusLabel(raw);
  if (lookupTables[field]) {
    try {
      const result = await pool.query(
        `SELECT name FROM ${lookupTables[field]} WHERE id::text = $1 OR name = $1 LIMIT 1`,
        [raw]
      );
      if (result.rowCount > 0) return result.rows[0].name;
    } catch (err) {
      console.error('Lookup log value error:', err.message);
    }
  }
  return raw;
}

async function buildOrderEditDetails(before = {}, after = {}) {
  const labels = {
    invoice_number: 'شماره فاکتور',
    seller_id: 'کارشناس فروش',
    buyer_name: 'نام خریدار',
    city_id: 'شهر',
    device_model: 'مدل سرور',
    quantity: 'تعداد',
    config_type: 'نوع کانفیگ',
    warehouse_id: 'انبار',
    purchase_number: 'شماره خرید (سرور)',
    warranty: 'گارانتی',
    seller_description: 'توضیحات فروشنده',
    related_invoices: 'فاکتورهای وابسته'
  };
  const changedFields = [];
  const lines = [];
  for (const field of Object.keys(labels)) {
    const beforeValue = String(before[field] ?? '').trim();
    const afterValue = String(after[field] ?? '').trim();
    if (beforeValue !== afterValue) {
      const beforeDisplay = await resolveOrderLogValue(field, beforeValue);
      const afterDisplay = await resolveOrderLogValue(field, afterValue);
      changedFields.push({ field, label: labels[field], from: beforeDisplay || '-', to: afterDisplay || '-' });
      lines.push(`${labels[field]}:`);
      lines.push(`قبل: ${beforeDisplay || '-'}`);
      lines.push(`بعد: ${afterDisplay || '-'}`);
      lines.push('---');
    }
  }
  if (lines[lines.length - 1] === '---') lines.pop();
  return { changed_fields: changedFields, lines };
}
// ویرایش کامل اطلاعات فاکتور
fastify.put('/api/orders/:id', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.update')) return;
  const { id } = request.params;
  const {
    invoice_number, device_model, quantity,
    seller_id, city_id, warehouse_id,
    buyer_name, config_type, seller_description,
    purchase_number, warranty, related_invoices
  } = request.body || {};

  try {
    const sellerCheck = await pool.query("SELECT 1 FROM app_users WHERE (role = 'sales' OR COALESCE(roles, jsonb_build_array(role)) ? 'sales') AND is_active = true AND seller_lookup_id = $1", [seller_id]);
    if (sellerCheck.rowCount === 0) {
      return reply.status(400).send({ error: 'کارشناس فروش انتخاب‌شده معتبر یا فعال نیست.' });
    }

    const configTypeCheck = await pool.query('SELECT name FROM config_types WHERE name = $1 AND is_active = true LIMIT 1', [String(config_type || '').trim()]);
    if (configTypeCheck.rowCount === 0) {
      return reply.status(400).send({ error: 'نوع کانفیگ انتخاب‌شده معتبر نیست.' });
    }
    const safeConfigType = configTypeCheck.rows[0].name;
    const beforeResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (beforeResult.rowCount === 0) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const invoiceYear = (getJalaliDatePart(beforeResult.rows[0].created_at_jalali) || getJalaliDatePart(toJalaliDateTime(new Date()))).split('/')[0] || '';
    const duplicateInvoice = await pool.query(`
      SELECT id FROM orders
      WHERE invoice_number = $1
        AND id <> $2
        AND split_part(COALESCE(created_at_jalali, ''), '/', 1) = $3
      LIMIT 1
    `, [String(invoice_number || '').trim(), id, invoiceYear]);
    if (duplicateInvoice.rowCount > 0) {
      return reply.status(409).send({ error: 'ثبت شماره فاکتور تکراری در همان سال مجاز نیست.' });
    }

    const result = await pool.query(
      `UPDATE orders
       SET invoice_number = $1,
           device_model = $2,
           quantity = $3,
           seller_id = $4,
           city_id = $5,
           warehouse_id = $6,
           buyer_name = $7,
           config_type = $8,
           seller_description = $9,
           purchase_number = $10,
           warranty = $11,
           related_invoices = $12
       WHERE id = $13
       RETURNING *`,
      [
        invoice_number, device_model, quantity,
        seller_id, city_id, warehouse_id,
        buyer_name, safeConfigType, seller_description || '',
        purchase_number || '', warranty || '', related_invoices || '', id
      ]
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const editDetails = await buildOrderEditDetails(beforeResult.rows[0], result.rows[0]);
    if (editDetails.changed_fields.length) {
      await writeActivityLog({
        request,
        action_type: 'order.updated',
        entity_type: 'order',
        entity_id: String(result.rows[0].id),
        invoice_number: result.rows[0].invoice_number,
        message: `اطلاعات اصلی فاکتور ${result.rows[0].invoice_number} ویرایش شد.`,
        details: editDetails
      });
    }
    broadcastRealtimeEvent('orders.changed', { order_id: result.rows[0].id });
    return result.rows[0];
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

// حذف فاکتور و مرتب‌سازی دوباره اولویت‌های همان روز
fastify.delete('/api/orders/:id', async (request, reply) => {
  if (!requirePermission(request, reply, 'orders.delete')) return;
  const { id } = request.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT id, invoice_number, split_part(COALESCE(created_at_jalali, ''), ' - ', 1) as date_created
       FROM orders
       WHERE id = $1`,
      [id]
    );

    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return reply.status(404).send({ error: 'Order not found' });
    }

    const dateCreated = orderRes.rows[0].date_created;
    const attachedMedia = await client.query('SELECT stored_name, thumbnail_name FROM invoice_media WHERE order_id=$1', [id]);
    await client.query('DELETE FROM orders WHERE id = $1', [id]);

    if (dateCreated) {
      await client.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY priority ASC, created_at ASC, id ASC) AS rn
          FROM orders
          WHERE split_part(COALESCE(created_at_jalali, ''), ' - ', 1) = $1
        )
        UPDATE orders o
        SET priority = ranked.rn
        FROM ranked
        WHERE o.id = ranked.id
      `, [dateCreated]);
    }

    await writeActivityLog({
      request,
      action_type: 'order.deleted',
      entity_type: 'order',
      entity_id: String(id),
      invoice_number: orderRes.rows[0].invoice_number || null,
      message: `فاکتور ${orderRes.rows[0].invoice_number || id} حذف شد.`,
      details: {}
    }, client);
    await client.query('COMMIT');
    await cleanMedia(attachedMedia.rows);
    broadcastRealtimeEvent('orders.deleted', { order_id: id });
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return reply.status(500).send({ error: err.message });
  } finally {
    client.release();
  }
});

const start = async () => {
  try {
    await dbReadyPromise;
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  }
  catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

module.exports = { fastify, start, pool };
