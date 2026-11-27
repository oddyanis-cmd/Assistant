const prisma = require('../lib/prisma');
const env = require('../config/env');
const { sha256, randomToken } = require('../lib/crypto');
const { unauthorized, forbidden } = require('../lib/errors');

const clientIp = require('../lib/clientIp');

// On HTTPS the __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and path=/,
// so a sibling subdomain can never plant or overwrite it.
const SESSION_COOKIE = env.COOKIE_SECURE ? '__Host-sid' : 'sid';
const STAFF_ROLES = ['ADMIN', 'STAFF'];
const STAFF_SESSION_HOURS = 12;

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

async function createSession(res, req, userId, role) {
  const token = randomToken();
  // Staff/admin sessions last 12 hours; customers keep the longer "stay signed in" period.
  const ttl = STAFF_ROLES.includes(role) ? STAFF_SESSION_HOURS * 36e5 : env.SESSION_TTL_DAYS * 864e5;
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + ttl),
      ip: clientIp(req),
      userAgent: req.get('user-agent')?.slice(0, 255),
    },
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(ttl));
}

async function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Attaches req.user (or null) from the session cookie. Never throws for anonymous visitors. */
async function loadSession(req, res, next) {
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return next();
  }
  req.user = session.user;
  req.sessionId = session.id;
  req.mfaVerified = session.mfaVerified;
  next();
}

function requireAuth(req, _res, next) {
  if (!req.user) throw unauthorized();
  next();
}

/** requireRole('ADMIN') or requireRole('ADMIN', 'STAFF') */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    // Admin access always needs the second sign-in step (authenticator code) in this session.
    if (STAFF_ROLES.some((r) => roles.includes(r)) && !req.mfaVerified) throw unauthorized('Two-step sign-in required');
    next();
  };
}

module.exports = { createSession, destroySession, loadSession, requireAuth, requireRole, cookieOptions, SESSION_COOKIE, STAFF_ROLES };
