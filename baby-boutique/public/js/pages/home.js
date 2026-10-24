import { api } from '../api.js';
import { html, raw, qs, stars, toast } from '../util.js';
import { icons } from '../icons.js';
import { init, fail, revealOnScroll, state, setMeta } from '../layout.js';
import { productCard, wireCards } from '../components.js';

async function main() {
  await init();
  const { hero, home, newsletter } = state.settings;
  setMeta(hero.subheading);
  const data = await api('/home');

  qs('#main').innerHTML = html`
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow">${state.settings.brand.tagline}</span>
          <h1>${hero.headline}</h1>
          <p class="lead">${hero.subheading}</p>
          <div class="hero-ctas">
            <a class="btn" href="${hero.primaryCta.href}">${hero.primaryCta.label}</a>
            <a class="btn btn--ghost" href="${hero.secondaryCta.href}">${hero.secondaryCta.label}</a>
          </div>
          <div class="hero-badges">
            <span>${raw(icons.hand)} Handmade</span>
            <span>${raw(icons.leaf)} Baby-safe yarns</span>
            <span>${raw(icons.gift)} Gift wrapped</span>
          </div>
        </div>
        <div class="hero-media"><img src="${hero.imageUrl}" alt="${hero.imageAlt}" fetchpriority="high"></div>
      </div>
    </section>

    ${raw(data.categories.length ? html`
    <section class="section">
      <div class="container">
        <div class="section-head"><div><span class="eyebrow">Explore</span><h2>Shop by category</h2></div></div>
        <div class="cat-grid">
          ${data.categories.map((c) => raw(html`<a class="cat-card reveal" href="/shop?category=${c.slug}">
            <span class="cat-img">${raw(c.imageUrl ? html`<img src="${c.imageUrl}" alt="" loading="lazy">` : html`<span class="cat-initial" aria-hidden="true">${c.name[0]}</span>`)}</span>
            <strong>${c.name}</strong></a>`))}
        </div>
      </div>
    </section>` : '')}

    ${raw(data.bestSellers.length ? html`
    <section class="section section--tint">
      <div class="container">
        <div class="section-head"><div><span class="eyebrow">Loved by parents</span><h2>${home.bestSellersTitle}</h2></div><a class="btn btn--ghost btn--sm" href="/shop?sort=popular">View all</a></div>
        <div class="product-grid" id="best">${data.bestSellers.map((p) => raw(productCard(p)))}</div>
      </div>
    </section>` : '')}

    <section class="section">
      <div class="container">
        <div class="section-head"><div><span class="eyebrow">Fresh off the needles</span><h2>${home.newArrivalsTitle}</h2></div><a class="btn btn--ghost btn--sm" href="/shop?sort=newest">Shop new</a></div>
        <div class="product-grid" id="new">${data.newArrivals.map((p) => raw(productCard(p)))}</div>
      </div>
    </section>

    <section class="section section--tint" id="story">
      <div class="container story">
        <img class="reveal" src="${home.storyImageUrl}" alt="" loading="lazy">
        <div class="reveal">
          <span class="eyebrow">Made by hand</span>
          <h2>${home.storyTitle}</h2>
          <p>${home.storyBody}</p>
          <div class="steps">
            <div class="step">${raw(icons.yarn)}<strong>Choose</strong>soft, baby-safe yarns</div>
            <div class="step">${raw(icons.hand)}<strong>Craft</strong>stitch by stitch</div>
            <div class="step">${raw(icons.gift)}<strong>Wrap</strong>ready to gift</div>
          </div>
          <a class="btn btn--ghost" href="/about">Read our story</a>
        </div>
      </div>
    </section>

    ${raw(data.reviews.length ? html`
    <section class="section">
      <div class="container">
        <div class="section-head"><div><span class="eyebrow">Kind words</span><h2>From our customers</h2></div></div>
        <div class="reviews-grid">${data.reviews.map((r) => raw(html`<blockquote class="review-card reveal">
          <div class="stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</div>
          ${raw(r.title ? html`<h3>${r.title}</h3>` : '')}<p>${r.body}</p>
          <footer>— ${r.user.name}, on <a href="/product/${r.product.slug}">${r.product.name}</a></footer></blockquote>`))}</div>
      </div>
    </section>` : '')}

    ${raw(newsletter.enabled ? html`
    <section class="section">
      <div class="container">
        <div class="newsletter reveal">
          <div><h2>${home.newsletterTitle}</h2><p>${home.newsletterBody}</p></div>
          <form id="newsletter-form" novalidate>
            <div class="row">
              <label class="sr-only" for="nl-email">Email address</label>
              <input id="nl-email" type="email" name="email" placeholder="Your email address" required autocomplete="email">
              <button class="btn" type="submit">Subscribe</button>
            </div>
            <label class="checkbox"><input type="checkbox" name="consent" required> <span>${newsletter.consentText}</span></label>
          </form>
        </div>
      </div>
    </section>` : '')}`;

  for (const [id, items] of [['best', data.bestSellers], ['new', data.newArrivals]]) {
    const el = qs(`#${id}`);
    if (el) wireCards(el, items);
  }
  qs('#newsletter-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.email.value || !f.email.checkValidity()) return toast('Please enter a valid email', { error: true });
    if (!f.consent.checked) return toast('Please tick the consent box to subscribe', { error: true });
    try {
      const r = await api('/newsletter', { method: 'POST', body: { email: f.email.value, consent: true, source: 'home' } });
      toast(r.message);
      f.reset();
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
  revealOnScroll();
}

main().catch(fail);
