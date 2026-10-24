const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const prisma = require('../../lib/prisma');
const { parse } = require('../../lib/validate');
const { badRequest, unauthorized, conflict } = require('../../lib/errors');
const { hashPassword, verifyPassword, dummyVerify } = require('./password');
const { createSession, destroySession, requireAuth } = require('../../middleware/session');
const { mergeGuestCartIntoUser } = require('../cart/service');

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

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

router.post('/register', authLimiter, async (req, res) => {
  const data = parse(registerSchema, req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw conflict('An account with this email already exists');
  const user = await prisma.user.create({
    data: { email: data.email, name: data.name, phone: data.phone, passwordHash: await hashPassword(data.password) },
  });
  await createSession(res, req, user.id);
  await mergeGuestCartIntoUser(req, res, user.id);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
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
  await createSession(res, req, user.id);
  await mergeGuestCartIntoUser(req, res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user: publicUser(user) });
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
