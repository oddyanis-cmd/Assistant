# Putting YAOUA online (shop + separate admin)

One server runs both sides. The address decides what people see:

| Address | Who | What they get |
|---|---|---|
| `https://yaoua.qa` | Customers | The shop. `/admin` does not exist here (404). |
| `https://admin.yaoua.qa` | You and staff | Only the admin sign-in and dashboard. Hidden from Google. |

Both use the same database, so shop orders appear in the admin instantly.

## Deploying on Netlify (recommended for you)

Everything runs in one Netlify Function (`netlify/functions/app.js`). Netlify routes every request to it, so
the shop/admin split, sign-in and security headers behave exactly as tested. A second, scheduled function
(`housekeeping`) runs every 5 minutes to release stock from abandoned checkouts.

### You need (in the business's name)
1. **The domain `yaoua.qa`.** Buy it from an accredited Qatar registrar, using your CR.
2. **A Postgres database:** a free **Neon** account (neon.tech), region *Frankfurt*. From Neon's **Connect** button copy two URLs:
   - the **pooled** connection string, which goes in `DATABASE_URL`. Add `&pgbouncer=true&connection_limit=1` to the end of it.
   - the **direct** connection string, which goes in `DIRECT_DATABASE_URL`. It is only used to apply database changes during each deploy.
3. **Cloudinary** (free) for product photos. Netlify Functions cannot save files on their own disk.
4. **A payment gateway**: PayPal works now but charges in USD; a Qatar gateway (QPay/NAPS, Tap, SkipCash, MyFatoorah) needs a small connector added once you choose one.

### Steps
1. Netlify → **Add new project → Import an existing project → GitHub**, then choose the `Assistant` repository and the branch.
   Set **Base directory = `baby-boutique`**. Netlify reads `netlify.toml` for the rest.
2. **Before the first deploy**, open **Project configuration → Environment variables** and add these. Mark secrets as *secret*.

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `APP_URL` | `https://yaoua.qa` |
   | `ADMIN_URL` | `https://admin.yaoua.qa` |
   | `COOKIE_SECURE` | `true` |
   | `TRUST_PROXY` | `true` |
   | `DATABASE_URL` | Neon pooled URL (secret) |
   | `DIRECT_DATABASE_URL` | Neon direct URL (secret) |
   | `MEDIA_PROVIDER` | `cloudinary` |
   | `CLOUDINARY_URL` | from Cloudinary (secret) |
   | `PAYMENT_PROVIDERS` | your gateway, e.g. `paypal`, plus its keys (secret) |

3. **Deploy.** The build applies the database tables automatically.
4. **Create your owner account once**, from any computer with this project and Node installed:
   `DATABASE_URL="<Neon direct URL>" NODE_ENV=production ADMIN_EMAIL=you@yaoua.qa ADMIN_PASSWORD="<long passphrase>" npm run db:seed`.
   This creates the owner account, categories and policy pages only, with no sample products.
5. **Domains.** In Netlify go to **Domain management → Add domain** and add `yaoua.qa`, then add `admin.yaoua.qa` as a **domain alias**.
   Copy the DNS records Netlify shows into your `.qa` registrar. HTTPS is issued automatically.
6. **Check it works:**
   - `https://yaoua.qa` shows the shop.
   - `https://yaoua.qa/admin` shows "page not found".
   - `https://admin.yaoua.qa` shows the admin sign-in.
7. Add your real products. **Upload photos one or two at a time, each under 4 MB.** Netlify Functions
   accept about 4.5 MB per request.

Netlify's free plan includes 125k function requests a month, which is enough for a small shop to start.
Check your plan's limits in the Netlify dashboard.

## Alternative: Render (always-on server)

`render.yaml` sets up the same app on Render instead. Use it if you outgrow function limits; the steps are below.

### Render: what you need first

1. **The domain `yaoua.qa`.** `.qa` domains are registered through an accredited Qatar registrar (the CRA
   publishes the list). You'll need your CR. Keep the login safe.
2. **A Render account** (render.com). It hosts the app and the database. About US$7/month for the server plus
   about US$6/month for the database on the plans in `render.yaml`. Check render.com/pricing for current prices.
3. **A Cloudinary account** (free tier is enough to start). It stores product photos. Render's disk is wiped on
   every update, so photos can't live there.
4. **A payment gateway** (applies to both Netlify and Render). The live site refuses the fake test payments. PayPal works today, but customers are charged in
   USD. A Qatar gateway (QPay/NAPS through your bank, or Tap, SkipCash, MyFatoorah) needs a small
   connector added to the app once you choose one and open the merchant account.

### Render steps

1. **Render → New → Blueprint →** connect GitHub, choose the `Assistant` repository and the branch with this code.
   Set the Blueprint file path to `baby-boutique/render.yaml`. Render creates the server and the database.
2. When asked, fill the secret values:
   - `CLOUDINARY_URL`: copy it from the Cloudinary dashboard.
   - `PAYMENT_PROVIDERS`: e.g. `paypal`, plus that gateway's keys.
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: your owner login. Use a long passphrase of at least 12 characters.
3. **Create your owner account** once: in Render open the service, go to **Shell**, and run `npm run db:seed`. On the live site this
   creates the owner, categories and policy pages only. It never creates sample products.
4. **Connect the domain.** In Render go to **Settings → Custom domains**. `yaoua.qa` and `admin.yaoua.qa` are already listed,
   with the DNS records to add. Add those records at your `.qa` registrar. HTTPS certificates are issued
   automatically once DNS is in place, which can take a few hours.
5. **Check it works:**
   - `https://yaoua.qa` shows the shop.
   - `https://yaoua.qa/admin` shows "page not found".
   - `https://admin.yaoua.qa` shows the admin sign-in. Sign in with your owner email.
6. **Add your real products and photos** in the admin. Then place one real low-value order to test payment, and refund it.

## Admin security (two-step sign-in)

- Every admin and staff sign-in needs the password **and** a 6-digit code from an authenticator app
  (Google Authenticator, Microsoft Authenticator, 1Password…). The first sign-in shows a QR code to scan.
- **Set yours up right after the first deploy**, before you share the admin address. Until an account has
  scanned its QR code, anyone who knew that account's password could set up their own phone instead.
- Admin and staff sessions end after 12 hours. Changing someone's role signs them out everywhere.
- Lost your phone? Someone with database access runs:
  `DATABASE_URL="<direct URL>" node scripts/reset-2fa.js you@yaoua.qa`. Your next sign-in will show a new QR code.

## After launch

- Updates: push to the deployed branch and Render redeploys automatically. Database changes are applied on start.
- Staff: they create a normal account on the shop. You then open **Admin → Customers** and change their role to STAFF.
  Staff can manage products and orders. Only ADMIN can change settings or issue refunds.
- Back-ups: Render takes daily database back-ups on paid plans; download one occasionally.
