import { api } from '../api.js';
import { html, raw, qs, esc } from '../util.js';

// Page text format: "## Heading" lines become headings, "• item" lines become bullet lists, other
// lines are paragraphs. A line "===AR===" starts the Arabic version, shown right-to-left below.
function renderSection(text) {
  const out = [];
  let list = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('• ')) { (list ||= []).push(`<li>${esc(t.slice(2))}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (!t || t.startsWith('<!--')) continue; // internal version marker
    out.push(t.startsWith('## ') ? `<h2>${esc(t.slice(3))}</h2>` : `<p>${esc(t)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('');
}
function renderBody(body) {
  const [en, ar] = body.split(/^===AR===$/m);
  return `<div class="prose rich">${renderSection(en)}</div>` +
    (ar ? `<div class="prose rich prose-ar" lang="ar" dir="rtl">${renderSection(ar)}</div>` : '');
}
import { init, fail, setTitle, setMeta, state } from '../layout.js';

async function main() {
  await init();
  const parts = location.pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'pages' ? parts[1] : parts[0];
  const { page } = await api(`/pages/${encodeURIComponent(slug)}`);
  setTitle(page.title);
  setMeta(page.body.replace(/^## .*$/m, '').replace(/\s+/g, ' ').trim().slice(0, 160));
  const f = state.settings.footer;
  qs('#main').innerHTML = html`
    <div class="container section">
      <nav class="breadcrumbs"><a href="/">Home</a> / ${page.title}</nav>
      <h1>${page.title}</h1>
      ${raw(renderBody(page.body))}
      ${raw(slug === 'contact' ? html`
        <div class="panel mt-lg">
          <h2>Send us a message</h2>
          <p class="muted">The quickest way to reach us is ${f.whatsapp ? 'WhatsApp or ' : ''}email.</p>
          <div class="buy-row">
            ${raw(f.email ? html`<a class="btn" href="mailto:${f.email}">Email ${f.email}</a>` : '')}
            ${raw(f.whatsapp ? html`<a class="btn btn--rose" href="https://wa.me/${f.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp us</a>` : '')}
          </div>
        </div>` : '')}
    </div>`;
}
main().catch((e) => (e.status === 404 ? (qs('#main').innerHTML = '<div class="container section"><div class="empty"><h1>Page not found</h1><a class="btn" href="/">Home</a></div></div>') : fail(e)));
