const { Pool } = require('pg');
const { APP_TIME_ZONE, DATABASE } = require('./env');

const pool = new Pool({
  user: DATABASE.user,
  host: DATABASE.host,
  database: DATABASE.database,
  password: DATABASE.password,
  port: DATABASE.port,
  options: `-c timezone=${APP_TIME_ZONE}`,
});

pool.on('connect', (client) => {
  client.query(`SET TIME ZONE '${APP_TIME_ZONE.replace(/'/g, "''")}'`).catch(() => {});
});

module.exports = {
  pool,
};