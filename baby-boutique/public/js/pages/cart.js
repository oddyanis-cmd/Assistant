import { api } from '../api.js';
import { html, raw, qs, fmt, toast } from '../util.js';
import { init, fail, setTitle, updateCartBadge } from '../layout.js';

function render(cart) {
  updateCartBadge(cart);
  const remaining = cart.freeShippingThreshold ? Math.max(0, cart.freeShippingThreshold - cart.subtotal) : 0;
  const pct = cart.freeShippingThreshold ? Math.min(100, (cart.subtotal / cart.freeShippingThreshold) * 100) : 100;
  const blocked = cart.lines.some((l) => !l.inStock);
  qs('#main').innerHTML = !cart.lines.length
    ? html`<div class="container section"><div class="empty"><h1>Your cart is empty</h1><p class="muted">Little treasures are waiting for you.</p><a class="btn" href="/shop">Start shopping</a></div></div>`
    : html`
    <div class="container page-head"><h1>Your cart</h1></div>
    <div class="container cart-layout">
      <section aria-label="Cart items">
        ${cart.lines.map((l) => raw(html`
          <div class="cart-line" data-id="${l.id}">
            <a href="/product/${l.slug}">${raw(l.imageUrl ? html`<img src="${l.imageUrl}" alt="${l.productName}" loading="lazy">` : '')}</a>
            <div>
              <a href="/product/${l.slug}"><strong>${l.productName}</strong></a>
              <div class="meta">${[l.size, l.color].filter(Boolean).join(' · ')}${l.personalization ? ` · “${l.personalization}”` : ''}</div>
              <div class="meta">${fmt(l.unitPrice)} each</div>
              ${raw(!l.available ? '<p class="form-error">No longer available — please remove</p>' : !l.inStock ? html`<p class="form-error">Only ${l.stock} left — please reduce the quantity</p>` : '')}
              <div class="buy-row">
                <div class="qty"><button type="button" data-delta="-1" aria-label="Decrease">−</button><input type="number" value="${l.quantity}" min="1" max="20" aria-label="Quantity" data-qty><button type="button" data-delta="1" aria-label="Increase">+</button></div>
                <button class="link-btn" data-remove>Remove</button>
              </div>
            </div>
            <strong>${fmt(l.lineTotal)}</strong>
          </div>`))}
      </section>
      <aside class="summary" aria-label="Order summary">
        <h2>Summary</h2>
        ${raw(cart.freeShippingThreshold ? html`<p class="muted">${remaining > 0 ? `Add ${fmt(remaining)} more for free delivery` : 'You have free delivery 🎉'}</p><div class="progress"><div data-progress="${pct}"></div></div>` : '')}
        <div class="row"><span>Subtotal</span><span>${fmt(cart.subtotal)}</span></div>
        <div class="row"><span>Delivery</span><span>${cart.shippingFee ? fmt(cart.shippingFee) : 'Free'}</span></div>
        <div class="row total"><span>Total</span><span>${fmt(cart.total)}</span></div>
        ${raw(blocked ? '<p class="notice notice--warn">Please fix the highlighted items before checking out.</p>' : '')}
        <a class="btn btn--block mt ${blocked ? 'hidden' : ''}" href="/checkout">Checkout</a>
        <a class="btn btn--ghost btn--block mt" href="/shop">Continue shopping</a>
      </aside>
    </div>`;
  const bar = qs('[data-progress]');
  if (bar) requestAnimationFrame(() => bar.style.setProperty('width', `${bar.dataset.progress}%`));
}

async function update(id, quantity) {
  try {
    const { cart } = quantity === 0 ? await api(`/cart/items/${id}`, { method: 'DELETE' }) : await api(`/cart/items/${id}`, { method: 'PATCH', body: { quantity } });
    render(cart);
  } catch (e) {
    toast(e.message, { error: true });
  }
}

async function main() {
  await init();
  setTitle('Your cart');
  const { cart } = await api('/cart');
  render(cart);
  qs('#main').addEventListener('click', (e) => {
    const line = e.target.closest('[data-id]');
    if (!line) return;
    const input = qs('[data-qty]', line);
    if (e.target.closest('[data-remove]')) update(line.dataset.id, 0);
    const d = e.target.closest('[data-delta]');
    if (d) update(line.dataset.id, Math.max(0, Number(input.value) + Number(d.dataset.delta)));
  });
  qs('#main').addEventListener('change', (e) => {
    if (e.target.matches('[data-qty]')) update(e.target.closest('[data-id]').dataset.id, Math.max(0, Math.min(20, Number(e.target.value) || 0)));
  });
}

main().catch(fail);
