import { api } from '../api.js';
import { html, raw, qs, qsa, fmt, img, stockLabel, stars, toast } from '../util.js';
import { icons } from '../icons.js';
import { init, fail, state, setTitle, setMeta, addToCart, toggleWishlist, revealOnScroll } from '../layout.js';
import { productCard, wireCards, variantPicker, modal } from '../components.js';

const slug = decodeURIComponent(location.pathname.split('/').pop());

function galleryHtml(p) {
  return html`
    <div class="gallery">
      <div class="gallery-main" tabindex="0" aria-label="Product image — press Enter to zoom">
        ${raw(img(p.images[0], { alt: p.name, eager: true, sizes: '(max-width: 900px) 100vw, 55vw' }))}
        ${raw(p.images.length > 1 ? html`<button class="icon-btn gallery-nav prev" aria-label="Previous image">${raw(icons.chevronL)}</button><button class="icon-btn gallery-nav next" aria-label="Next image">${raw(icons.chevronR)}</button>` : '')}
      </div>
      <div class="gallery-thumbs" role="list">
        ${p.images.map((im, i) => raw(html`<button role="listitem" data-i="${i}" aria-label="Show image ${i + 1}" aria-current="${i === 0}"><img src="${im.thumbUrl}" alt="" loading="lazy"></button>`))}
        ${raw(p.imageCount > p.images.length ? '<button class="link-btn" data-more>More photos</button>' : '')}
      </div>
    </div>`;
}

function wireGallery(p) {
  let idx = 0;
  const main = qs('.gallery-main');
  const show = (i) => {
    idx = (i + p.images.length) % p.images.length;
    const im = p.images[idx];
    const el = qs('img', main);
    el.src = im.mediumUrl;
    el.srcset = `${im.thumbUrl} 360w, ${im.mediumUrl} 800w, ${im.url} 2000w`;
    el.alt = im.alt;
    main.classList.remove('zoomed');
    qsa('.gallery-thumbs [data-i]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.i) === idx)));
  };
  qs('.gallery-thumbs').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-more')) {
      // Load the next page of a very large gallery.
      const page = Math.floor(p.images.length / 24) + 1;
      const r = await api(`/products/${encodeURIComponent(slug)}/images?page=${page}`);
      const known = new Set(p.images.map((i) => i.id));
      const fresh = r.images.filter((i) => !known.has(i.id));
      const start = p.images.length;
      p.images.push(...fresh);
      b.insertAdjacentHTML('beforebegin', fresh.map((im, k) => html`<button role="listitem" data-i="${start + k}" aria-label="Show image ${start + k + 1}" aria-current="false"><img src="${im.thumbUrl}" alt="" loading="lazy"></button>`).join(''));
      if (p.images.length >= p.imageCount) b.remove();
      return;
    }
    show(Number(b.dataset.i));
  });
  qs('.prev', main)?.addEventListener('click', (e) => { e.stopPropagation(); show(idx - 1); });
  qs('.next', main)?.addEventListener('click', (e) => { e.stopPropagation(); show(idx + 1); });
  // Zoom: click/Enter toggles 2x, pointer position sets the focal point.
  const zimg = () => qs('img', main);
  main.addEventListener('click', (e) => {
    main.classList.toggle('zoomed');
    if (main.classList.contains('zoomed')) {
      const im = zimg();
      im.srcset = '';
      im.src = p.images[idx].url;
      move(e);
    }
  });
  const move = (e) => {
    if (!main.classList.contains('zoomed')) return;
    const r = main.getBoundingClientRect();
    zimg().style.setProperty('transform-origin', `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };
  main.addEventListener('mousemove', move);
  main.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') main.classList.toggle('zoomed');
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
}

function setJsonLd(p) {
  // Structured data for SEO. Inline <script> is blocked by CSP, so this is injected via DOM as data (not executed).
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.shortDescription || p.description,
    image: p.images.map((i) => new URL(i.url, location.origin).href),
    sku: p.variants[0]?.sku,
    offers: { '@type': 'AggregateOffer', priceCurrency: 'QAR', lowPrice: (p.price / 100).toFixed(2), availability: p.stockStatus === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' },
    ...(p.rating.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.average, reviewCount: p.rating.count } } : {}),
  });
  document.head.append(s);
}

async function loadReviews(p) {
  const box = qs('#reviews-list');
  const { reviews, total } = await api(`/products/${encodeURIComponent(slug)}/reviews`);
  box.innerHTML = reviews.length
    ? reviews.map((r) => html`<article class="review-card"><div class="stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</div>${raw(r.title ? html`<h3>${r.title}</h3>` : '')}<p>${r.body}</p><footer>${r.user.name}${r.verified ? ' · Verified purchase' : ''} · ${new Date(r.createdAt).toLocaleDateString()}</footer></article>`).join('')
    : '<p class="muted">No reviews yet — be the first to share your thoughts.</p>';
  qs('#reviews-count').textContent = total ? `(${total})` : '';
  qs('#write-review').addEventListener('click', () => {
    if (!state.user) return (location.href = `/login?next=${encodeURIComponent(location.pathname)}`);
    const dlg = modal(html`<h2>Review ${p.name}</h2>
      <form id="review-form">
        <div class="field"><label for="rv-rating">Rating</label><select id="rv-rating" name="rating">${[5, 4, 3, 2, 1].map((n) => raw(html`<option value="${n}">${stars(n)} (${n})</option>`))}</select></div>
        <div class="field"><label for="rv-title">Title (optional)</label><input id="rv-title" name="title" maxlength="120"></div>
        <div class="field"><label for="rv-body">Your review</label><textarea id="rv-body" name="body" minlength="10" maxlength="2000" required></textarea></div>
        <button class="btn">Submit review</button>
      </form>`, { label: 'Write a review' });
    qs('#review-form', dlg).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const r = await api(`/products/${encodeURIComponent(slug)}/reviews`, { method: 'POST', body: { rating: Number(f.rating.value), title: f.title.value || undefined, body: f.body.value } });
        toast(r.message);
        dlg.close();
      } catch (err) {
        toast(err.details ? Object.values(err.details).flat().join(' ') || err.message : err.message, { error: true });
      }
    });
  });
}

