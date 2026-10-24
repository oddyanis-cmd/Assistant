// Admin dashboard: a small hash-routed SPA over /api/admin. No build step.
import { api, upload } from '/js/api.js';
import { html, raw, esc, fmt, qs, qsa, toast, debounce } from '/js/util.js';

let me = null;
const view = () => qs('#view');
/** Swap #view for an empty clone so a re-rendering view never stacks duplicate listeners. */
function resetView() {
  const fresh = view().cloneNode(false);
  view().replaceWith(fresh);
  return fresh;
}
const isAdmin = () => me?.role === 'ADMIN';
const errText = (e) => (e.details ? Object.entries(e.details).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`).join(' · ') : e.message);
const toMajor = (minor) => (minor == null ? '' : (minor / 100).toFixed(2));
const date = (d) => new Date(d).toLocaleString();

function applyHeights(root = view()) {
  qsa('[data-h]', root).forEach((el) => el.style.setProperty('height', `${el.dataset.h}%`));
  qsa('[data-w]', root).forEach((el) => el.style.setProperty('width', `${el.dataset.w}%`));
}

function pager(page, totalPages, onGo) {
  if (totalPages <= 1) return '';
  const id = `pg-${Math.random().toString(36).slice(2)}`;
  setTimeout(() => qsa(`#${id} button`).forEach((b) => b.addEventListener('click', () => onGo(Number(b.dataset.page)))));
  return html`<nav class="pagination" id="${id}">${Array.from({ length: totalPages }, (_, i) => raw(html`<button data-page="${i + 1}" ${raw(i + 1 === page ? 'aria-current="page"' : '')}>${i + 1}</button>`))}</nav>`;
}

// ============================ Dashboard ============================
async function dashboard() {
  const d = await api('/admin/dashboard?days=30');
  const maxRev = Math.max(1, ...d.daily.map((x) => x.revenue));
  view().innerHTML = html`
    <div class="view-head"><h1>Dashboard</h1><span class="muted">Last ${d.periodDays} days</span></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Revenue</div><div class="v">${fmt(d.revenue.total)}</div></div>
      <div class="kpi"><div class="l">Orders</div><div class="v">${d.revenue.orders}</div></div>
      <div class="kpi"><div class="l">Avg. order</div><div class="v">${fmt(d.revenue.averageOrderValue)}</div></div>
      <div class="kpi"><div class="l">Today</div><div class="v">${fmt(d.today.revenue)}</div><span class="muted">${d.today.orders} orders</span></div>
      <div class="kpi"><div class="l">To fulfil</div><div class="v"><a href="#/orders?status=PAID">${d.toFulfil}</a></div></div>
      <div class="kpi"><div class="l">Conversion</div><div class="v">${d.funnel.conversionRate}%</div></div>
      <div class="kpi"><div class="l">New customers</div><div class="v">${d.newCustomers}</div></div>
      <div class="kpi"><div class="l">Pending reviews</div><div class="v"><a href="#/reviews">${d.pendingReviews}</a></div></div>
    </div>
    <div class="grid-2">
      <section class="panel"><h2>Revenue by day</h2>
        ${raw(d.daily.length ? html`<div class="bars">${d.daily.map((x) => raw(html`<div data-h="${Math.round((x.revenue / maxRev) * 100)}" title="${x.day}: ${fmt(x.revenue)} (${x.orders} orders)"></div>`))}</div>` : '<p class="muted">No paid orders in this period yet.</p>')}
      </section>
      <section class="panel funnel"><h2>Funnel</h2>
        <div><span>Visitors</span><strong>${d.funnel.visitors}</strong></div>
        <div><span>Product views</span><strong>${d.funnel.productViews}</strong></div>
        <div><span>Add to cart</span><strong>${d.funnel.addToCart}</strong></div>
        <div><span>Checkouts started</span><strong>${d.funnel.checkoutStart}</strong></div>
        <div><span>Purchases</span><strong>${d.funnel.purchases}</strong></div>
      </section>
      <section class="panel"><h2>Top products</h2>
        ${raw(d.topProducts.length ? html`<table class="data"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>${d.topProducts.map((t) => raw(html`<tr><td>${t.name}</td><td>${t.units}</td><td>${fmt(t.revenue)}</td></tr>`))}</tbody></table>` : '<p class="muted">No sales yet.</p>')}
      </section>
      <section class="panel"><h2>Low stock</h2>
        ${raw(d.lowStock.length ? html`<table class="data"><thead><tr><th>Item</th><th>SKU</th><th>Stock</th></tr></thead><tbody>${d.lowStock.map((v) => raw(html`<tr><td><a href="#/products/${v.productId}">${v.name}</a> <span class="muted">${[v.size, v.color].filter(Boolean).join(' · ')}</span></td><td>${v.sku}</td><td class="${v.stock === 0 ? 'danger-text' : ''}">${v.stock}</td></tr>`))}</tbody></table>` : '<p class="muted">All good — nothing is running low.</p>')}
      </section>
    </div>`;
  applyHeights();
}

// ============================ Products ============================
async function products(query = {}) {
  const p = new URLSearchParams({ page: query.page ?? 1, ...(query.q && { q: query.q }), ...(query.status && { status: query.status }) });
  const r = await api(`/admin/products?${p}`);
  view().innerHTML = html`
    <div class="view-head"><h1>Products</h1><a class="btn" href="#/products/new">+ New product</a></div>
    <div class="toolbar">
      <input type="search" id="pq" placeholder="Search name or SKU" value="${query.q ?? ''}">
      <select id="pstatus"><option value="">All statuses</option>${['PUBLISHED', 'DRAFT', 'ARCHIVED'].map((s) => raw(html`<option ${raw(query.status === s ? 'selected' : '')}>${s}</option>`))}</select>
      <span class="muted">${r.total} products</span>
    </div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th></th><th>Name</th><th>Status</th><th>Category</th><th>Price</th><th>Stock</th><th>Images</th><th>Sold</th></tr></thead>
      <tbody>${r.items.map((x) => raw(html`<tr>
        <td>${raw(x.thumbUrl ? html`<img src="${x.thumbUrl}" alt="">` : '')}</td>
        <td><a href="#/products/${x.id}"><strong>${x.name}</strong></a>${raw(x.isFeatured ? ' <span class="tag">Featured</span>' : '')}</td>
        <td><span class="status status--${x.status === 'PUBLISHED' ? 'PAID' : x.status === 'ARCHIVED' ? 'CANCELLED' : ''}">${x.status}</span></td>
        <td>${x.category ?? '—'}</td><td>${fmt(x.basePrice)}</td>
        <td class="${x.stock === 0 ? 'danger-text' : ''}">${x.stock} <span class="muted">(${x.variantCount} var.)</span></td>
        <td>${x.imageCount}</td><td>${x.salesCount}</td></tr>`))}</tbody>
    </table></div>
    ${raw(pager(r.page, r.totalPages, (page) => products({ ...query, page })))}`;
  qs('#pq').addEventListener('input', debounce((e) => products({ ...query, q: e.target.value, page: 1 }), 400));
  qs('#pstatus').addEventListener('change', (e) => products({ ...query, status: e.target.value, page: 1 }));
}

