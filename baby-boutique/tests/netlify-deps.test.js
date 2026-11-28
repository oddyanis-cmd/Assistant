// Netlify ships only packages imported (ESM) by the function entry. Every runtime dependency the
// app requires must therefore be listed in netlify/deps.mjs, or the live site crashes on start.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('every runtime dependency is listed for the Netlify function bundle', () => {
  const root = path.join(__dirname, '..');
  const deps = Object.keys(require(path.join(root, 'package.json')).dependencies);
  const listed = fs.readFileSync(path.join(root, 'netlify', 'deps.mjs'), 'utf8') + fs.readFileSync(path.join(root, 'netlify', 'functions', 'app.mjs'), 'utf8');
  const notNeededAtRuntime = ['prisma', '@netlify/database'];
  const missing = deps.filter((d) => !notNeededAtRuntime.includes(d) && !listed.includes(`'${d}'`));
  assert.deepEqual(missing, [], `Add these to netlify/deps.mjs: ${missing.join(', ')}`);
});
