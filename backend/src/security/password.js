const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 120000;
  const digest = 'sha256';
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, digest).toString('hex');
  return `pbkdf2$${iterations}$${digest}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const digest = parts[2];
  const salt = parts[3];
  const original = parts[4];
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, digest).toString('hex');
  return original.length === hash.length && crypto.timingSafeEqual(Buffer.from(original), Buffer.from(hash));
}

module.exports = { hashPassword, verifyPassword };
