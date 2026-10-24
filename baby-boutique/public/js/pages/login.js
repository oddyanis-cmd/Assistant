import { api } from '../api.js';
import { html, raw, qs, params } from '../util.js';
import { init, fail, setTitle, state } from '../layout.js';

// Only allow same-site relative redirects (prevents open-redirects via ?next=).
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/account');

function errorText(e) {
  return e.details ? Object.values(e.details).flat().join(' ') : e.message;
}

async function main() {
  await init();
  const next = safeNext(params().get('next'));
  if (state.user) return (location.href = next);
  let mode = location.pathname === '/register' ? 'register' : 'login';

  const render = () => {
    setTitle(mode === 'login' ? 'Log in' : 'Create account');
    qs('#main').innerHTML = html`
      <div class="container auth-card">
        <div class="panel">
          <div class="tabs" role="tablist">
            <button role="tab" aria-selected="${mode === 'login'}" data-mode="login">Log in</button>
            <button role="tab" aria-selected="${mode === 'register'}" data-mode="register">Create account</button>
          </div>
          <form id="auth" novalidate>
            ${raw(mode === 'register' ? html`<div class="field"><label for="name">Your name</label><input id="name" name="name" required autocomplete="name"></div>` : '')}
            <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email"></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required minlength="${mode === 'register' ? 10 : 1}" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}">
              ${raw(mode === 'register' ? '<small class="muted">At least 10 characters, with letters and numbers.</small>' : '')}</div>
            <p class="form-error" role="alert" id="auth-error"></p>
            <button class="btn btn--block">${mode === 'login' ? 'Log in' : 'Create account'}</button>
          </form>
        </div>
      </div>`;
  };
  render();

  qs('#main').addEventListener('click', (e) => {
    const t = e.target.closest('[data-mode]');
    if (t) { mode = t.dataset.mode; history.replaceState(null, '', `/${mode}${location.search}`); render(); }
  });
  qs('#main').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = qs('button.btn', e.target);
    btn.disabled = true;
    try {
      await api(`/auth/${mode}`, { method: 'POST', body: f });
      location.href = next;
    } catch (ex) {
      qs('#auth-error').textContent = errorText(ex);
      btn.disabled = false;
    }
  });
}
main().catch(fail);
