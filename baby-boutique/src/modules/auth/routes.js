const { Router } = require('express');
const { z } = require('zod');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { limiter } = require('../../lib/rateLimit');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');
const { badRequest, unauthorized, conflict } = require('../../lib/errors');
const { hashPassword, verifyPassword, dummyVerify } = require('./password');
const { createSession, destroySession, requireAuth, STAFF_ROLES } = require('../../middleware/session');
const { mergeGuestCartIntoUser } = require('../cart/service');

const router = Router();

// Per-IP limit for all sign-in/sign-up attempts, plus a per-email limit so guesses spread over many
// IPs still slow down. Both counters are shared across server instances (stored in Postgres).
const authLimiter = limiter({ name: 'auth-ip', windowMs: 15 * 60_000, limit: 20 });
const emailLimiter = limiter({
  name: 'auth-email', windowMs: 60 * 60_000, limit: 15,
  key: (req) => `e:${String(req.body?.email ?? '').trim().toLowerCase().slice(0, 200)}`,
});
const mfaLimiter = limiter({ name: 'mfa', windowMs: 15 * 60_000, limit: 10, key: (req) => `u:${req.user?.id ?? 'anon'}` });
authenticator.options = { window: 1 }; // accept the previous/next 30-second code for clock drift

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include letters and numbers');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  password,
  phone: z.string().trim().max(30).optional(),
});

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone ?? null });
const isStaff = (u) => STAFF_ROLES.includes(u.role);

router.post('/register', authLimiter, async (req, res) => {
  const data = parse(registerSchema, req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw conflict('An account with this email already exists');
  const user = await prisma.user.create({
    data: { email: data.email, name: data.name, phone: data.phone, passwordHash: await hashPassword(data.password) },
  });
  await createSession(res, req, user.id, user.role);
  await mergeGuestCartIntoUser(req, res, user.id);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', authLimiter, emailLimiter, async (req, res) => {
  const { email, password: pw } = parse(
    z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }),
    req.body,
  );
  const user = await prisma.user.findUnique({ where: { email } });
  const generic = unauthorized('Incorrect email or password');
  if (!user) {
    await dummyVerify(pw);
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw unauthorized('Account temporarily locked after too many attempts. Try again later.');
  }
  if (!(await verifyPassword(user.passwordHash, pw))) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 6e4) }
        : { failedLogins: failed },
    });
    throw generic;
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await createSession(res, req, user.id, user.role);
  await mergeGuestCartIntoUser(req, res, user.id);
  res.json({ user: publicUser(user), ...(isStaff(user) && { mfa: { required: true, enrolled: user.totpEnabled } }) });
});

router.post('/logout', async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({
    user: publicUser(user),
    ...(isStaff(user) && { mfa: { required: true, enrolled: user.totpEnabled, verified: Boolean(req.mfaVerified) } }),
  });
});

// ---- Two-step sign-in (authenticator app) for STAFF / ADMIN ----
function requireStaffSession(req, _res, next) {
  if (!req.user) throw unauthorized();
  if (!isStaff(req.user)) throw badRequest('Two-step sign-in is only used for admin accounts');
  next();
}

/** First-time setup: returns a new secret + QR code. Only possible while 2FA is not yet switched on. */
router.post('/mfa/setup', requireStaffSession, mfaLimiter, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.totpEnabled) throw conflict('Two-step sign-in is already set up for this account');
  // Re-use a pending (not yet confirmed) secret so reloading the page doesn't invalidate a QR code
  // the user has already scanned.
  const secret = user.totpSecret || authenticator.generateSecret(20);
  if (!user.totpSecret) await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  const otpauth = authenticator.keyuri(user.email, 'YAOUA Admin', secret);
  res.json({ secret, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) });
});

/** Check a 6-digit code. Switches 2FA on (first time) and unlocks the admin for this session. */
router.post('/mfa/verify', requireStaffSession, mfaLimiter, async (req, res) => {
  const { code } = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') }), req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.totpSecret || !authenticator.check(code, user.totpSecret)) throw unauthorized('That code is not correct');
  if (!user.totpEnabled) await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await prisma.session.update({ where: { id: req.sessionId }, data: { mfaVerified: true } });
  res.json({ ok: true });
});

router.patch('/me', requireAuth, async (req, res) => {
  const data = parse(
    z.object({ name: z.string().trim().min(2).max(100).optional(), phone: z.string().trim().max(30).optional() }),
    req.body,
  );
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: publicUser(user) });
});

router.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = parse(
    z.object({ currentPassword: z.string().min(1), newPassword: password }),
    req.body,
  );
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) throw badRequest('Current password is incorrect');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  // Invalidate every other session.
  await prisma.session.deleteMany({ where: { userId: user.id, NOT: { id: req.sessionId } } });
  res.json({ ok: true });
});

// ---- Addresses ----
const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30),
  line1: z.string().trim().min(2).max(200),
  line2: z.string().trim().max(200).optional(),
  area: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2).max(100),
  country: z.string().trim().length(2).toUpperCase().default('QA'),
  postalCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().optional(),
});

router.get('/addresses', requireAuth, async (req, res) => {
  res.json({ addresses: await prisma.address.findMany({ where: { userId: req.user.id }, orderBy: { isDefault: 'desc' } }) });
});

router.post('/addresses', requireAuth, async (req, res) => {
  const data = parse(addressSchema, req.body);
  if (data.isDefault) await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  res.status(201).json({ address: await prisma.address.create({ data: { ...data, userId: req.user.id } }) });
});

router.delete('/addresses/:id', requireAuth, async (req, res) => {
  await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
});

module.exports = { router, publicUser, addressSchema };
