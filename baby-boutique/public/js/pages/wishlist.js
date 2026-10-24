import { api } from '../api.js';
import { html, raw, qs } from '../util.js';
import { init, fail, setTitle, state, revealOnScroll } from '../layout.js';
import { productCard, wireCards } from '../components.js';

async function main() {
  await init();
  setTitle('Wishlist');
  if (!state.user) {
    qs('#main').innerHTML = html`<div class="container section"><div class="empty"><h1>Your wishlist</h1><p class="muted">Log in to save your favourite pieces.</p><a class="btn" href="/login?next=/wishlist">Log in</a></div></div>`;
    return;
  }
  const { items } = await api('/wishlist');
  items.forEach((p) => state.wishlist.add(p.id));
  qs('#main').innerHTML = items.length
    ? html`<div class="container section"><h1>Your wishlist</h1><div class="product-grid" id="grid">${items.map((p) => raw(productCard(p)))}</div></div>`
    : html`<div class="container section"><div class="empty"><h1>Your wishlist is empty</h1><p class="muted">Tap the heart on any product to save it here.</p><a class="btn" href="/shop">Browse the shop</a></div></div>`;
  if (items.length) wireCards(qs('#grid'), items);
  revealOnScroll();
}
main().catch(fail);