async function main() {
  await init();
  const { product: p } = await api(`/products/${encodeURIComponent(slug)}`);
  setTitle(p.name);
  setMeta(p.shortDescription || p.description.slice(0, 160));
  setJsonLd(p);
  const dispatchText = p.dispatch.madeToOrder
    ? `Made to order — dispatched in ${p.dispatch.minDays}–${p.dispatch.maxDays} days`
    : `Ready to ship — dispatched in ${p.dispatch.minDays}–${p.dispatch.maxDays} working days`;

  qs('#main').innerHTML = html`
    <div class="container page-head">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a>${raw(p.category ? html` / <a href="/shop?category=${p.category.slug}">${p.category.name}</a>` : '')} / ${p.name}</nav>
    </div>
    <div class="container pdp">
      ${raw(p.images.length ? galleryHtml(p) : '<div class="gallery-main"></div>')}
      <div class="pdp-info">
        <span class="eyebrow">${p.category?.name ?? ''}</span>
        <h1>${p.name}</h1>
        ${raw(p.rating.count ? html`<a class="rating-summary" href="#reviews"><span class="stars">${stars(p.rating.average)}</span> ${p.rating.average} · ${p.rating.count} review${p.rating.count > 1 ? 's' : ''}</a>` : '')}
        <div class="price pdp-price" data-price>${fmt(p.price)}${raw(p.compareAtPrice ? html`<s>${fmt(p.compareAtPrice)}</s>` : '')}</div>
        <p>${p.shortDescription ?? ''}</p>
        <div data-picker></div>
        ${raw(p.isPersonalizable ? html`<div class="field"><label for="pers">${p.personalizationLabel || 'Personalisation'} <span class="muted">(optional)</span></label><input id="pers" maxlength="60" autocomplete="off"></div>` : '')}
        <div class="option-group">
          <span class="label">Quantity</span>
          <div class="buy-row">
            <div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity">−</button><input id="qty" type="number" min="1" max="20" value="1" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase quantity">+</button></div>
            <span class="stock" data-stock></span>
          </div>
        </div>
        <div class="buy-row">
          <button class="btn" data-add disabled>Select options</button>
          <button class="btn btn--rose" data-buy disabled>Buy now</button>
          <button class="icon-btn" data-fav aria-label="Save to wishlist" aria-pressed="${state.wishlist.has(p.id)}">${raw(icons.heart)}</button>
        </div>
        <div class="dispatch">${raw(icons.truck)}<span>${dispatchText}</span></div>
        <div class="info-list">
          <details open><summary>Description</summary><div class="content">${p.description}</div></details>
          ${raw(p.materials ? html`<details><summary>Materials</summary><div class="content">${p.materials}</div></details>` : '')}
          ${raw(p.careInstructions ? html`<details><summary>Care instructions</summary><div class="content">${p.careInstructions}</div></details>` : '')}
          ${raw(p.ageRange ? html`<details><summary>Recommended age</summary><div class="content">${p.ageRange}</div></details>` : '')}
          ${raw(p.dimensionsCm ? html`<details><summary>Dimensions</summary><div class="content">${p.dimensionsCm}</div></details>` : '')}
          <details><summary>Shipping &amp; returns</summary><div class="content">Delivery across Qatar. See our <a href="/shipping-policy">shipping</a> and <a href="/return-policy">return</a> policies.</div></details>
        </div>
      </div>
    </div>
    <section class="section" id="reviews">
      <div class="container">
        <div class="section-head"><h2>Reviews <span class="muted" id="reviews-count"></span></h2><button class="btn btn--ghost btn--sm" id="write-review">Write a review</button></div>
        <div class="reviews-grid" id="reviews-list"></div>
      </div>
    </section>
    <section class="section section--tint" id="related-wrap" hidden>
      <div class="container"><div class="section-head"><h2>You may also like</h2></div><div class="product-grid" id="related"></div></div>
    </section>`;

  if (p.images.length) wireGallery(p);

  let variant = null;
  const addBtn = qs('[data-add]');
  const buyBtn = qs('[data-buy]');
  const qtyEl = qs('#qty');
  variantPicker(qs('[data-picker]'), p, (v) => {
    variant = v;
    qs('[data-price]').textContent = fmt(v?.price ?? p.price);
    const st = qs('[data-stock]');
    st.className = `stock stock--${v?.stockStatus ?? ''}`;
    st.textContent = v ? `${stockLabel[v.stockStatus]}${v.stockStatus === 'low' ? ` (${v.stock})` : ''}` : '';
    const ok = v && v.stock > 0;
    addBtn.disabled = buyBtn.disabled = !ok;
    addBtn.textContent = !v ? 'Select options' : ok ? 'Add to cart' : 'Out of stock';
    if (v) qtyEl.max = Math.min(20, Math.max(1, v.stock));
  });
  qsa('[data-q]').forEach((b) => b.addEventListener('click', () => {
    qtyEl.value = Math.min(Number(qtyEl.max), Math.max(1, Number(qtyEl.value) + Number(b.dataset.q)));
  }));
  const add = () => addToCart(variant.id, Math.max(1, Math.min(Number(qtyEl.value) || 1, 20)), qs('#pers')?.value.trim() ?? '');
  addBtn.addEventListener('click', add);
  buyBtn.addEventListener('click', async () => { if (await add()) location.href = '/checkout'; });
  qs('[data-fav]').addEventListener('click', (e) => toggleWishlist(p.id, e.currentTarget));
  document.addEventListener('wishlist:loaded', () => qs('[data-fav]').setAttribute('aria-pressed', String(state.wishlist.has(p.id))));

  loadReviews(p).catch(console.error);
  api(`/products/${encodeURIComponent(slug)}/related`).then(({ items }) => {
    if (!items.length) return;
    qs('#related').innerHTML = items.map(productCard).join('');
    qs('#related-wrap').hidden = false;
    wireCards(qs('#related'), items);
    revealOnScroll();
  });
}

main().catch((e) => (e.status === 404 ? (location.href = '/404') : fail(e)));
