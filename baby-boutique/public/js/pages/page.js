import { api } from '../api.js';
import { html, raw, qs } from '../util.js';
import { init, fail, setTitle, setMeta, state } from '../layout.js';

async function main() {
  await init();
  const parts = location.pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'pages' ? parts[1] : parts[0];
  const { page } = await api(`/pages/${encodeURIComponent(slug)}`);
  setTitle(page.title);
  setMeta(page.body.slice(0, 160));
  const f = state.settings.footer;
  qs('#main').innerHTML = html`
    <div class="container section">
      <nav class="breadcrumbs"><a href="/">Home</a> / ${page.title}</nav>
      <h1>${page.title}</h1>
      <div class="prose">${page.body}</div>
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
