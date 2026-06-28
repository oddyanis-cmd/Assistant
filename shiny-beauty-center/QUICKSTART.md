# Shiny Beauty Center — Beta Quick Start (step by step)

Goal: get a working copy you can log into and click around, as **every role**.
Time: ~15 minutes. You need a computer (Mac or Windows) with internet. No coding.

There are **6 parts**. Do them in order.

---

## Part 1 — Create the database (Supabase)

1. Go to **https://supabase.com** and click **Start your project** → sign in
   (GitHub or email).
2. Click **New project**.
   - Name: `shiny-beauty-center`
   - **Database Password**: type a strong one and **save it somewhere**.
   - Region: pick the one nearest you (e.g. a Middle East / Europe region).
   - Click **Create new project** and wait ~2 minutes while it sets up.

## Part 2 — Load everything into the database (one paste)

3. In the left sidebar click **SQL Editor** → **New query**.
4. Open the file **`shiny-beauty-center/supabase/setup.sql`** from the code,
   **select all** (Ctrl+A / Cmd+A), **copy**, and **paste** it into the editor.
5. Click **Run** (or press Ctrl/Cmd + Enter). You should see **Success**.
   *(This creates every table, security rule, the services menu, and staff.)*

## Part 3 — Copy your 3 keys

6. Left sidebar → **Project Settings** (the gear) → **API**.
7. Copy these three values (you'll paste them in Part 5):
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key
   - **service_role** key  *(secret — don't share publicly)*

## Part 4 — Get the app onto your computer

8. **Install Node** (the engine that runs the app): go to **https://nodejs.org**,
   download the **LTS** version, and install it (Mac: `.pkg`, Windows: `.msi` — just
   click through).
9. **Download the code**: on your GitHub repo, switch the branch selector to
   **`claude/laughing-ride-hk31di`**, click the green **Code** button →
   **Download ZIP**, then **unzip** it. *(If you use git: `git clone` the repo and
   `git checkout claude/laughing-ride-hk31di`.)*
10. **Open a terminal in the `shiny-beauty-center` folder**:
    - **Mac**: in Finder, right-click the `shiny-beauty-center` folder → **New
      Terminal at Folder**.
    - **Windows**: open the `shiny-beauty-center` folder, click the address bar,
      type `cmd`, press Enter.

## Part 5 — Configure and run

11. In the terminal, type:
    ```bash
    npm install
    ```
    (downloads what the app needs — wait for it to finish).

12. **Create your settings file**: make a copy of `.env.example` named **`.env.local`**
    in the same folder, open it in any text editor, and fill in the 3 values from Part 3:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR-ANON-KEY"
    SUPABASE_SERVICE_ROLE_KEY="YOUR-SERVICE-ROLE-KEY"
    NEXT_PUBLIC_APP_URL="http://localhost:3000"
    NEXT_PUBLIC_PAYMENTS_ENABLED="false"
    NEXT_PUBLIC_NOTIFICATIONS_ENABLED="false"
    ```
    Save the file.

13. **Create the 4 test logins:**
    ```bash
    npm run db:seed:test
    ```
    It prints the accounts when done.

14. **Start the app:**
    ```bash
    npm run dev
    ```
    Leave this running. Open **http://localhost:3000** in your browser.

## Part 6 — Log in and test

15. Go to **http://localhost:3000/en/auth/signin** and log in (password
    `ShinyTest123!` for all):

| Role | Email | Try this |
|---|---|---|
| 🛡️ Admin | `admin@shiny.test` | Users → grant/revoke a permission; add a service |
| 📊 Manager | `manager@shiny.test` | Dashboard, reports → Export CSV, approve time-off |
| 💇 Staff | `staff@shiny.test` | Your day schedule; check-in / complete an appointment |
| 👩 Client | `client@shiny.test` | Browse → **book**; My Appointments; switch to Arabic (RTL) |

16. Full per-role checklist is in **`BETA_TESTING.md`**.
17. To stop the app: click the terminal and press **Ctrl + C**. To start again later:
    `npm run dev`.

---

## Want a link instead of localhost (test on your phone)?
Deploy to **Vercel** (free) following **`DEPLOYMENT.md`** — set the project **Root
Directory** to `shiny-beauty-center`, add the same keys, and you'll get a public
`https://…` address that installs as an app on your phone's home screen.

## If something doesn't work
- Open **http://localhost:3000/api/health** — it tells you if Supabase is connected.
- "permission denied / no data" → re-check Part 2 ran with **Success** and the keys in
  `.env.local` are correct.
- `npm` not found → re-open the terminal after installing Node (Part 8).
