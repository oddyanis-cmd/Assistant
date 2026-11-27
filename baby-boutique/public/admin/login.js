// Admin-only sign-in. Lives under /admin so staff never pass through the storefront.
// The server still enforces roles on every /api/admin call; this page just refuses customer accounts up front.
import { api } from '/js/api.js';
import { qs } from '/js/util.js';

const STAFF = ['ADMIN', 'STAFF'];

async function main() {
  const { user } = await api('/auth/me');
  if (user && STAFF.includes(user.role)) return location.replace('/admin');

  const form = qs('#admin-auth');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = qs('button', form);
    const err = qs('#auth-error');
    err.textContent = '';
    btn.disabled = true;
    try {
      const { user: u } = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      if (!u || !STAFF.includes(u.role)) {
        await api('/auth/logout', { method: 'POST' });
        throw new Error('This account does not have admin access.');
      }
      location.replace('/admin');
    } catch (ex) {
      err.textContent = ex.details ? Object.values(ex.details).flat().join(' ') : ex.message;
      btn.disabled = false;
    }
  });
}
main();
