import { api } from '../api.js';
import { html, raw, qs, fmt, params, toast } from '../util.js';
import { init, fail, setTitle } from '../layout.js';

const LABEL = {
  PENDING_PAYMENT: 'Awaiting payment', PAID: 'Paid — thank you!', PROCESSING: 'Being prepared', SHIPPED: 'On its way',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled', REFUNDED: 'Refunded',
};

async function main() {
  await init();
  const p = params();
  const number = p.get('order');
  const token = p.get('token') || (() => { try { return sessionStorage.getItem(`order:${number}`); } catch { return null; } })();
  setTitle(`Order ${number}`);
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  const { order: o } = await api(`/orders/${encodeURIComponent(number)}${q}`);
  const a = o.shippingAddress;
  const { providers } = o.status === 'PENDING_PAYMENT' ? await api('/checkout/providers') : { providers: [] };

  qs('#main').innerHTML = html`
    <div class="container section">
      ${raw(o.status === 'PAID' ? '<p class="notice notice--ok">Your payment was received. A confirmation has been recorded for this order.</p>' : '')}
      ${raw(p.get('cancelled') ? '<p class="notice notice--warn">Payment was cancelled. Your items are reserved for a short time — you can try again below.</p>' : '')}
      <span class="eyebrow">Order ${o.number}</span>
      <h1>${LABEL[o.status] ?? o.status}</h1>
      <p class="muted">Placed ${new Date(o.createdAt).toLocaleString()} · ${o.email}</p>
      ${raw(o.trackingNumber ? html`<p>Tracking number: <strong>${o.trackingNumber}</strong></p>` : '')}
      <div class="cart-layout mt-lg">
        <section class="panel">
          ${o.items.map((i) => raw(html`<div class="cart-line">${raw(i.imageUrl ? html`<img src="${i.imageUrl}" alt="">` : '<span></span>')}<div><strong>${i.productName}</strong><div class="meta">${[i.size, i.color, i.personalization && `“${i.personalization}”`].filter(Boolean).join(' · ')}</div><div class="meta">${i.quantity} × ${fmt(i.unitPrice)}</div></div><strong>${fmt(i.unitPrice * i.quantity)}</strong></div>`))}
        </section>
        <aside class="summary">
          <div class="row"><span>Subtotal</span><span>${fmt(o.subtotal)}</span></div>
          <div class="row"><span>Delivery</span><span>${o.shippingFee ? fmt(o.shippingFee) : 'Free'}</span></div>
          <div class="row total"><span>Total</span><span>${fmt(o.total)}</span></div>
          <h3 class="mt">Delivering to</h3>
          <p>${a.fullName}<br>${a.line1}${a.line2 ? `, ${a.line2}` : ''}<br>${[a.area, a.city, a.country].filter(Boolean).join(', ')}<br>${a.phone}</p>
          ${raw(o.status === 'PENDING_PAYMENT' && token && providers.length ? html`
            <h3>Complete payment</h3>
            <select id="retry-provider">${providers.map((pr) => raw(html`<option value="${pr.id}">${pr.label}</option>`))}</select>
            <button class="btn btn--block mt" id="retry">Pay ${fmt(o.total)}</button>` : '')}
          <a class="btn btn--ghost btn--block mt" href="/shop">Continue shopping</a>
        </aside>
      </div>
    </div>`;
  qs('#retry')?.addEventListener('click', async () => {
    try {
      const r = await api(`/orders/${encodeURIComponent(number)}/pay`, { method: 'POST', body: { token, provider: qs('#retry-provider').value } });
      location.href = r.redirectUrl;
    } catch (e) {
      toast(e.message, { error: true });
    }
  });
}

main().catch(fail);