async function productEdit(id) {
  const [{ categories }, { sizeGuides }, data] = await Promise.all([
    api('/admin/categories'),
    api('/admin/size-guides'),
    id === 'new' ? Promise.resolve({ product: null }) : api(`/admin/products/${id}`),
  ]);
  const p = data.product ?? { status: 'DRAFT', type: 'CLOTHING', dispatchMinDays: 2, dispatchMaxDays: 5, tags: [], variants: [] };
  const opt = (list, val, label = (x) => x.name) => list.map((x) => raw(html`<option value="${x.id}" ${raw(val === x.id ? 'selected' : '')}>${label(x)}</option>`));
  const chk = (name, label) => raw(html`<label class="checkbox"><input type="checkbox" name="${name}" ${raw(p[name] ? 'checked' : '')}> <span>${label}</span></label>`);

  view().innerHTML = html`
    <div class="view-head"><h1>${p.name ?? 'New product'}</h1>
      <div class="buy-row">${raw(p.slug && p.status === 'PUBLISHED' ? html`<a class="btn btn--ghost btn--sm" href="/product/${p.slug}" target="_blank">View ↗</a>` : '')}
      ${raw(p.id ? '<button class="btn btn--danger btn--sm" id="del">Delete</button>' : '')}</div></div>
    <form id="pform" class="panel" novalidate>
      <div class="form-grid">
        <div class="field"><label>Name</label><input name="name" required value="${p.name ?? ''}"></div>
        <div class="field"><label>URL slug <span class="muted">(auto if empty)</span></label><input name="slug" value="${p.slug ?? ''}"></div>
        <div class="field"><label>Status</label><select name="status">${['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((s) => raw(html`<option ${raw(p.status === s ? 'selected' : '')}>${s}</option>`))}</select></div>
        <div class="field"><label>Type</label><select name="type">${['CLOTHING', 'SHOES', 'ACCESSORY', 'DOLL', 'GIFT_SET'].map((s) => raw(html`<option ${raw(p.type === s ? 'selected' : '')}>${s}</option>`))}</select></div>
        <div class="field"><label>Price (QAR)</label><input name="basePrice" type="number" step="0.01" min="0" required value="${toMajor(p.basePrice)}"></div>
        <div class="field"><label>Compare-at price (QAR, optional)</label><input name="compareAtPrice" type="number" step="0.01" min="0" value="${toMajor(p.compareAtPrice)}"></div>
        <div class="field"><label>Category</label><select name="categoryId"><option value="">—</option>${opt(categories, p.categoryId)}</select></div>
        <div class="field"><label>Size guide</label><select name="sizeGuideId"><option value="">— none (e.g. dolls) —</option>${opt(sizeGuides, p.sizeGuideId)}</select></div>
      </div>
      <div class="field"><label>Short description</label><input name="shortDescription" maxlength="300" value="${p.shortDescription ?? ''}"></div>
      <div class="field"><label>Description</label><textarea name="description" rows="6">${p.description ?? ''}</textarea></div>
      <div class="form-grid">
        <div class="field"><label>Materials</label><textarea name="materials">${p.materials ?? ''}</textarea></div>
        <div class="field"><label>Care instructions</label><textarea name="careInstructions">${p.careInstructions ?? ''}</textarea></div>
        <div class="field"><label>Recommended age</label><input name="ageRange" value="${p.ageRange ?? ''}"></div>
        <div class="field"><label>Dimensions (cm) — for dolls/toys</label><input name="dimensionsCm" value="${p.dimensionsCm ?? ''}"></div>
        <div class="field"><label>Dispatch min days</label><input name="dispatchMinDays" type="number" min="0" value="${p.dispatchMinDays}"></div>
        <div class="field"><label>Dispatch max days</label><input name="dispatchMaxDays" type="number" min="0" value="${p.dispatchMaxDays}"></div>
        <div class="field"><label>Tags (comma separated)</label><input name="tags" value="${p.tags.join(', ')}"></div>
        <div class="field"><label>Personalisation label</label><input name="personalizationLabel" value="${p.personalizationLabel ?? ''}" placeholder="e.g. Name to embroider"></div>
      </div>
      <div class="buy-row">${chk('isFeatured', 'Featured (Best Sellers)')}${chk('madeToOrder', 'Made to order')}${chk('isPersonalizable', 'Personalisable')}</div>
      <p class="form-error" id="perr"></p>
      <button class="btn">${p.id ? 'Save changes' : 'Create product'}</button>
    </form>
    ${raw(p.id ? '<section class="panel" id="variants"></section><section class="panel" id="images"></section>' : '<p class="muted">Save the product to add variants and photos.</p>')}`;

  qs('#pform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const val = (n) => f[n].value.trim();
    const body = {
      name: val('name'), slug: val('slug') || undefined, status: val('status'), type: val('type'),
      basePrice: Number(val('basePrice')), compareAtPrice: val('compareAtPrice') ? Number(val('compareAtPrice')) : null,
      categoryId: val('categoryId') || null, sizeGuideId: val('sizeGuideId') || null,
      shortDescription: val('shortDescription') || null, description: f.description.value,
      materials: val('materials') || null, careInstructions: val('careInstructions') || null,
      ageRange: val('ageRange') || null, dimensionsCm: val('dimensionsCm') || null,
      dispatchMinDays: Number(val('dispatchMinDays')), dispatchMaxDays: Number(val('dispatchMaxDays')),
      tags: val('tags').split(',').map((t) => t.trim()).filter(Boolean),
      personalizationLabel: val('personalizationLabel') || null,
      isFeatured: f.isFeatured.checked, madeToOrder: f.madeToOrder.checked, isPersonalizable: f.isPersonalizable.checked,
    };
    try {
      const r = p.id ? await api(`/admin/products/${p.id}`, { method: 'PATCH', body }) : await api('/admin/products', { method: 'POST', body });
      toast('Saved');
      if (!p.id) location.hash = `#/products/${r.product.id}`;
      else qs('.view-head h1').textContent = r.product.name;
    } catch (ex) {
      qs('#perr').textContent = errText(ex);
    }
  });
  qs('#del')?.addEventListener('click', async () => {
    if (!confirm('Delete this product? Products with orders are archived instead.')) return;
    const r = await api(`/admin/products/${p.id}`, { method: 'DELETE' });
    toast(r.archived ? 'Product archived (it has order history)' : 'Product deleted');
    location.hash = '#/products';
  });
  if (p.id) {
    renderVariants(p);
    renderImages(p.id, 1);
  }
}

