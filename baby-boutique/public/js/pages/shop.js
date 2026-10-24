import { api } from '../api.js';
import { html, raw, qs, qsa, debounce } from '../util.js';
import { init, fail, revealOnScroll, setTitle, setMeta } from '../layout.js';
import { productCard, wireCards } from '../components.js';

const SORTS = [['newest', 'Newest'], ['popular', 'Most popular'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']];
let categories = [];

function readFilters() {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get('q') ?? '',
    category: p.get('category') ?? '',
    size: p.getAll('size'),
    color: p.getAll('color'),
    minPrice: p.get('minPrice') ?? '',
    maxPrice: p.get('maxPrice') ?? '',
    availability: p.get('availability') ?? '',
    sort: p.get('sort') ?? 'newest',
    page: Number(p.get('page') ?? 1),
  };
}

function toQuery(f) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else if (v !== '' && v != null && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'newest')) p.set(k, v);
  }
  return p;
}

function filtersHtml(f, facets) {
  return html`
    <form id="filters" class="filters" aria-label="Product filters">
      <fieldset><legend>Category</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="category" value="" ${raw(!f.category ? 'checked' : '')}><span>All</span></label>
          ${categories.filter((c) => c.slug !== 'new-arrivals').map((c) => raw(html`<label class="chip"><input type="radio" name="category" value="${c.slug}" ${raw(f.category === c.slug ? 'checked' : '')}><span>${c.name}</span></label>`))}
        </div>
      </fieldset>
      ${raw(facets.sizes.length ? html`<fieldset><legend>Size</legend><div class="chips">
        ${facets.sizes.map((s) => raw(html`<label class="chip"><input type="checkbox" name="size" value="${s}" ${raw(f.size.includes(s) ? 'checked' : '')}><span>${s}</span></label>`))}</div></fieldset>` : '')}
      ${raw(facets.colors.length ? html`<fieldset><legend>Colour</legend><div class="chips">
        ${facets.colors.map((c) => raw(html`<label class="chip"><input type="checkbox" name="color" value="${c.name}" ${raw(f.color.includes(c.name) ? 'checked' : '')}><span><i class="swatch" data-hex="${c.hex || ''}"></i>${c.name}</span></label>`))}</div></fieldset>` : '')}
      <fieldset><legend>Price (QAR)</legend>
        <div class="price-range">
          <label class="sr-only" for="minPrice">Minimum price</label><input id="minPrice" type="number" name="minPrice" min="0" inputmode="numeric" placeholder="${Math.floor(facets.price.min / 100)}" value="${f.minPrice}">
          <span>–</span>
          <label class="sr-only" for="maxPrice">Maximum price</label><input id="maxPrice" type="number" name="maxPrice" min="0" inputmode="numeric" placeholder="${Math.ceil(facets.price.max / 100)}" value="${f.maxPrice}">
        </div>
      </fieldset>
      <fieldset><legend>Availability</legend><div class="chips">
        <label class="chip"><input type="radio" name="availability" value="" ${raw(!f.availability ? 'checked' : '')}><span>All</span></label>
        <label class="chip"><input type="radio" name="availability" value="in_stock" ${raw(f.availability === 'in_stock' ? 'checked' : '')}><span>In stock</span></label>
        <label class="chip"><input type="radio" name="availability" value="made_to_order" ${raw(f.availability === 'made_to_order' ? 'checked' : '')}><span>Made to order</span></label>
      </div></fieldset>
      <button type="button" class="btn btn--ghost btn--sm btn--block" id="clear-filters">Clear all filters</button>
    </form>`;
}

async function load() {
  const f = readFilters();
  const cat = categories.find((c) => c.slug === f.category);
  const title = f.q ? `Search: “${f.q}”` : cat?.name ?? 'Shop all';
  setTitle(title);
  setMeta(cat?.description ?? 'Shop handmade knitted baby clothes, booties, bonnets, dolls and gift sets.');

  const apiQuery = toQuery({ ...f, newArrivals: f.category === 'new-arrivals' ? 'true' : '', category: f.category === 'new-arrivals' ? '' : f.category });
  apiQuery.set('pageSize', 12);
  const [list, facets] = await Promise.all([api(`/products?${apiQuery}`), api(`/products/facets${f.category && f.category !== 'new-arrivals' ? `?category=${encodeURIComponent(f.category)}` : ''}`)]);

  qs('#main').innerHTML = html`
    <div class="container page-head">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a>${cat ? ` / ${cat.name}` : ''}</nav>
      <h1>${title}</h1>
      ${raw(cat?.description ? html`<p class="muted">${cat.description}</p>` : '')}
    </div>
    <div class="container shop-layout">
      ${raw(filtersHtml(f, facets))}
      <section aria-live="polite">
        <div class="shop-toolbar">
          <button class="btn btn--ghost btn--sm filters-toggle" aria-controls="filters" aria-expanded="false">Filters</button>
          <span class="muted">${list.total} product${list.total === 1 ? '' : 's'}</span>
          <label><span class="sr-only">Sort by</span><select id="sort">${SORTS.map(([v, l]) => raw(html`<option value="${v}" ${raw(f.sort === v ? 'selected' : '')}>${l}</option>`))}</select></label>
        </div>
        ${raw(list.items.length
          ? html`<div class="product-grid" id="grid">${list.items.map((p) => raw(productCard(p)))}</div>`
          : html`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>
              <h2>No products match</h2><p class="muted">Try removing a filter or searching for something else.</p>
              <a class="btn" href="/shop">Browse everything</a></div>`)}
        ${raw(list.totalPages > 1 ? html`<nav class="pagination" aria-label="Pages">${Array.from({ length: list.totalPages }, (_, i) => raw(html`<button data-page="${i + 1}" ${raw(i + 1 === list.page ? 'aria-current="page"' : '')}>${i + 1}</button>`))}</nav>` : '')}
      </section>
    </div>`;

  qsa('.swatch[data-hex]').forEach((el) => el.dataset.hex && el.style.setProperty('background', el.dataset.hex));
  if (list.items.length) wireCards(qs('#grid'), list.items);
  revealOnScroll();

  const form = qs('#filters');
  const apply = () => {
    const fd = new FormData(form);
    navigate({ ...f, category: fd.get('category') ?? '', size: fd.getAll('size'), color: fd.getAll('color'), minPrice: fd.get('minPrice'), maxPrice: fd.get('maxPrice'), availability: fd.get('availability') ?? '', page: 1 });
  };
  form.addEventListener('change', (e) => e.target.type !== 'number' && apply());
  form.addEventListener('input', debounce((e) => e.target.type === 'number' && apply(), 700));
  form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
  qs('#clear-filters').addEventListener('click', () => navigate({ q: f.q, sort: f.sort }));
  qs('#sort').addEventListener('change', (e) => navigate({ ...f, sort: e.target.value, page: 1 }));
  qsa('.pagination button').forEach((b) => b.addEventListener('click', () => navigate({ ...f, page: Number(b.dataset.page) })));
  const toggle = qs('.filters-toggle');
  toggle.addEventListener('click', () => {
    const open = form.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

function navigate(f) {
  const q = toQuery({ size: [], color: [], ...f }).toString();
  history.pushState(null, '', `/shop${q ? `?${q}` : ''}`);
  load().then(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch(fail);
}

async function main() {
  await init();
  ({ categories } = await api('/categories'));
  window.addEventListener('popstate', () => load().catch(fail));
  await load();
}

main().catch(fail);
