const crypto = require('node:crypto');

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Constant-time comparison of two strings (e.g. token hashes), so timing reveals nothing. */
function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? '')); const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { randomToken, sha256, safeEqual };