function renderVariants(p) {
  const box = qs('#variants');
  box.innerHTML = html`
    <h2>Variants <span class="muted">(${p.variants.length})</span></h2>
    <p class="muted">Each size × colour combination has its own SKU, price and stock. Stock changes are recorded in the inventory ledger.</p>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>SKU</th><th>Size</th><th>Colour</th><th>Hex</th><th>Price override</th><th>Stock</th><th>Low at</th><th>Active</th><th></th></tr></thead>
      <tbody>${p.variants.map((v) => raw(html`<tr data-v="${v.id}">
        <td><input name="sku" value="${v.sku}"></td><td><input name="size" value="${v.size ?? ''}"></td>
        <td><input name="color" value="${v.color ?? ''}"></td><td><input name="colorHex" value="${v.colorHex ?? ''}" placeholder="#RRGGBB" size="8"></td>
        <td><input name="price" type="number" step="0.01" value="${toMajor(v.price)}" placeholder="${toMajor(p.basePrice)}"></td>
        <td><strong class="${v.stock === 0 ? 'danger-text' : ''}">${v.stock}</strong> <button class="link-btn" data-adjust>Adjust</button></td>
        <td><input name="lowStockThreshold" type="number" min="0" value="${v.lowStockThreshold}" size="3"></td>
        <td><input name="isActive" type="checkbox" ${raw(v.isActive ? 'checked' : '')}></td>
        <td><button class="btn btn--sm" data-save>Save</button> <button class="link-btn danger-text" data-remove>✕</button></td></tr>`))}</tbody>
    </table></div>
    <details class="mt"><summary class="label">Generate size × colour combinations</summary>
      <form id="gen" class="mt">
        <div class="form-grid">
          <div class="field"><label>Sizes (comma separated)</label><input name="sizes" placeholder="Newborn, 0–3 months, 3–6 months"></div>
          <div class="field"><label>Colours (Name:#hex, comma separated)</label><input name="colors" placeholder="Ivory:#F5EFE6, Sage:#A8B8A0"></div>
          <div class="field"><label>Initial stock each</label><input name="stock" type="number" min="0" value="0"></div>
          <div class="field"><label>SKU prefix (optional)</label><input name="skuPrefix"></div>
        </div>
        <button class="btn btn--sm">Generate</button>
      </form>
    </details>`;

  const reload = async () => { const r = await api(`/admin/products/${p.id}`); renderVariants(r.product); };
  box.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-v]');
    if (!row) return;
    const vid = row.dataset.v;
    const field = (n) => qs(`[name="${n}"]`, row);
    try {
      if (e.target.matches('[data-save]')) {
        await api(`/admin/variants/${vid}`, {
          method: 'PATCH',
          body: {
            sku: field('sku').value.trim(), size: field('size').value.trim() || null, color: field('color').value.trim() || null,
            colorHex: field('colorHex').value.trim() || null, price: field('price').value ? Number(field('price').value) : null,
            lowStockThreshold: Number(field('lowStockThreshold').value), isActive: field('isActive').checked,
          },
        });
        toast('Variant saved');
      }
      if (e.target.matches('[data-adjust]')) {
        const delta = Number(prompt('Stock change (e.g. 5 to add, -2 to remove):'));
        if (!delta) return;
        const reason = delta > 0 ? 'restock' : 'adjustment';
        await api(`/admin/variants/${vid}/adjust`, { method: 'POST', body: { delta, reason, note: prompt('Note (optional):') || undefined } });
        toast('Stock updated');
        reload();
      }
      if (e.target.matches('[data-remove]') && confirm('Remove this variant? Variants with orders are deactivated instead.')) {
        await api(`/admin/variants/${vid}`, { method: 'DELETE' });
        reload();
      }
    } catch (ex) {
      toast(errText(ex), { error: true });
    }
  });
  qs('#gen', box).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const colors = f.colors.value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [name, hex] = s.split(':').map((x) => x.trim());
      return hex ? { name, hex } : { name };
    });
    try {
      const r = await api(`/admin/products/${p.id}/variants/generate`, {
        method: 'POST',
        body: { sizes: f.sizes.value.split(',').map((s) => s.trim()).filter(Boolean), colors, stock: Number(f.stock.value), skuPrefix: f.skuPrefix.value.trim() || undefined },
      });
      toast(`${r.created.length} variant(s) created`);
      reload();
    } catch (ex) {
      toast(errText(ex), { error: true });
    }
  });
}

