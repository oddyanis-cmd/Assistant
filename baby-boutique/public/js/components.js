// Reusable storefront components: product cards, quick view, size guide.
import { api } from './api.js';
import { html, raw, fmt, img, stockLabel, qs, esc } from './util.js';
import { icons } from './icons.js';
import { state, toggleWishlist, addToCart } from './layout.js';

export function productCard(p) {
  const sale = p.compareAtPrice && p.compareAtPrice > p.price;
  const soldOut = p.stockStatus === 'out_of_stock';
  return html`
  <article class="card reveal" data-product-id="${p.id}" data-slug="${p.slug}">
    <div class="card-media">
      ${raw(p.image ? img(p.image, { alt: p.name }) : '')}
      ${raw(p.hoverImage ? img(p.hoverImage, { alt: '', cls: 'hover' }) : '')}
      <div class="card-tags">
        ${raw(p.isNew ? '<span class="tag tag--new">New</span>' : '')}
        ${raw(sale ? '<span class="tag tag--sale">Sale</span>' : '')}
        ${raw(p.isPersonalizable ? '<span class="tag">Personalise</span>' : '')}
      </div>
      <button class="icon-btn card-fav" data-action="fav" aria-label="Save ${p.name} to wishlist" aria-pressed="${state.wishlist.has(p.id)}">${raw(icons.heart)}</button>
      <div class="card-quick"><button class="btn btn--light btn--sm btn--block" data-action="quick">${raw(icons.eye)} Quick view</button></div>
    </div>
    <div class="card-body">
      <span class="card-meta">${p.category?.name ?? ''}</span>
      <h3 class="card-title"><a href="${p.url}">${p.name}</a></h3>
      ${raw(p.sizes.length ? html`<span class="card-meta">${p.sizes.length > 3 ? `${p.sizes[0]} – ${p.sizes[p.sizes.length - 1]}` : p.sizes.join(' · ')}</span>` : '')}
      <div class="card-foot">
        <div>
          <div class="price">${p.priceVaries ? 'From ' : ''}${fmt(p.price)}${raw(sale ? html`<s>${fmt(p.compareAtPrice)}</s>` : '')}</div>
          <span class="stock stock--${p.stockStatus}">${stockLabel[p.stockStatus]}</span>
        </div>
        <button class="btn btn--rose btn--sm" data-action="add" ${raw(soldOut ? 'disabled' : '')} aria-label="Add ${p.name} to cart">${soldOut ? 'Sold out' : 'Add'}</button>
      </div>
    </div>
  </article>`;
}

/** Event delegation for every card inside `root`. `items` is the array the cards were rendered from. */
export function wireCards(root, items) {
  const byId = new Map(items.map((p) => [p.id, p]));
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('[data-product-id]');
    const p = byId.get(card?.dataset.productId);
    if (!p) return;
    e.preventDefault();
    if (btn.dataset.action === 'fav') toggleWishlist(p.id, btn);
    if (btn.dataset.action === 'quick') quickView(p.slug);
    if (btn.dataset.action === 'add') {
      // Single-variant products go straight to the cart; otherwise the customer must pick options.
      if (p.defaultVariantId && !p.isPersonalizable) addToCart(p.defaultVariantId);
      else quickView(p.slug);
    }
  });
  document.addEventListener('wishlist:loaded', () => {
    root.querySelectorAll('[data-action="fav"]').forEach((b) => b.setAttribute('aria-pressed', String(state.wishlist.has(b.closest('[data-product-id]').dataset.productId))));
  });
}

