const prisma = require('../../lib/prisma');
const defaults = require('./defaults');

const KEYS = Object.keys(defaults);
const PUBLIC_KEYS = ['brand', 'hero', 'home', 'navigation', 'footer', 'shipping', 'commerce', 'newsletter'];

let cache = null;
let cacheAt = 0;
const TTL = 30_000;

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}
function deepMerge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
  return out;
}

async function getAll() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const rows = await prisma.setting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache = Object.fromEntries(KEYS.map((k) => [k, deepMerge(defaults[k], stored[k])]));
  cacheAt = Date.now();
  return cache;
}

async function get(key) {
  return (await getAll())[key];
}

async function getPublic() {
  const all = await getAll();
  return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, all[k]]));
}

async function set(key, value) {
  if (!KEYS.includes(key)) throw new Error(`Unknown setting ${key}`);
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  cache = null;
  return get(key);
}

module.exports = { getAll, get, getPublic, set, KEYS, deepMerge };