async function renderImages(productId, page) {
  const [r, usage] = await Promise.all([api(`/admin/products/${productId}/images?page=${page}`), api('/admin/media/usage')]);
  const box = qs('#images');
  if (!box) return;
  const pct = Math.min(100, usage.percent);
  box.innerHTML = html`
    <div class="view-head"><h2>Photos <span class="muted">(${r.total})</span></h2>
      <div class="muted">Storage: ${(usage.usedBytes / 1048576).toFixed(1)} MB of ${(usage.quotaBytes / 1048576).toFixed(0)} MB (${usage.percent}%) · ${usage.provider}</div></div>
    <div class="meter ${pct > 90 ? 'danger' : pct > 75 ? 'warn' : ''}"><div data-w="${pct}"></div></div>
    <label class="dropzone mt" id="drop">
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden id="file">
      <strong>Drop photos here or click to choose</strong><br><span class="muted">JPEG, PNG, WebP or AVIF. Thumbnails are generated automatically and location metadata is removed.</span>
    </label>
    <div id="uploads"></div>
    <p class="muted">Drag photos to reorder. The featured photo is shown first on cards and the product page.</p>
    <div class="img-grid" id="imgs">${r.images.map((im) => raw(html`
      <div class="img-tile ${im.isFeatured ? 'featured' : ''}" draggable="true" data-img="${im.id}">
        <img src="${im.thumbUrl}" alt="${im.alt ?? ''}" loading="lazy">
        <div class="actions">${raw(im.isFeatured ? '<strong>★ Featured</strong>' : '<button class="link-btn" data-feature>Set featured</button>')}
          <button class="link-btn" data-alt>Alt</button><button class="link-btn danger-text" data-del>Delete</button></div>
      </div>`))}</div>
    ${raw(pager(r.page, r.totalPages, (pg) => renderImages(productId, pg)))}`;
  applyHeights(box);

  // ---- Upload with per-file progress (one request per file keeps progress accurate and failures isolated) ----
  const fileInput = qs('#file', box);
  const drop = qs('#drop', box);
  const send = async (files) => {
    const list = qs('#uploads', box);
    for (const file of files) {
      const row = document.createElement('div');
      row.className = 'upload-row';
      row.innerHTML = html`<span>${file.name}</span><progress max="1" value="0"></progress><span data-s>0%</span>`;
      list.append(row);
      const fd = new FormData();
      fd.append('images', file);
      try {
        const res = await upload(`/admin/products/${productId}/images`, fd, (f) => { qs('progress', row).value = f; qs('[data-s]', row).textContent = `${Math.round(f * 100)}%`; });
        const failed = res.results.find((x) => !x.ok);
        qs('[data-s]', row).textContent = failed ? `✕ ${failed.error}` : '✓ processed';
      } catch (ex) {
        qs('[data-s]', row).textContent = `✕ ${ex.message}`;
      }
    }
    renderImages(productId, page);
  };
  fileInput.addEventListener('change', () => send([...fileInput.files]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); send([...e.dataTransfer.files]); });

  // ---- Actions ----
  qs('#imgs', box).addEventListener('click', async (e) => {
    const tile = e.target.closest('[data-img]');
    if (!tile) return;
    const id = tile.dataset.img;
    try {
      if (e.target.matches('[data-feature]')) await api(`/admin/images/${id}`, { method: 'PATCH', body: { isFeatured: true } });
      else if (e.target.matches('[data-alt]')) {
        const alt = prompt('Describe this photo for screen readers and SEO:', qs('img', tile).alt);
        if (alt === null) return;
        await api(`/admin/images/${id}`, { method: 'PATCH', body: { alt } });
      } else if (e.target.matches('[data-del]')) {
        if (!confirm('Delete this photo permanently?')) return;
        await api(`/admin/images/${id}`, { method: 'DELETE' });
      } else return;
      renderImages(productId, page);
    } catch (ex) {
      toast(errText(ex), { error: true });
    }
  });

  // ---- Drag to reorder (within the current page) ----
  let dragged = null;
  const grid = qs('#imgs', box);
  grid.addEventListener('dragstart', (e) => { dragged = e.target.closest('[data-img]'); dragged?.classList.add('dragging'); });
  grid.addEventListener('dragend', () => { dragged?.classList.remove('dragging'); qsa('.drop-target', grid).forEach((x) => x.classList.remove('drop-target')); });
  grid.addEventListener('dragover', (e) => {
    e.preventDefault();
    const over = e.target.closest('[data-img]');
    qsa('.drop-target', grid).forEach((x) => x.classList.remove('drop-target'));
    if (over && over !== dragged) over.classList.add('drop-target');
  });
  grid.addEventListener('drop', async (e) => {
    e.preventDefault();
    const over = e.target.closest('[data-img]');
    if (!dragged || !over || over === dragged) return;
    const tiles = qsa('[data-img]', grid);
    over[tiles.indexOf(dragged) < tiles.indexOf(over) ? 'after' : 'before'](dragged);
    // Positions are global, so fetch the full order and splice this page's new order into it.
    const all = [];
    for (let pg = 1; ; pg++) {
      const res = await api(`/admin/products/${productId}/images?page=${pg}`);
      all.push(...res.images.map((i) => i.id));
      if (pg >= res.totalPages) break;
    }
    const pageIds = qsa('[data-img]', grid).map((t) => t.dataset.img);
    const start = all.indexOf(r.images[0].id);
    all.splice(start, pageIds.length, ...pageIds);
    await api(`/admin/products/${productId}/images/order`, { method: 'PUT', body: { ids: all } });
    toast('Order saved');
  });
}

// ============================ Orders ============================
const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

async function orders(query = {}) {
  const p = new URLSearchParams({ page: query.page ?? 1, ...(query.status && { status: query.status }), ...(query.q && { q: query.q }) });
  const r = await api(`/admin/orders?${p}`);
  view().innerHTML = html`
    <div class="view-head"><h1>Orders</h1></div>
    <div class="pill-tabs">${['', ...ORDER_STATUSES].map((s) => raw(html`<button data-status="${s}" aria-pressed="${(query.status ?? '') === s}">${s ? s.replace('_', ' ') : 'All'}</button>`))}</div>
    <div class="toolbar"><input type="search" id="oq" placeholder="Order number or email" value="${query.q ?? ''}"><span class="muted">${r.total} orders</span></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
      <tbody>${r.orders.map((o) => raw(html`<tr><td><a href="#/orders/${o.id}"><strong>${o.number}</strong></a></td><td>${date(o.createdAt)}</td><td>${o.email}</td><td>${o._count.items}</td><td>${fmt(o.total)}</td><td>${o.paymentProvider ?? '—'}</td><td><span class="status status--${o.status}">${o.status}</span></td></tr>`))}</tbody>
    </table></div>
    ${raw(r.orders.length ? '' : '<div class="empty mt">No orders here yet.</div>')}
    ${raw(pager(r.page, r.totalPages, (page) => orders({ ...query, page })))}`;
  qsa('[data-status]').forEach((b) => b.addEventListener('click', () => orders({ ...query, status: b.dataset.status, page: 1 })));
  qs('#oq').addEventListener('input', debounce((e) => orders({ ...query, q: e.target.value, page: 1 }), 400));
}

