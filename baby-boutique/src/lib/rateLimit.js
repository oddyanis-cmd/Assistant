// Rate limiters backed by Postgres, so a limit holds across every server instance. An in-memory
// counter would reset on each Netlify Function instance and let attackers keep guessing passwords.
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const prisma = require('./prisma');
const clientIp = require('./clientIp');

class PrismaStore {
  constructor(name) { this.name = name; this.prefix = `${name}:`; }
  init(options) { this.windowMs = options.windowMs; }
  async increment(key) {
    const k = this.prefix + key;
    const rows = await prisma.$queryRaw`
      INSERT INTO "RateLimit" ("key", "hits", "resetAt")
      VALUES (${k}, 1, NOW() + (${this.windowMs}::int * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "hits"    = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "hits", "resetAt"`;
    return { totalHits: rows[0].hits, resetTime: rows[0].resetAt };
  }
  async decrement(key) {
    await prisma.$executeRaw`UPDATE "RateLimit" SET "hits" = GREATEST("hits" - 1, 0) WHERE "key" = ${this.prefix + key}`;
  }
  async resetKey(key) {
    await prisma.rateLimit.deleteMany({ where: { key: this.prefix + key } });
  }
}

/**
 * limiter({ name, windowMs, limit, key? }) — `key(req)` lets a limiter count per account/email
 * instead of per IP (e.g. to slow down password guessing spread across many IPs).
 */
function limiter({ name, windowMs, limit, key, message = 'Too many attempts, please try again later' }) {
  return rateLimit({
    windowMs,
    limit: process.env.NODE_ENV === 'test' && !process.env.STRICT_RATE_LIMITS ? Math.max(limit, 1000) : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new PrismaStore(name),
    keyGenerator: (req) => (key ? key(req) : ipKeyGenerator(clientIp(req))),
    message: { error: message },
    passOnStoreError: false,
    validate: { trustProxy: false, xForwardedForHeader: false },
  });
}

/** Remove expired counters (called by the scheduled housekeeping job). */
const purgeExpired = () => prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });

module.exports = { limiter, purgeExpired, PrismaStore };
