const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape every interpolated value in HTML templates. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template that escapes interpolations unless wrapped in raw(). */
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    const v = values[i - 1];
    const str = v?.__raw ? v.value : Array.isArray(v) ? v.map((x) => (x?.__raw ? x.value : esc(x))).join('') : esc(v);
    return out + str + s;
  });
}
export const raw = (value) => ({ __raw: true, value: String(value ?? '') });

let money = new Intl.NumberFormat('en-QA', { style: 'currency', currency: 'QAR' });
export function setCurrency(currency = 'QAR', locale = 'en-QA') {
  money = new Intl.NumberFormat(locale, { style: 'currency', currency });
}
export const fmt = (minor) => money.format((minor ?? 0) / 100);

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
export const params = () => new URLSearchParams(location.search);

export function stars(n) {
  const r = Math.round(n);
  return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(message, { error = false, link } = {}) {
  let box = qs('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast${error ? ' toast--err' : ''}`;
  el.innerHTML = html`<span>${message}</span>${link ? raw(html`<a href="${link.href}">${link.label}</a>`) : ''}`;
  box.append(el);
  setTimeout(() => el.remove(), 4500);
}

export const stockLabel = {
  in_stock: 'In stock',
  low: 'Only a few left',
  out_of_stock: 'Out of stock',
  made_to_order: 'Made to order',
};

/** Builds a responsive <img> for our 3 image sizes; lazy by default. */
export function img(image, { alt = '', eager = false, sizes = '(max-width: 600px) 50vw, 25vw', cls = '' } = {}) {
  if (!image) return '';
  const srcset = [image.thumbUrl && `${image.thumbUrl} 360w`, image.mediumUrl && `${image.mediumUrl} 800w`, image.url && `${image.url} 2000w`].filter(Boolean).join(', ');
  return html`<img class="${cls}" src="${image.mediumUrl || image.url || image.thumbUrl}" ${raw(srcset ? html`srcset="${srcset}" sizes="${sizes}"` : '')} alt="${image.alt || alt}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
}
