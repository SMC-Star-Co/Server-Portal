const crypto = require('crypto');
const { JWT_SECRET, MIN_SESSION_TTL_SECONDS } = require('../config/env');

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlJson(value) {
  return base64Url(JSON.stringify(value));
}

function decodeBase64Url(value) {
  value = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Buffer.from(value, 'base64').toString('utf8');
}

function createJwtHelpers({ getAppTimeParts, pad2 }) {
  function getSessionDayKey(dateValue = new Date()) {
    const parts = getAppTimeParts(dateValue);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  }

  function secondsUntilNextServerMidnight() {
    const now = new Date();
    const parts = getAppTimeParts(now);
    const nextMidnight = new Date(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0, 0);
    return Math.max(MIN_SESSION_TTL_SECONDS, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
  }

  function signToken(payload, ttlSeconds = secondsUntilNextServerMidnight()) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const body = { ...payload, session_day: getSessionDayKey(), iat: now, exp: now + ttlSeconds };
    const unsigned = `${base64UrlJson(header)}.${base64UrlJson(body)}`;
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(unsigned).digest('base64url');
    return `${unsigned}.${signature}`;
  }

  function verifyToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(unsigned).digest('base64url');
    const given = parts[2];
    if (expected.length !== given.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.session_day !== getSessionDayKey()) return null;
    return payload;
  }

  return { signToken, verifyToken, secondsUntilNextServerMidnight, getSessionDayKey };
}

module.exports = { createJwtHelpers };
