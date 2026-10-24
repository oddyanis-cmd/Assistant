// Shared header/footer, brand theming and global state for every storefront page.
import { api } from './api.js';
import { html, raw, qs, setCurrency, toast, esc } from './util.js';
import { icons } from './icons.js';

export const state = { settings: null, user: null, cart: null, wishlist: new Set() };

function applyBrand(brand) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(brand.colors || {})) if (/^#[0-9a-f]{3,8}$/i.test(v)) root.setProperty(`--${k}`, v);
  const fonts = [brand.fonts?.heading, brand.fonts?.body].filter(Boolean);
  if (brand.fonts?.heading) root.setProperty('--font-heading', `'${brand.fonts.heading}', Georgia, serif`);
  if (brand.fonts?.body) root.setProperty('--font-body', `'${brand.fonts.body}', system-ui, sans-serif`);
  if (fonts.length) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700;800`).join('&')}&display=swap`;
    document.head.append(link);
  }
  if (brand.faviconUrl) {
    const fav = document.createElement('link');
    fav.rel = 'icon';
    fav.href = brand.faviconUrl;
    document.head.append(fav);
  }
}

export function setTitle(title) {
  const brand = state.settings?.brand?.name ?? '';
  document.title = title ? `${title} · ${brand}` : `${brand} — ${state.settings?.brand?.tagline ?? ''}`;
}

export function setMeta(description) {
  let m = qs('meta[name="description"]');
  if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.append(m); }
  m.content = description;
}

function headerHtml(s) {
  const { brand, navigation } = s;
  const here = location.pathname + location.search;
  return html`
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="site-header">
    <div class="container header-inner">
      <button class="icon-btn menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="main-nav">${raw(icons.menu)}</button>
      <a class="logo" href="/" aria-label="${brand.name} home">${raw(brand.logoUrl ? html`<img src="${brand.logoUrl}" alt="">` : '')}<span>${brand.name}</span></a>
      <nav class="main-nav" id="main-nav" aria-label="Main">
        <button class="icon-btn nav-close" aria-label="Close menu">${raw(icons.close)}</button>
        <ul>${navigation.map((n) => raw(html`<li><a href="${n.href}" ${raw(n.href === here || (n.href !== '/' && here === n.href) ? 'aria-current="page"' : '')}>${n.label}</a></li>`))}</ul>
      </nav>
      <div class="header-actions">
        <button class="icon-btn" data-action="search" aria-label="Search" aria-expanded="false" aria-controls="search-panel">${raw(icons.search)}</button>
        <a class="icon-btn hide-xs" href="${state.user ? '/account' : '/login'}" aria-label="${state.user ? 'My account' : 'Log in'}">${raw(icons.user)}</a>
        <a class="icon-btn hide-xs" href="/wishlist" aria-label="Wishlist">${raw(icons.heart)}<span class="badge" data-wish-count hidden></span></a>
        <a class="icon-btn" href="/cart" aria-label="Shopping cart">${raw(icons.bag)}<span class="badge" data-cart-count hidden></span></a>
      </div>
    </div>
    <div class="search-panel" id="search-panel" hidden>
      <form class="container" action="/shop" role="search">
        <label class="sr-only" for="site-search">Search products</label>
        <input id="site-search" type="search" name="q" placeholder="Search cardigans, booties, dolls…" autocomplete="off">
        <button class="btn" type="submit">Search</button>
      </form>
    </div>
  </div>`;
}

