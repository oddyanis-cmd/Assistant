// Prints the database URL to use for migrations/seeding during a build:
// DIRECT_DATABASE_URL, else DATABASE_URL, else Netlify Database's URL with the Neon pooler removed
// (schema migrations need a direct connection).
const pick = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || '';
if (!pick) { console.error('No database URL found (DATABASE_URL or Netlify Database)'); process.exit(1); }
const u = new URL(pick);
if (!process.env.DIRECT_DATABASE_URL && !process.env.DATABASE_URL) u.hostname = u.hostname.replace('-pooler', '');
process.stdout.write(u.toString());