async function orderDetail(id) {
  const { order: o, allowedTransitions } = await api(`/admin/orders/${id}`);
  const a = o.shippingAddress;
  view().innerHTML = html`
    <div class="view-head"><h1>Order ${o.number}</h1><span class="status status--${o.status}">${o.status}</span></div>
    ${raw(o.adminNote ? html`<p class="notice notice--warn">${o.adminNote}</p>` : '')}
    <div class="grid-2">
      <section class="panel">
        <h2>Items</h2>
        <table class="data"><tbody>${o.items.map((i) => raw(html`<tr><td>${raw(i.imageUrl ? html`<img src="${i.imageUrl}" alt="">` : '')}</td><td><strong>${i.productName}</strong><br><span class="muted">${i.sku} · ${[i.size, i.color].filter(Boolean).join(' · ')}</span>${raw(i.personalization ? html`<br><strong>Personalise: “${i.personalization}”</strong>` : '')}</td><td>${i.quantity} × ${fmt(i.unitPrice)}</td></tr>`))}</tbody></table>
        <div class="summary mt">
          <div class="row"><span>Subtotal</span><span>${fmt(o.subtotal)}</span></div>
          <div class="row"><span>Delivery</span><span>${fmt(o.shippingFee)}</span></div>
          <div class="row total"><span>Total</span><span>${fmt(o.total)}</span></div>
        </div>
        ${raw(o.customerNote ? html`<h3 class="mt">Customer note</h3><p>${o.customerNote}</p>` : '')}
      </section>
      <section>
        <div class="panel">
          <h2>Customer &amp; delivery</h2>
          <p><strong>${a.fullName}</strong><br>${o.email}<br>${a.phone}<br>${a.line1}${a.line2 ? `, ${a.line2}` : ''}<br>${[a.area, a.city, a.country].filter(Boolean).join(', ')}</p>
          ${raw(o.user ? html`<p class="muted">Registered customer: ${o.user.name}</p>` : '<p class="muted">Guest checkout</p>')}
        </div>
        <form class="panel" id="ostatus">
          <h2>Fulfilment</h2>
          <div class="field"><label>Status</label><select name="status"><option value="">${o.status} (current)</option>${allowedTransitions.map((s) => raw(html`<option>${s}</option>`))}</select></div>
          <div class="field"><label>Tracking number</label><input name="trackingNumber" value="${o.trackingNumber ?? ''}"></div>
          <div class="field"><label>Internal note</label><textarea name="adminNote">${o.adminNote ?? ''}</textarea></div>
          <button class="btn btn--sm">Update order</button>
          ${raw(isAdmin() && o.payments.some((p) => p.status === 'SUCCEEDED') ? '<button type="button" class="btn btn--danger btn--sm" id="refund">Refund…</button>' : '')}
        </form>
        <div class="panel">
          <h2>Payments</h2>
          ${raw(o.payments.length ? html`<table class="data"><tbody>${o.payments.map((p) => raw(html`<tr><td>${p.provider}</td><td>${p.providerRef}</td><td>${fmt(p.amount)}</td><td><span class="status">${p.status}</span></td><td>${date(p.createdAt)}</td></tr>`))}</tbody></table>` : '<p class="muted">No payment attempts.</p>')}
        </div>
      </section>
    </div>`;
  qs('#ostatus').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = { trackingNumber: f.trackingNumber.value.trim() || null, adminNote: f.adminNote.value.trim() || null };
    if (f.status.value) body.status = f.status.value;
    if (body.status === 'CANCELLED' && !confirm('Cancel this order and return its items to stock? If it was paid, refund the customer separately.')) return;
    try {
      await api(`/admin/orders/${o.id}`, { method: 'PATCH', body });
      toast('Order updated');
      orderDetail(id);
    } catch (ex) {
      toast(errText(ex), { error: true });
    }
  });
  qs('#refund')?.addEventListener('click', async () => {
    if (!confirm(`Refund the full ${fmt(o.total)} and return items to stock?`)) return;
    try {
      const r = await api(`/admin/orders/${o.id}/refund`, { method: 'POST', body: { restock: true } });
      toast(r.manualRefundRequired ? 'Marked refunded — send the money back manually for this payment method' : 'Refund issued');
      orderDetail(id);
    } catch (ex) {
      toast(errText(ex), { error: true });
    }
  });
}

// ============================ Inventory ============================
async function inventory(lowOnly = false) {
  const { variants } = await api(`/admin/inventory?lowOnly=${lowOnly}`);
  resetView();
  view().innerHTML = html`
    <div class="view-head"><h1>Inventory</h1>
      <div class="pill-tabs"><button data-low="false" aria-pressed="${!lowOnly}">All</button><button data-low="true" aria-pressed="${lowOnly}">Low stock</button></div></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Product</th><th>SKU</th><th>Size</th><th>Colour</th><th>Stock</th><th>Adjust</th></tr></thead>
      <tbody>${variants.map((v) => raw(html`<tr data-v="${v.id}"><td><a href="#/products/${v.product.id}">${v.product.name}</a></td><td>${v.sku}</td><td>${v.size ?? '—'}</td><td>${v.color ?? '—'}</td>
        <td class="${v.stock <= v.lowStockThreshold ? 'danger-text' : ''}"><strong>${v.stock}</strong></td>
        <td><input type="number" data-delta size="4" placeholder="+/-"> <button class="btn btn--sm" data-apply>Apply</button></td></tr>`))}</tbody>
    </table></div>`;
  qsa('[data-low]').forEach((b) => b.addEventListener('click', () => inventory(b.dataset.low === 'true')));
  view().addEventListener('click', async (e) => {
    if (!e.target.matches('[data-apply]')) return;
    const row = e.target.closest('[data-v]');
    const delta = Number(qs('[data-delta]', row).value);
    if (!delta) return;
    try {
      await api(`/admin/variants/${row.dataset.v}/adjust`, { method: 'POST', body: { delta, reason: delta > 0 ? 'restock' : 'adjustment' } });
      toast('Stock updated');
      inventory(lowOnly);
    } catch (ex) {
      toast(errText(ex), { error: true });
    }
  });
}

