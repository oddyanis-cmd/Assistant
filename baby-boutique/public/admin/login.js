// Admin-only sign-in: password, then a 6-digit authenticator code (set up on first sign-in).
// Lives under /admin so staff never pass through the storefront. The server enforces both steps
// on every /api/admin call; this page only guides the user through them.
import { api } from '/js/api.js';
import { qs } from '/js/util.js';

const STAFF = ['ADMIN', 'STAFF'];
const errText = (ex) => (ex.details ? Object.values(ex.details).flat().join(' ') : ex.message);

async function showMfa(enrolled) {
  qs('#admin-auth').hidden = true;
  qs('#mfa-form').hidden = false;
  if (!enrolled) {
    const { qr, secret } = await api('/auth/mfa/setup', { method: 'POST' });
    qs('#mfa-qr').src = qr;
    qs('#mfa-secret').textContent = secret.replace(/(.{4})/g, '$1 ').trim();
    qs('#mfa-setup').hidden = false;
    qs('#mfa-prompt').textContent = 'Then type the 6-digit code the app shows to finish.';
  }
  qs('#code').focus();
}

async function main() {
  const form = qs('#admin-auth');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = qs('button', form);
    qs('#auth-error').textContent = '';
    btn.disabled = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      if (!r.user || !STAFF.includes(r.user.role)) {
        await api('/auth/logout', { method: 'POST' });
        throw new Error('This account does not have admin access.');
      }
      await showMfa(r.mfa?.enrolled);
    } catch (ex) {
      qs('#auth-error').textContent = errText(ex);
      btn.disabled = false;
    }
  });

  const mfaForm = qs('#mfa-form');
  mfaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = qs('button', mfaForm);
    qs('#mfa-error').textContent = '';
    btn.disabled = true;
    try {
      await api('/auth/mfa/verify', { method: 'POST', body: { code: qs('#code').value.trim() } });
      location.replace('/admin');
    } catch (ex) {
      qs('#mfa-error').textContent = errText(ex);
      btn.disabled = false;
    }
  });

  // Already signed in with the password (e.g. page reloaded): go straight to the right step.
  const { user, mfa } = await api('/auth/me');
  if (user && STAFF.includes(user.role)) {
    if (mfa?.verified) return location.replace('/admin');
    await showMfa(mfa?.enrolled);
  }
}
main();
