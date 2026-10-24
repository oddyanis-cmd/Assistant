import { api } from '../api.js';
import { html, raw, qs, fmt, toast } from '../util.js';
import { init, fail, setTitle, state } from '../layout.js';

const COUNTRY_NAMES = { QA: 'Qatar', AE: 'United Arab Emirates', SA: 'Saudi Arabia', KW: 'Kuwait', BH: 'Bahrain', OM: 'Oman' };

async function main() {
  await init();
  setTitle('Checkout');
  const [{ cart }, { providers }, addresses] = await Promise.all([
    api('/cart'),
    api('/checkout/providers'),
    state.user ? api('/auth/addresses').then((r) => r.addresses) : Promise.resolve([]),
  ]);
  if (!cart.lines.length) return (location.href = '/cart');
  const def = addresses.find((a) => a.isDefault) ?? addresses[0] ?? {};
  const countries = state.settings.shipping.countries;

  qs('#main').innerHTML = html`
    <div class="container page-head"><nav class="breadcrumbs"><a href="/cart">Cart</a> / Checkout</nav><h1>Checkout</h1></div>
    <form class="container cart-layout" id="checkout" novalidate>
      <div>
        <section class="panel">
          <h2>Contact</h2>
          ${raw(state.user
            ? html`<p>Ordering as <strong>${state.user.email}</strong></p><input type="hidden" name="email" value="${state.user.email}">`
            : html`<p class="muted">Already have an account? <a class="link-btn" href="/login?next=/checkout">Log in</a> — or continue as a guest.</p>
              <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="email"></div>`)}
        </section>
        <section class="panel">
          <h2>Delivery address</h2>
          <div class="form-grid">
            <div class="field"><label for="fullName">Full name</label><input id="fullName" name="fullName" required autocomplete="name" value="${def.fullName ?? state.user?.name ?? ''}"></div>
            <div class="field"><label for="phone">Mobile</label><input id="phone" name="phone" type="tel" required autocomplete="tel" value="${def.phone ?? state.user?.phone ?? ''}"></div>
          </div>
          <div class="field"><label for="line1">Address (building, street, zone)</label><input id="line1" name="line1" required autocomplete="address-line1" value="${def.line1 ?? ''}"></div>
          <div class="field"><label for="line2">Apartment / unit (optional)</label><input id="line2" name="line2" autocomplete="address-line2" value="${def.line2 ?? ''}"></div>
          <div class="form-grid">
            <div class="field"><label for="area">Area</label><input id="area" name="area" value="${def.area ?? ''}"></div>
            <div class="field"><label for="city">City</label><input id="city" name="city" required autocomplete="address-level2" value="${def.city ?? 'Doha'}"></div>
          </div>
          <div class="field"><label for="country">Country</label><select id="country" name="country">${countries.map((c) => raw(html`<option value="${c}">${COUNTRY_NAMES[c] ?? c}</option>`))}</select></div>
          ${raw(state.user ? '<label class="checkbox"><input type="checkbox" name="saveAddress"> <span>Save this address to my account</span></label>' : '')}
          <div class="field mt"><label for="note">Order note / gift message (optional)</label><textarea id="note" name="customerNote" maxlength="500"></textarea></div>
        </section>
        <section class="panel">
          <h2>Payment</h2>
          ${raw(providers.length
            ? providers.map((p, i) => html`<label class="pay-option"><input type="radio" name="provider" value="${p.id}" ${raw(i === 0 ? 'checked' : '')}> <span>${p.label}</span></label>`).join('')
            : '<p class="notice notice--err">Online payment is not available right now. Please contact us to place your order.</p>')}
          ${raw(providers.some((p) => p.testMode) ? '<p class="notice notice--warn"><strong>Development mode:</strong> the test payment option does not charge any card.</p>' : '')}
          <p class="muted">You will be redirected to our secure payment partner to complete your purchase. We never see or store your card details.</p>
        </section>
      </div>
      <aside class="summary">
        <h2>Your order</h2>
        ${cart.lines.map((l) => raw(html`<div class="row"><span>${l.quantity} × ${l.productName}<br><small class="muted">${[l.size, l.color, l.personalization && `“${l.personalization}”`].filter(Boolean).join(' · ')}</small></span><span>${fmt(l.lineTotal)}</span></div>`))}
        <div class="row"><span>Subtotal</span><span>${fmt(cart.subtotal)}</span></div>
        <div class="row"><span>Delivery</span><span>${cart.shippingFee ? fmt(cart.shippingFee) : 'Free'}</span></div>
        <div class="row total"><span>Total</span><span>${fmt(cart.total)}</span></div>
        <p class="form-error" id="checkout-error" role="alert"></p>
        <button class="btn btn--block mt" type="submit" ${raw(providers.length ? '' : 'disabled')}>Place order &amp; pay</button>
        <p class="muted mt"><small>By placing your order you agree to our <a href="/terms">terms</a> and <a href="/return-policy">return policy</a>.</small></p>
      </aside>
    </form>`;

  const form = qs('#checkout');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = qs('#checkout-error');
    err.textContent = '';
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const f = Object.fromEntries(new FormData(form));
    const btn = qs('button[type="submit"]', form);
    btn.disabled = true;
    btn.textContent = 'Redirecting to payment…';
    try {
      const r = await api('/checkout', {
        method: 'POST',
        body: {
          email: f.email,
          provider: f.provider,
          customerNote: f.customerNote || undefined,
          saveAddress: f.saveAddress === 'on',
          shippingAddress: { fullName: f.fullName, phone: f.phone, line1: f.line1, line2: f.line2 || undefined, area: f.area || undefined, city: f.city, country: f.country },
        },
      });
      // Keep the guest's order token for this tab so they can come back to the order page.
      try { sessionStorage.setItem(`order:${r.orderNumber}`, r.accessToken); } catch { /* storage may be blocked */ }
      location.href = r.redirectUrl;
    } catch (ex) {
      err.textContent = ex.details ? Object.entries(ex.details).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`).join(' · ') : ex.message;
      toast(ex.message, { error: true });
      btn.disabled = false;
      btn.textContent = 'Place order & pay';
    }
  });
}

main().catch(fail);