// ============================ Categories ============================
async function categoriesView() {
  const { categories } = await api('/admin/categories');
  resetView();
  view().innerHTML = html`
    <div class="view-head"><h1>Categories</h1></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Name</th><th>Slug</th><th>Parent</th><th>Order</th><th>Image URL</th><th>Home</th><th>Active</th><th>Products</th><th></th></tr></thead>
      <tbody>${categories.map((c) => raw(html`<tr data-c="${c.id}">
        <td><input name="name" value="${c.name}"></td><td><input name="slug" value="${c.slug}"></td>
        <td><select name="parentId"><option value="">—</option>${categories.filter((x) => x.id !== c.id).map((x) => raw(html`<option value="${x.id}" ${raw(c.parentId === x.id ? 'selected' : '')}>${x.name}</option>`))}</select></td>
        <td><input name="sortOrder" type="number" value="${c.sortOrder}" size="3"></td><td><input name="imageUrl" value="${c.imageUrl ?? ''}"></td>
        <td><input type="checkbox" name="showOnHome" ${raw(c.showOnHome ? 'checked' : '')}></td><td><input type="checkbox" name="isActive" ${raw(c.isActive ? 'checked' : '')}></td>
        <td>${c._count.products}</td><td><button class="btn btn--sm" data-save>Save</button> <button class="link-btn danger-text" data-del>✕</button></td></tr>`))}</tbody>
    </table></div>
    <form class="panel mt" id="newcat"><h2>New category</h2><div class="toolbar"><input name="name" placeholder="Name" required><input name="description" placeholder="Description"><button class="btn btn--sm">Add</button></div></form>`;
  view().addEventListener('click', async (e) => {
    const row = e.target.closest('[data-c]');
    if (!row) return;
    const f = (n) => qs(`[name="${n}"]`, row);
    try {
      if (e.target.matches('[data-save]')) {
        await api(`/admin/categories/${row.dataset.c}`, { method: 'PATCH', body: { name: f('name').value, slug: f('slug').value, parentId: f('parentId').value || null, sortOrder: Number(f('sortOrder').value), imageUrl: f('imageUrl').value || null, showOnHome: f('showOnHome').checked, isActive: f('isActive').checked } });
        toast('Saved');
      }
      if (e.target.matches('[data-del]') && confirm('Delete this category?')) {
        await api(`/admin/categories/${row.dataset.c}`, { method: 'DELETE' });
        categoriesView();
      }
    } catch (ex) { toast(errText(ex), { error: true }); }
  });
  qs('#newcat').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/admin/categories', { method: 'POST', body: { name: e.target.name.value, description: e.target.description.value || null } }); categoriesView(); } catch (ex) { toast(errText(ex), { error: true }); }
  });
}

// ============================ Size guides ============================
async function sizeGuidesView() {
  const { sizeGuides } = await api('/admin/size-guides');
  resetView();
  const toText = (g) => [g.columns.join(' | '), ...g.rows.map((r) => r.join(' | '))].join('\n');
  view().innerHTML = html`
    <div class="view-head"><h1>Size guides</h1></div>
    <p class="muted">One row per line, columns separated by “|”. The first line is the header. Measurements in centimetres.</p>
    ${sizeGuides.map((g) => raw(html`<form class="panel" data-g="${g.id}">
      <div class="field"><label>Name</label><input name="name" value="${g.name}"></div>
      <div class="field"><label>Table</label><textarea name="table" rows="10">${toText(g)}</textarea></div>
      <div class="field"><label>Notes</label><textarea name="notes">${g.notes ?? ''}</textarea></div>
      <button class="btn btn--sm">Save</button> <button type="button" class="link-btn danger-text" data-del>Delete</button></form>`))}
    <form class="panel" data-g="new"><h2>New size guide</h2>
      <div class="field"><label>Name</label><input name="name" required></div>
      <div class="field"><label>Table</label><textarea name="table" rows="6" placeholder="Size | Baby height | Chest\nNewborn | 50–56 | 38"></textarea></div>
      <div class="field"><label>Notes</label><textarea name="notes"></textarea></div>
      <button class="btn btn--sm">Create</button></form>`;
  view().addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const lines = f.table.value.split('\n').map((l) => l.split('|').map((c) => c.trim())).filter((r) => r.some(Boolean));
    const body = { name: f.name.value, columns: lines[0] ?? ['Size'], rows: lines.slice(1), notes: f.notes.value || null };
    try {
      if (f.dataset.g === 'new') await api('/admin/size-guides', { method: 'POST', body });
      else await api(`/admin/size-guides/${f.dataset.g}`, { method: 'PATCH', body });
      toast('Saved');
      sizeGuidesView();
    } catch (ex) { toast(errText(ex), { error: true }); }
  });
  view().addEventListener('click', async (e) => {
    if (!e.target.matches('[data-del]') || !confirm('Delete this size guide?')) return;
    await api(`/admin/size-guides/${e.target.closest('[data-g]').dataset.g}`, { method: 'DELETE' });
    sizeGuidesView();
  });
}

// ============================ Reviews ============================
async function reviewsView(status = 'PENDING') {
  const { reviews } = await api(`/admin/reviews?status=${status}`);
  resetView();
  view().innerHTML = html`
    <div class="view-head"><h1>Reviews</h1><div class="pill-tabs">${['PENDING', 'APPROVED', 'REJECTED'].map((s) => raw(html`<button data-st="${s}" aria-pressed="${s === status}">${s}</button>`))}</div></div>
    ${raw(reviews.length ? reviews.map((r) => html`<article class="panel" data-r="${r.id}">
      <div class="view-head"><strong>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.title ?? ''}</strong><span class="muted">${r.user.name} · ${r.user.email} · ${date(r.createdAt)}${r.verified ? ' · Verified purchase' : ''}</span></div>
      <p>${r.body}</p><p class="muted">On <a href="/product/${r.product.slug}" target="_blank">${r.product.name}</a></p>
      <button class="btn btn--sm" data-set="APPROVED">Approve</button> <button class="btn btn--ghost btn--sm" data-set="REJECTED">Reject</button> <button class="link-btn danger-text" data-del>Delete</button>
    </article>`).join('') : '<div class="empty">Nothing here.</div>')}`;
  qsa('[data-st]').forEach((b) => b.addEventListener('click', () => reviewsView(b.dataset.st)));
  view().addEventListener('click', async (e) => {
    const card = e.target.closest('[data-r]');
    if (!card) return;
    if (e.target.dataset.set) await api(`/admin/reviews/${card.dataset.r}`, { method: 'PATCH', body: { status: e.target.dataset.set } });
    else if (e.target.matches('[data-del]') && confirm('Delete review?')) await api(`/admin/reviews/${card.dataset.r}`, { method: 'DELETE' });
    else return;
    card.remove();
  });
}

