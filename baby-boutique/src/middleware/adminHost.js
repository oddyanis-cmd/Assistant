// Keeps the admin and the storefront completely separate when ADMIN_URL is set
// (e.g. APP_URL=https://yaoua.qa, ADMIN_URL=https://admin.yaoua.qa):
//  - storefront host: /admin and /api/admin do not exist (plain 404), so customers never see the admin;
//  - admin host: only the admin, its sign-in page, the API and static assets are served; every
//    storefront page redirects to /admin, and search engines are told not to index anything.
// Session cookies are host-only, so a storefront login never carries over to the admin and vice versa.
// Without ADMIN_URL (local development) both live on one host, as before.
const path = require('node:path');
const env = require('../config/env');

const isAdminPath = (p) => p === '/admin' || p.startsWith('/admin/') || p === '/api/admin' || p.startsWith('/api/admin/');
const ADMIN_HOST_ALLOWED = ['/api/', '/js/', '/css/', '/img/', '/uploads/', '/media/', '/fonts/'];

module.exports = function adminHost(req, res, next) {
  if (!env.ADMIN_URL) return next();
  const adminHostname = new URL(env.ADMIN_URL).hostname;
  const p = req.path;

  if (req.hostname === adminHostname) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (p === '/robots.txt') return res.type('text/plain').send('User-agent: *\nDisallow: /\n');
    if (isAdminPath(p) || p === '/favicon.ico' || ADMIN_HOST_ALLOWED.some((a) => p.startsWith(a))) return next();
    return res.redirect(302, '/admin');
  }

  if (isAdminPath(p)) {
    if (p.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    return res.status(404).sendFile('404.html', { root: path.join(__dirname, '..', '..', 'public') });
  }
  return next();
};
