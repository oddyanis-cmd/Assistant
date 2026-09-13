# Ledger & Case — Financial Analyst Training Simulator

A single-file, self-contained web app (`index.html`). No build step, no server —
it runs entirely in the browser and uses only public CDNs (Chart.js, SheetJS,
jsPDF) plus Google Fonts. PDF/Excel export works when hosted on a normal static
host (e.g. Vercel).

## Deploy on Vercel (from GitHub)
1. Go to https://vercel.com → **Add New… → Project**.
2. **Import** the `oddyanis-cmd/Assistant` repository.
3. Set **Root Directory** to `financial-analyst-simulator`.
4. **Framework Preset**: `Other` (it's plain static HTML — no build command).
5. Click **Deploy**. You'll get a public `https://…vercel.app` URL, and every
   push to this folder auto-deploys.

## Update the app
Replace `index.html` with a newer version and push — Vercel redeploys
automatically.