// ============================ Customers ============================
async function customersView(q = '', page = 1) {
  const r = await api(`/admin/customers?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  resetView();
  view().innerHTML = html`
    <div class="view-head"><h1>Customers</h1><span class="muted">${r.total} accounts</span></div>
    <div class="toolbar"><input type="search" id="cq" placeholder="Name or email" value="${q}"></div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Joined</th><th>Role</th></tr></thead>
    <tbody>${r.customers.map((c) => raw(html`<tr data-u="${c.id}"><td>${c.name}</td><td>${c.email}</td><td>${c.phone ?? '—'}</td><td>${c._count.orders}</td><td>${new Date(c.createdAt).toLocaleDateString()}</td>
      <td><select data-role ${raw(c.id === me.id ? 'disabled' : '')}>${['CUSTOMER', 'STAFF', 'ADMIN'].map((x) => raw(html`<option ${raw(c.role === x ? 'selected' : '')}>${x}</option>`))}</select></td></tr>`))}</tbody></table></div>
    ${raw(pager(r.page, r.totalPages, (pg) => customersView(q, pg)))}`;
  qs('#cq').addEventListener('input', debounce((e) => customersView(e.target.value, 1), 400));
  view().addEventListener('change', async (e) => {
    if (!e.target.matches('[data-role]')) return;
    if (!confirm(`Change role to ${e.target.value}? They will be signed out.`)) return customersView(q, page);
    try { await api(`/admin/customers/${e.target.closest('[data-u]').dataset.u}/role`, { method: 'PATCH', body: { role: e.target.value } }); toast('Role updated'); } catch (ex) { toast(errText(ex), { error: true }); }
  });
}

// ============================ Pages ============================
async function pagesView() {
  const { pages } = await api('/admin/pages');
  resetView();
  view().innerHTML = html`
    <div class="view-head"><h1>Pages</h1></div>
    <p class="muted">Policies, About, FAQ and other content pages. Plain text — blank lines become paragraphs.</p>
    ${pages.map((p) => raw(html`<form class="panel" data-p="${p.id}"><details><summary class="label">${p.title} <span class="muted">/${p.slug}</span></summary>
      <div class="form-grid mt"><div class="field"><label>Title</label><input name="title" value="${p.title}"></div><div class="field"><label>Slug</label><input name="slug" value="${p.slug}"></div></div>
      <div class="field"><label>Content</label><textarea name="body" rows="12">${p.body}</textarea></div>
      <label class="checkbox"><input type="checkbox" name="isPublished" ${raw(p.isPublished ? 'checked' : '')}> <span>Published</span></label>
      <button class="btn btn--sm mt">Save</button></details></form>`))}
    <form class="panel" data-p="new"><h2>New page</h2><div class="form-grid"><div class="field"><label>Title</label><input name="title" required></div><div class="field"><label>Slug</label><input name="slug" required pattern="[a-z0-9-]+"></div></div>
      <div class="field"><label>Content</label><textarea name="body"></textarea></div><input type="hidden" name="isPublished" value="on"><button class="btn btn--sm">Create</button></form>`;
  view().addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = { title: f.title.value, slug: f.slug.value, body: f.body.value, isPublished: f.isPublished.type === 'hidden' || f.isPublished.checked };
    try {
      if (f.dataset.p === 'new') { await api('/admin/pages', { method: 'POST', body }); pagesView(); } else await api(`/admin/pages/${f.dataset.p}`, { method: 'PATCH', body });
      toast('Saved');
    } catch (ex) { toast(errText(ex), { error: true }); }
  });
}

// ============================ Newsletter ============================
async function newsletterView() {
  const { subscribers, total } = await api('/admin/newsletter');
  view().innerHTML = html`
    <div class="view-head"><h1>Newsletter</h1><a class="btn btn--sm" href="/api/admin/newsletter?format=csv">Export CSV</a></div>
    <p class="muted">${total} active subscribers. Each record stores the exact consent text shown and the time of consent.</p>
    <div class="table-wrap"><table class="data"><thead><tr><th>Email</th><th>Consented</th><th>Source</th></tr></thead>
    <tbody>${subscribers.map((s) => raw(html`<tr><td>${s.email}</td><td>${date(s.consentAt)}</td><td>${s.source}</td></tr>`))}</tbody></table></div>`;
}

// ============================ Settings ============================
// Generic form generated from the settings JSON so new setting keys appear without UI changes.
function fieldsFor(value, path) {
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== 'object')) {
      return html`<div class="field"><label>${path.at(-1)} <span class="muted">(comma separated)</span></label><input data-path="${path.join('.')}" data-kind="list" value="${value.join(', ')}"></div>`;
    }
    const keys = Object.keys(value[0] ?? { label: '', href: '' });
    return html`<fieldset><legend>${path.at(-1)}</legend><div data-array="${path.join('.')}" data-keys="${keys.join(',')}">
      ${value.map((item) => raw(html`<div class="kv-row">${keys.map((k) => raw(html`<input data-k="${k}" placeholder="${k}" value="${typeof item[k] === 'object' ? JSON.stringify(item[k]) : item[k] ?? ''}">`))}<button type="button" class="link-btn danger-text" data-rm>✕</button></div>`))}
      </div><button type="button" class="btn btn--ghost btn--sm" data-add="${path.join('.')}">+ Add</button></fieldset>`;
  }
  if (value && typeof value === 'object') {
    return html`<fieldset><legend>${path.at(-1)}</legend>${Object.entries(value).map(([k, v]) => raw(fieldsFor(v, [...path, k])))}</fieldset>`;
  }
  const label = path.at(-1).replace(/([A-Z])/g, ' $1');
  const p = path.join('.');
  if (typeof value === 'boolean') return html`<label class="checkbox"><input type="checkbox" data-path="${p}" data-kind="bool" ${raw(value ? 'checked' : '')}> <span>${label}</span></label>`;
  if (typeof value === 'number') return html`<div class="field"><label>${label}${/fee|freeOver/i.test(p) ? ' (minor units: 2500 = 25.00 QAR)' : ''}</label><input type="number" step="any" data-path="${p}" data-kind="number" value="${value}"></div>`;
  const long = String(value).length > 80 || /body|text|about/i.test(path.at(-1));
  const isColor = /^#[0-9a-f]{6}$/i.test(value);
  if (isColor) return html`<div class="field"><label>${label}</label><input type="color" data-path="${p}" value="${value}"></div>`;
  return html`<div class="field"><label>${label}</label>${raw(long ? html`<textarea data-path="${p}">${value}</textarea>` : html`<input data-path="${p}" value="${value}">`)}</div>`;
}

function readForm(form, original) {
  const out = structuredClone(original);
  const setPath = (obj, path, v) => { const keys = path.split('.').slice(1); let o = obj; keys.slice(0, -1).forEach((k) => (o = o[k])); o[keys.at(-1)] = v; };
  qsa('[data-path]', form).forEach((el) => {
    const kind = el.dataset.kind;
    const v = kind === 'bool' ? el.checked : kind === 'number' ? Number(el.value) : kind === 'list' ? el.value.split(',').map((s) => s.trim()).filter(Boolean) : el.value;
    if (el.dataset.path.split('.').length === 1) return;
    setPath(out, el.dataset.path, v);
  });
  qsa('[data-array]', form).forEach((el) => {
    const keys = el.dataset.keys.split(',');
    const items = qsa('.kv-row', el).map((row) => Object.fromEntries(keys.map((k) => {
      const raw = qs(`[data-k="${k}"]`, row).value;
      try { return [k, raw.startsWith('{') ? JSON.parse(raw) : raw]; } catch { return [k, raw]; }
    })));
    if (el.dataset.array.split('.').length === 1) out.__root = items;
    else setPath(out, el.dataset.array, items);
  });
  return out.__root ?? out;
}

async function settingsView(active) {
  const { settings, keys } = await api('/admin/settings');
  const key = active || keys[0];
  view().innerHTML = html`
    <div class="view-head"><h1>Settings</h1></div>
    <div class="pill-tabs">${keys.map((k) => raw(html`<a href="#/settings/${k}" ${raw(k === key ? 'aria-current="page"' : '')}>${k}</a>`))}</div>
    <form class="panel settings-group" id="sform">${raw(fieldsFor(settings[key], [key]))}<button class="btn">Save ${key}</button></form>`;
  const form = qs('#sform');
  form.addEventListener('click', (e) => {
    if (e.target.dataset.rm !== undefined && e.target.matches('[data-rm]')) e.target.closest('.kv-row').remove();
    if (e.target.dataset.add) {
      const arr = qs(`[data-array="${e.target.dataset.add}"]`, form);
      arr.insertAdjacentHTML('beforeend', html`<div class="kv-row">${arr.dataset.keys.split(',').map((k) => raw(html`<input data-k="${k}" placeholder="${k}">`))}<button type="button" class="link-btn danger-text" data-rm>✕</button></div>`);
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/settings/${key}`, { method: 'PUT', body: { value: readForm(form, settings[key]) } });
      toast('Settings saved — changes are live on the storefront');
    } catch (ex) { toast(errText(ex), { error: true }); }
  });
}