export function modal(contentHtml, { label = 'Dialog' } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.setAttribute('aria-label', label);
  dlg.innerHTML = html`<div class="modal-inner"><button class="icon-btn modal-close" aria-label="Close">${raw(icons.close)}</button>${raw(contentHtml)}</div>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  qs('.modal-close', dlg).addEventListener('click', () => dlg.close());
  dlg.showModal();
  return dlg;
}

export function sizeGuideHtml(guide, dimensionsCm) {
  if (!guide) return html`<h2>Dimensions</h2><p>${dimensionsCm || 'Measurements are listed in the product details.'}</p>`;
  return html`
    <h2>${guide.name}</h2>
    <div class="table-scroll"><table class="size-table">
      <thead><tr>${guide.columns.map((c) => raw(html`<th scope="col">${c}${/height|chest|length|width|cm/i.test(c) ? ' (cm)' : ''}</th>`))}</tr></thead>
      <tbody>${guide.rows.map((r) => raw(html`<tr>${r.map((c, i) => raw(i === 0 ? html`<th scope="row">${c}</th>` : html`<td>${c}</td>`))}</tr>`))}</tbody>
    </table></div>
    ${raw(guide.notes ? html`<p class="muted mt">${guide.notes}</p>` : '')}`;
}

/** Shared option picker used on the product page and in the quick view. */
export function variantPicker(root, product, onChange) {
  const sel = { size: null, color: null };
  const sizes = product.sizes;
  const colors = [...new Map(product.variants.filter((v) => v.color).map((v) => [v.color, v.colorHex])).entries()];
  if (sizes.length === 1) sel.size = sizes[0];
  if (colors.length === 1) sel.color = colors[0][0];

  const find = (size, color) => product.variants.find((v) => (sizes.length ? v.size === size : true) && (colors.length ? v.color === color : true));
  const available = (size, color) => product.variants.some((v) => (!size || v.size === size) && (!color || v.color === color) && (v.stock > 0 || v.stockStatus === 'made_to_order'));

  function render() {
    root.innerHTML = html`
      ${raw(colors.length ? html`<div class="option-group"><div class="label-row"><span class="label">Colour${sel.color ? `: ${sel.color}` : ''}</span></div>
        <div class="chips" role="group" aria-label="Colour">${colors.map(([c, hex]) => raw(html`<button type="button" class="opt-btn" data-color="${c}" aria-pressed="${sel.color === c}" ${raw(available(sel.size, c) ? '' : 'disabled')}><span class="swatch" data-hex="${hex || ''}"></span>${c}</button>`))}</div></div>` : '')}
      ${raw(sizes.length ? html`<div class="option-group"><div class="label-row"><span class="label">Size${sel.size ? `: ${sel.size}` : ''}</span><button type="button" class="link-btn" data-size-guide>Size guide</button></div>
        <div class="chips" role="group" aria-label="Size">${sizes.map((s) => raw(html`<button type="button" class="opt-btn" data-size="${s}" aria-pressed="${sel.size === s}" ${raw(available(s, sel.color) ? '' : 'disabled')}>${s}</button>`))}</div></div>`
        : product.dimensionsCm ? html`<div class="option-group"><span class="label">Dimensions</span><p>${product.dimensionsCm}</p></div>` : '')}`;
    root.querySelectorAll('.swatch[data-hex]').forEach((el) => el.dataset.hex && el.style.setProperty('background', el.dataset.hex));
    onChange(find(sel.size, sel.color) ?? null, sel);
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.size) sel.size = b.dataset.size;
    else if (b.dataset.color) sel.color = b.dataset.color;
    else if (b.hasAttribute('data-size-guide')) return modal(sizeGuideHtml(product.sizeGuide, product.dimensionsCm), { label: 'Size guide' });
    else return;
    render();
  });
  render();
  return sel;
}

export async function quickView(slug) {
  const dlg = modal('<div class="skeleton skeleton-qv"></div>', { label: 'Quick view' });
  try {
    const { product: p } = await api(`/products/${encodeURIComponent(slug)}`);
    const inner = qs('.modal-inner', dlg);
    inner.insertAdjacentHTML('beforeend', html`
      <div class="quickview">
        <div>${raw(img(p.images[0], { alt: p.name, eager: true }))}</div>
        <div>
          <h2>${p.name}</h2>
          <div class="price pdp-price" data-price>${fmt(p.price)}</div>
          <p>${p.shortDescription ?? ''}</p>
          <div data-picker></div>
          ${raw(p.isPersonalizable ? html`<div class="field"><label for="qv-pers">${p.personalizationLabel || 'Personalisation'} (optional)</label><input id="qv-pers" maxlength="60"></div>` : '')}
          <p class="stock" data-stock></p>
          <div class="buy-row"><button class="btn" data-add disabled>Select options</button></div>
          <a class="link-btn" href="${p.url}">View full details →</a>
        </div>
      </div>`);
    qs('.skeleton', inner).remove();
    let variant = null;
    const addBtn = qs('[data-add]', inner);
    variantPicker(qs('[data-picker]', inner), p, (v) => {
      variant = v;
      qs('[data-price]', inner).textContent = fmt(v?.price ?? p.price);
      const st = qs('[data-stock]', inner);
      st.className = `stock stock--${v?.stockStatus ?? ''}`;
      st.textContent = v ? stockLabel[v.stockStatus] : '';
      const buyable = v && v.stock > 0;
      addBtn.disabled = !buyable;
      addBtn.textContent = !v ? 'Select options' : buyable ? 'Add to cart' : 'Out of stock';
    });
    addBtn.addEventListener('click', async () => {
      if (await addToCart(variant.id, 1, qs('#qv-pers', inner)?.value.trim() ?? '')) dlg.close();
    });
  } catch (e) {
    qs('.modal-inner', dlg).insertAdjacentHTML('beforeend', `<p>${esc(e.message)}</p>`);
  }
}
