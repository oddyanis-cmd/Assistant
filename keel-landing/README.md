# Keel — landing page

Static, self-contained marketing page for **Keel** (AI financial-analysis product).
Single file, no build step — deploy the folder as a static site.

- `index.html` — the whole page (inline CSS + JS; fonts from Google Fonts).
- Trilingual EN / FR / AR (full RTL), live theme picker (5 presets + custom colour), interactive report-doc intro.

## Deploy
Any static host. Set the project **root directory** to `keel-landing/` (no build command, output = the folder).
- Vercel: New Project → import repo → Root Directory `keel-landing` → Framework: Other → Deploy.
- Netlify: base `keel-landing`, publish `keel-landing`, no build command.
