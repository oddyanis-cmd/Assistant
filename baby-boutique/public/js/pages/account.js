import { api } from '../api.js';
import { html, raw, qs, fmt, toast } from '../util.js';
import { init, fail, setTitle, state } from '../layout.js';

async function main() {
  await init();
  if (!state.user) return (location.href = '/login?next=/account');
  setTitle('My account');
  const [{ orders }, { addresses }] = await Promise.all([api('/account/orders'), api('/auth/addresses')]);
  const isStaff = ['ADMIN', 'STAFF'].includes(state.user.role);

  qs('#main').innerHTML = html`
    <div class="container section">
      <div class="section-head"><div><span class="eyebrow">My account</span><h1>Hello, ${state.user.name.split(' ')[0]}</h1></div>
        <div class="buy-row">${raw(isStaff ? '<a class="btn btn--rose" href="/admin">Admin dashboard</a>' : '')}<button class="btn btn--ghost" id="logout">Log out</button></div></div>
      <div class="cart-layout">
        <section class="panel">
          <h2>Orders</h2>
          ${raw(orders.length ? orders.map((o) => html`<div class="order-row"><div><a href="/order?order=${o.number}"><strong>${o.number}</strong></a><div class="muted">${new Date(o.createdAt).toLocaleDateString()} · ${o.items.length} item(s)</div></div><div><span class="status status--${o.status}">${o.status.replace('_', ' ')}</span> <strong>${fmt(o.total)}</strong></div></div>`).join('') : '<p class="muted">No orders yet.</p>')}
        </section>
        <aside>
          <section class="panel">
            <h2>Profile</h2>
            <form id="profile">
              <div class="field"><label for="pname">Name</label><input id="pname" name="name" value="${state.user.name}"></div>
              <div class="field"><label for="pphone">Phone</label><input id="pphone" name="phone" value="${state.user.phone ?? ''}"></div>
              <button class="btn btn--sm">Save</button>
            </form>
          </section>
          <section class="panel">
            <h2>Addresses</h2>
            ${raw(addresses.length ? addresses.map((a) => html`<div class="order-row"><span>${a.fullName}, ${a.line1}, ${a.city}${a.isDefault ? ' (default)' : ''}</span><button class="link-btn" data-del-address="${a.id}">Remove</button></div>`).join('') : '<p class="muted">Addresses you save at checkout appear here.</p>')}
          </section>
          <section class="panel">
            <h2>Change password</h2>
            <form id="pw">
              <div class="field"><label for="cur">Current password</label><input id="cur" name="currentPassword" type="password" autocomplete="current-password" required></div>
              <div class="field"><label for="new">New password</label><input id="new" name="newPassword" type="password" autocomplete="new-password" minlength="10" required></div>
              <button class="btn btn--sm">Update password</button>
            </form>
          </section>
        </aside>
      </div>
    </div>`;

  qs('#logout').addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/'; });
  qs('#profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/auth/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); toast('Profile saved'); } catch (ex) { toast(ex.message, { error: true }); }
  });
  qs('#pw').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/auth/change-password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Password updated'); e.target.reset(); } catch (ex) { toast(ex.details ? Object.values(ex.details).flat().join(' ') : ex.message, { error: true }); }
  });
  qs('#main').addEventListener('click', async (e) => {
    const id = e.target.dataset.delAddress;
    if (!id) return;
    await api(`/auth/addresses/${id}`, { method: 'DELETE' });
    e.target.closest('.order-row').remove();
  });
}
main().catch(fail);
