// Recovery: switch off two-step sign-in for one admin account (e.g. lost phone).
// Run with database access only:  DATABASE_URL=... node scripts/reset-2fa.js owner@example.com
// The next admin sign-in will ask to set up the authenticator again. All their sessions are ended.
const prisma = require('../src/lib/prisma');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) { console.error('Usage: node scripts/reset-2fa.js <email>'); process.exit(1); }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error('No account with that email'); process.exit(1); }
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`Two-step sign-in reset for ${email}.`);
  await prisma.$disconnect();
})();
