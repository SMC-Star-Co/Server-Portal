const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Tehran';
process.env.TZ = process.env.TZ || APP_TIME_ZONE;

const DATABASE = {
  user: process.env.POSTGRES_USER || process.env.DATABASE_USER || 'Administrator',
  host: process.env.DATABASE_HOST || 'db',
  database: process.env.POSTGRES_DB || process.env.DATABASE_NAME || 'portal_db',
  password: process.env.POSTGRES_PASSWORD || process.env.DATABASE_PASSWORD || 'Admin@123',
  port: Number(process.env.DATABASE_PORT || 5432),
};

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION_2026';
const MIN_SESSION_TTL_SECONDS = 60;
const INITIAL_ADMIN_USERNAME = process.env.INITIAL_ADMIN_USERNAME || 'admin';
const INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@12345';

const AUTH = {
  jwtSecret: JWT_SECRET,
  initialAdminUsername: INITIAL_ADMIN_USERNAME,
  initialAdminPassword: INITIAL_ADMIN_PASSWORD,
};

module.exports = {
  APP_TIME_ZONE,
  DATABASE,
  JWT_SECRET,
  MIN_SESSION_TTL_SECONDS,
  INITIAL_ADMIN_USERNAME,
  INITIAL_ADMIN_PASSWORD,
  AUTH,
};