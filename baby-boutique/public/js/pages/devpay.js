// Development-only fake payment page. The server refuses this route and API in production.
import { api } from '../api.js';
import { html, qs, params, toast } from '../util.js';
import { init, fail, setTitle } from '../layout.js';

async function main() {
  await init();
  setTitle('Test payment');
  const p = params();
  const order = p.get('order');
  const token = p.get('token');
  qs('#main').innerHTML = html`
    <div class="container section auth-card">
      <div class="panel">
        <p class="notice notice--warn"><strong>DEVELOPMENT MODE.</strong> This is a simulated payment page. No card is charged and no money moves.</p>
        <h1>Test payment</h1>
        <p>Order <strong>${order}</strong></p>
        <button class="btn btn--block" data-outcome="success">Simulate successful payment</button>
        <button class="btn btn--ghost btn--block mt" data-outcome="failure">Simulate declined payment</button>
      </div>
    </div>`;
  qs('#main').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-outcome]');
    if (!b) return;
    try {
      await api('/payments/dev/complete', { method: 'POST', body: { order, token, ref: p.get('ref'), outcome: b.dataset.outcome } });
      location.href = `/order?order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}${b.dataset.outcome === 'failure' ? '&cancelled=1' : ''}`;
    } catch (ex) {
      toast(ex.message, { error: true });
    }
  });
}
main().catch(fail);