// ============================ Router ============================
const routes = [
  [/^\/$/, dashboard, 'dashboard'],
  [/^\/products$/, () => products(), 'products'],
  [/^\/products\/([\w-]+)$/, (id) => productEdit(id), 'products'],
  [/^\/orders$/, () => orders(Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] ?? ''))), 'orders'],
  [/^\/orders\/([\w-]+)$/, (id) => orderDetail(id), 'orders'],
  [/^\/inventory$/, () => inventory(), 'inventory'],
  [/^\/categories$/, categoriesView, 'categories'],
  [/^\/size-guides$/, sizeGuidesView, 'size-guides'],
  [/^\/reviews$/, () => reviewsView(), 'reviews'],
  [/^\/customers$/, () => customersView(), 'customers'],
  [/^\/pages$/, pagesView, 'pages'],
  [/^\/newsletter$/, newsletterView, 'newsletter'],
  [/^\/settings(?:\/(\w+))?$/, (k) => settingsView(k), 'settings'],
];

async function route() {
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const fresh = resetView();
  fresh.innerHTML = '<div class="skeleton skeleton-qv"></div>';
  qs('#side').classList.remove('open');
  for (const [re, fn, nav] of routes) {
    const m = path.match(re);
    if (!m) continue;
    qsa('[data-nav]').forEach((a) => (a.dataset.nav === nav ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    try {
      await fn(...m.slice(1));
    } catch (e) {
      fresh.innerHTML = html`<div class="empty"><h2>Could not load</h2><p>${esc(e.message)}</p></div>`;
    }
    fresh.focus();
    return;
  }
  fresh.innerHTML = '<div class="empty"><h2>Not found</h2></div>';
}

async function boot() {
  const { user } = await api('/auth/me');
  if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
    location.href = `/login?next=${encodeURIComponent('/admin')}`;
    return;
  }
  me = user;
  const { settings } = await api('/settings');
  qs('#admin-brand').textContent = settings.brand.name;
  document.title = `Admin · ${settings.brand.name}`;
  qs('#admin-user').textContent = `${user.name} · ${user.role}`;
  if (!isAdmin()) qsa('[data-admin]').forEach((a) => a.remove());
  qs('#admin-menu').addEventListener('click', () => qs('#side').classList.toggle('open'));
  qs('#admin-logout').addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/'; });
  window.addEventListener('hashchange', route);
  route();
}

boot().catch((e) => { view().innerHTML = html`<div class="empty"><h2>Error</h2><p>${esc(e.message)}</p></div>`; });