function footerHtml(s) {
  const { brand, footer } = s;
  const socials = Object.entries(footer.social || {}).filter(([, url]) => url);
  return html`
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <span class="footer-brand">${brand.name}</span>
          <p>${footer.about}</p>
          <div class="social">${socials.map(([k, url]) => raw(html`<a href="${url}" target="_blank" rel="noopener" aria-label="${k}">${raw(icons[k] || '')}</a>`))}</div>
        </div>
        <div>
          <h4>Shop</h4>
          <ul><li><a href="/shop">All products</a></li><li><a href="/shop?category=baby-clothes">Baby clothes</a></li><li><a href="/shop?category=handmade-dolls">Handmade dolls</a></li><li><a href="/shop?category=gift-boxes">Gift sets</a></li><li><a href="/about">About us</a></li></ul>
        </div>
        <div>
          <h4>Help</h4>
          <ul><li><a href="/shipping-policy">Shipping policy</a></li><li><a href="/return-policy">Return policy</a></li><li><a href="/faq">FAQ</a></li><li><a href="/privacy-policy">Privacy policy</a></li><li><a href="/terms">Terms &amp; conditions</a></li></ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul>
            ${raw(footer.email ? html`<li><a href="mailto:${footer.email}">${footer.email}</a></li>` : '')}
            ${raw(footer.phone ? html`<li><a href="tel:${footer.phone.replace(/\s/g, '')}">${footer.phone}</a></li>` : '')}
            ${raw(footer.whatsapp ? html`<li><a href="https://wa.me/${footer.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a></li>` : '')}
            <li>${footer.address}</li>
            <li><a href="/contact">Contact form</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} ${brand.name}. ${footer.securePaymentText}</span>
        <span class="pay-icons" aria-label="Accepted payments"><span>VISA</span><span>Mastercard</span><span>PayPal</span></span>
      </div>
    </div>
  </footer>`;
}

function wireHeader() {
  const nav = qs('#main-nav');
  const toggle = qs('.menu-toggle');
  let backdrop;
  const close = () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    backdrop?.remove();
    document.body.style.overflow = '';
  };
  toggle.addEventListener('click', () => {
    nav.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.addEventListener('click', close);
    document.body.append(backdrop);
    document.body.style.overflow = 'hidden';
    qs('a', nav)?.focus();
  });
  qs('.nav-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());

  const searchBtn = qs('[data-action="search"]');
  const panel = qs('#search-panel');
  searchBtn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    searchBtn.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) qs('#site-search').focus();
  });
}

export function updateCartBadge(cart) {
  state.cart = cart;
  const el = qs('[data-cart-count]');
  if (!el) return;
  el.textContent = cart?.itemCount ?? 0;
  el.hidden = !cart?.itemCount;
}
function updateWishBadge() {
  const el = qs('[data-wish-count]');
  if (!el) return;
  el.textContent = state.wishlist.size;
  el.hidden = !state.wishlist.size;
}

export async function toggleWishlist(productId, btn) {
  if (!state.user) {
    toast('Log in to save favourites', { link: { href: `/login?next=${encodeURIComponent(location.pathname + location.search)}`, label: 'Log in' } });
    return;
  }
  const on = state.wishlist.has(productId);
  try {
    await api(`/wishlist/${productId}`, { method: on ? 'DELETE' : 'POST' });
    on ? state.wishlist.delete(productId) : state.wishlist.add(productId);
    if (btn) btn.setAttribute('aria-pressed', String(!on));
    updateWishBadge();
    toast(on ? 'Removed from wishlist' : 'Saved to wishlist', { link: on ? null : { href: '/wishlist', label: 'View' } });
  } catch (e) {
    toast(e.message, { error: true });
  }
}

export async function addToCart(variantId, quantity = 1, personalization = '') {
  try {
    const { cart } = await api('/cart/items', { method: 'POST', body: { variantId, quantity, personalization } });
    updateCartBadge(cart);
    toast('Added to your cart', { link: { href: '/cart', label: 'View cart' } });
    return true;
  } catch (e) {
    toast(e.message, { error: true });
    return false;
  }
}

function revealOnScroll() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.1 });
  document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
}
export { revealOnScroll };

/** Boot sequence shared by all storefront pages. */
export async function init() {
  const [{ settings }, { user }, { cart }] = await Promise.all([api('/settings'), api('/auth/me'), api('/cart')]);
  state.settings = settings;
  state.user = user;
  setCurrency(settings.commerce.currency, settings.commerce.locale);
  applyBrand(settings.brand);
  qs('#site-header').innerHTML = headerHtml(settings);
  qs('#site-footer').innerHTML = footerHtml(settings);
  wireHeader();
  updateCartBadge(cart);
  if (user) {
    api('/wishlist').then(({ items }) => { items.forEach((p) => state.wishlist.add(p.id)); updateWishBadge(); document.dispatchEvent(new CustomEvent('wishlist:loaded')); }).catch(() => {});
  }
  setTitle();
  navigator.sendBeacon?.('/api/analytics/event', new Blob([JSON.stringify({ type: 'page_view', path: location.pathname })], { type: 'application/json' }));
  return state;
}

export function fail(e) {
  console.error(e);
  const main = qs('#main');
  if (main) main.innerHTML = html`<div class="container section"><div class="empty"><h2>Something went wrong</h2><p class="muted">${e.message}</p><a class="btn" href="/">Back to home</a></div></div>`;
}

export { esc };
