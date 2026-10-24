const prisma = require('../lib/prisma');
const env = require('../config/env');
const { sha256, randomToken } = require('../lib/crypto');
const { unauthorized, forbidden } = require('../lib/errors');

const SESSION_COOKIE = 'sid';

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

async function createSession(res, req, userId) {
  const token = randomToken();
  const ttl = env.SESSION_TTL_DAYS * 864e5;
  await prisma.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + ttl),
      ip: req.ip,
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
    next();
  };
}

module.exports = { createSession, destroySession, loadSession, requireAuth, requireRole, cookieOptions };
