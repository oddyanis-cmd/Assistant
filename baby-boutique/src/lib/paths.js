// Where the storefront/admin files live. Normally ../public next to src/, but when Netlify bundles the
// app into netlify/functions/app.mjs the code runs from a different folder, so check the known places.
const fs = require('node:fs');
const path = require('node:path');

const candidates = [
  path.join(__dirname, '..', '..', 'public'), // src/lib -> project root
  path.join(__dirname, '..', 'public'), // bundled into netlify/functions -> netlify/public (not used) / src -> public
  path.join(__dirname, '..', '..', '..', 'public'),
  path.join(process.cwd(), 'public'),
];
const publicDir = candidates.find((p) => fs.existsSync(path.join(p, 'index.html'))) || candidates[0];

module.exports = { publicDir };
