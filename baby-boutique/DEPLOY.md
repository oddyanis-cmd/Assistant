# Putting YAOUA online (shop + separate admin)

One server runs both sides. The address decides what people see:

| Address | Who | What they get |
|---|---|---|
| `https://yaoua.qa` | Customers | The shop. `/admin` does not exist here (404). |
| `https://admin.yaoua.qa` | You and staff | Only the admin sign-in and dashboard. Hidden from Google. |

Both use the same database, so shop orders appear in the admin instantly.

## What you need first (accounts in the business's name)

1. **The domain `yaoua.qa`.** `.qa` domains are registered through an accredited Qatar registrar (the CRA
   publishes the list). You'll need your CR. Keep the login safe.
2. **A Render account** (render.com). It hosts the app and the database. About US$7/month for the server plus
   about US$6/month for the database on the plans in `render.yaml`. Check render.com/pricing for current prices.
3. **A Cloudinary account** (free tier is enough to start). It stores product photos. Render's disk is wiped on
   every update, so photos can't live there.
4. **A payment gateway.** The live site refuses the fake test payments. PayPal works today, but customers are charged in
   USD. A Qatar gateway (QPay/NAPS through your bank, or Tap, SkipCash, MyFatoorah) needs a small
   connector added to the app once you choose one and open the merchant account.

## Steps

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

## After launch

- Updates: push to the deployed branch and Render redeploys automatically. Database changes are applied on start.
- Staff: they create a normal account on the shop. You then open **Admin → Customers** and change their role to STAFF.
  Staff can manage products and orders. Only ADMIN can change settings or issue refunds.
- Back-ups: Render takes daily database back-ups on paid plans; download one occasionally.
