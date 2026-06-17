# Belza Salon — Technical Blueprint

**Author:** Theo (Tech Lead) · **For:** Felix (Developer)
**App location:** `belza-salon/` — a self-contained Next.js app in a subdirectory of this repo. It shares **nothing** with the existing Python assistant code; treat it as an independent project with its own `package.json`, `node_modules`, and `.env`.

---

## 1. Final stack decision

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | One codebase serves the public site, admin CRM, and API routes; SSR for SEO on landing/services. |
| Styling | **Tailwind CSS v4 + shadcn/ui (Radix primitives)** | Matches the clean Belza look fast; accessible components out of the box. |
| ORM | **Prisma 6** | Type-safe DB access, painless migrations; schema is the single source of truth. |
| Database | **PostgreSQL** (prod) / **SQLite** (optional local) | Real constraints + transactions to prevent double-booking. |
| Auth (admin) | **Auth.js / NextAuth v5** (Credentials) | Admin-only login via secure cookies; no public accounts in MVP. |
| Payments | **Stripe** (PaymentIntents) — **toggleable via `PAYMENTS_ENABLED`** | Industry standard; deposits supported; compiles out cleanly when disabled. |
| Email | **Resend** (default) + **SMTP fallback** (Nodemailer) | Simplest transactional path; SMTP fallback works with any mailbox. |
| Validation | **Zod** | One schema validates API + form input; inferred TS types. |
| Dates | **date-fns** + **@date-fns/tz** | Slot math + timezone/DST handling, lightweight. |
| Hosting | **Vercel** + **Neon Postgres** | First-class Next.js hosting; serverless Postgres + pooling fits Vercel. |

Decisions on top of the defaults: shadcn/ui + Radix instead of hand-rolled components; Neon over Supabase (don't need Supabase auth/storage); all times stored in **UTC** with one salon-wide IANA timezone; Server Actions for admin mutations, Route Handlers for public/webhook/cron endpoints.

---

## 2. Feature list — MVP vs. Later

### MVP
**Public:** landing/hero; services menu grouped by category (price + duration); booking stepper (**service → staff or "Any" → date/time → contact details → optional deposit → confirmation**); real availability from staff hours + existing appointments + service duration; confirmation page + email with cancel link.

**Admin CRM:** secure login (single Admin role, protected `/admin/*`); dashboard (today's appointments, revenue, KPIs); calendar (day/week, click to view/edit/cancel); clients list + profile + history; services CRUD + categories; staff CRUD + weekly working-hours editor; settings (salon name, timezone, slot interval, deposit %, payments on/off).

**Cross-cutting:** Stripe deposit (toggleable, webhook-confirmed); transactional emails; seed script with realistic data.

### Later (out of MVP)
Multiple admin roles; staff-facing logins; customer accounts + self-reschedule; SMS reminders; recurring appointments, packages, memberships, gift cards; inventory/POS/tips/payroll; reviews, loyalty, discount codes; calendar sync; multi-location/timezone; advanced analytics/CSV export; waitlist.

---

## 3. Data model (Prisma schema sketch)

`belza-salon/prisma/schema.prisma`

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }

model ServiceCategory {
  id String @id @default(cuid())
  name String
  description String?
  sortOrder Int @default(0)
  services Service[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Service {
  id String @id @default(cuid())
  name String
  description String?
  durationMinutes Int        // drives slot length
  priceCents Int             // store money as integer cents
  currency String @default("usd")
  bufferAfterMin Int @default(0)  // cleanup/turnaround
  isActive Boolean @default(true)
  sortOrder Int @default(0)
  categoryId String
  category ServiceCategory @relation(fields: [categoryId], references: [id])
  staff StaffService[]
  appointments Appointment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([categoryId]); @@index([isActive])
}

model Staff {
  id String @id @default(cuid())
  name String
  title String?
  bio String?
  imageUrl String?
  email String?
  isActive Boolean @default(true)
  sortOrder Int @default(0)
  services StaffService[]
  workingHours StaffWorkingHours[]
  timeOff StaffTimeOff[]
  appointments Appointment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([isActive])
}

model StaffService {  // many-to-many
  staffId String
  serviceId String
  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@id([staffId, serviceId]); @@index([serviceId])
}

// recurring weekly availability; dayOfWeek 0=Sun..6=Sat
// times = minutes-from-midnight in the salon timezone (540 = 09:00)
model StaffWorkingHours {
  id String @id @default(cuid())
  staffId String
  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  dayOfWeek Int      // 0..6
  startMinutes Int   // 0..1439
  endMinutes Int     // 0..1439, must be > startMinutes
  @@unique([staffId, dayOfWeek, startMinutes])  // allows split shifts
  @@index([staffId, dayOfWeek])
}

model StaffTimeOff {  // one-off blocks, stored UTC
  id String @id @default(cuid())
  staffId String
  staff Staff @relation(fields: [staffId], references: [id], onDelete: Cascade)
  startsAt DateTime
  endsAt DateTime
  reason String?
  @@index([staffId, startsAt, endsAt])
}

model Client {
  id String @id @default(cuid())
  firstName String
  lastName String?
  email String @unique
  phone String?
  notes String?            // admin-only
  marketingOptIn Boolean @default(false)
  appointments Appointment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([email])
}

enum AppointmentStatus { PENDING_PAYMENT CONFIRMED CANCELLED COMPLETED NO_SHOW }

model Appointment {
  id String @id @default(cuid())
  serviceId String
  service Service @relation(fields: [serviceId], references: [id])
  staffId String
  staff Staff @relation(fields: [staffId], references: [id])
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  startsAt DateTime           // UTC, inclusive
  endsAt DateTime             // UTC, exclusive = startsAt + duration + buffer
  status AppointmentStatus @default(CONFIRMED)
  priceCents Int              // snapshot at booking time
  currency String @default("usd")
  notes String?
  cancelToken String @unique @default(cuid())  // public cancel link
  source String @default("online")             // online | admin
  payment Payment?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([staffId, startsAt])  // blocks identical-start double-book
  @@index([startsAt]); @@index([staffId, startsAt, endsAt]); @@index([clientId]); @@index([status])
}

enum PaymentStatus { REQUIRES_PAYMENT SUCCEEDED FAILED REFUNDED }

model Payment {
  id String @id @default(cuid())
  appointmentId String @unique
  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  stripePaymentIntentId String @unique
  amountCents Int
  currency String @default("usd")
  status PaymentStatus @default(REQUIRES_PAYMENT)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([status])
}

model AdminUser {
  id String @id @default(cuid())
  email String @unique
  passwordHash String        // bcrypt/argon2
  name String?
  role String @default("ADMIN")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Settings {  // single row, id = "singleton"
  id String @id @default("singleton")
  salonName String @default("Belza")
  timezone String @default("America/New_York")  // IANA tz
  slotIntervalMin Int @default(15)
  leadTimeMinutes Int @default(120)
  maxAdvanceDays Int @default(60)
  depositPercent Int @default(0)
  currency String @default("usd")
  contactEmail String?
  contactPhone String?
  addressLine String?
  updatedAt DateTime @updatedAt
}
```

**Money:** always integer cents, never floats. **Time:** all `DateTime` are UTC; `StaffWorkingHours` uses minutes-from-midnight in `Settings.timezone`. **SQLite note:** Prisma enums aren't supported on SQLite — use Postgres locally via Docker so dev == prod.

---

## 4. Availability & booking logic

### 4.1 Slot generation (`GET /api/availability`, `lib/availability.ts`)
Inputs: `serviceId`, `staffId` (or `"any"`), `date` (YYYY-MM-DD salon tz).
1. Load `Settings`; reject dates outside `[today, today + maxAdvanceDays]`.
2. Load service → required block = `durationMinutes + bufferAfterMin`.
3. Resolve candidate staff (specific, or all active staff performing the service for "any").
4. For each staff + date: take `StaffWorkingHours` windows for that weekday, convert boundaries to **UTC instants** for that date via the salon tz (DST-safe). Step `slotIntervalMin` from window start, requiring `start + block <= windowEnd`. Drop candidates that: overlap an existing appointment (`status IN CONFIRMED, PENDING_PAYMENT, COMPLETED`; overlap = `existing.startsAt < candEnd && existing.endsAt > candStart`), overlap a `StaffTimeOff`, or are earlier than `now + leadTimeMinutes`.
5. For "any": union staff free starts; remember which staff are free per start.

Response: `{ slots: [{ startsAt (ISO UTC), staffId }] }`; UI renders in salon tz.

### 4.2 Double-booking prevention (`POST /api/bookings`, `lib/bookings.ts`)
Two layers, both required:
- **Layer 1 — DB unique constraint** `@@unique([staffId, startsAt])` rejects identical staff+start.
- **Layer 2 — Serializable transaction** for partial overlaps:

```ts
await prisma.$transaction(async (tx) => {
  const conflict = await tx.appointment.findFirst({
    where: { staffId, status: { in: ['CONFIRMED','PENDING_PAYMENT','COMPLETED'] },
             startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    select: { id: true },
  });
  if (conflict) throw new SlotTakenError();
  const client = await tx.client.upsert({ where: { email }, create: {...}, update: {...} });
  return tx.appointment.create({ data: { staffId, serviceId, clientId: client.id, startsAt, endsAt, priceCents, ... } });
}, { isolationLevel: 'Serializable' });
```

`endsAt = startsAt + duration + buffer`. Catch serialization error `40001` and Prisma `P2002` → **409 Conflict** ("slot just taken"). For "any", pick the first staff still free; if none, 409.

**Stale `PENDING_PAYMENT` cleanup:** Vercel Cron `GET /api/cron/expire-pending` cancels pending appointments older than 15 min so held slots release.

---

## 5. API / route design

**Public (Route Handlers, `src/app/api/...`):**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/services` | Active services + categories for the menu |
| GET | `/api/staff?serviceId=` | Staff who perform a service |
| GET | `/api/availability?serviceId=&staffId=&date=` | Bookable start times |
| POST | `/api/bookings` | Create appointment (txn §4.2) → `201 {appointmentId,status,payment?}` / `409` / `422` |
| POST | `/api/payments/intent` | Create/refresh PaymentIntent (if payments on) |
| POST | `/api/payments/webhook` | Stripe webhook, signature-verified |
| GET | `/api/bookings/[cancelToken]` | Booking summary for confirmation/cancel page |
| POST | `/api/bookings/[cancelToken]/cancel` | Customer self-cancel (lead-time gated) |

**Admin (Server Actions, `src/server/actions/*`, session-guarded):** `services.ts`, `staff.ts`, `appointments.ts`, `clients.ts`, `settings.ts` (CRUD + reschedule/cancel/complete/no-show). Admin **reads** (dashboard, calendar, lists) fetched directly in Server Components via Prisma; KPIs in `server/queries/metrics.ts`.

Split rationale: public/booking/Stripe need stable HTTP contracts → Route Handlers; admin mutations are same-origin + authenticated → Server Actions (built-in CSRF).

---

## 6. Payment flow (Stripe) + on/off toggle

**Toggle** — env `PAYMENTS_ENABLED` (default `false`), surfaced via `lib/config.ts`:
```ts
export const paymentsEnabled =
  process.env.PAYMENTS_ENABLED === 'true' &&
  !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
```
- **Off:** booking skips payment step; `/api/bookings` creates `CONFIRMED` directly; `/api/payments/*` return 403; Stripe SDK never instantiated (missing keys don't crash build).
- **On:** deposit = `round(priceCents * depositPercent / 100)`; if `depositPercent === 0`, no charge.

**Happy path (on):** `POST /api/bookings` → appointment `PENDING_PAYMENT` (slot held) → create Stripe PaymentIntent (`metadata.appointmentId`, idempotency key = appointmentId) → client confirms via Stripe Elements (card never touches our server) → webhook `payment_intent.succeeded` (verify signature on **raw** body, `runtime = 'nodejs'`) flips `Payment=SUCCEEDED` + `Appointment=CONFIRMED` + sends email, idempotent by PaymentIntent id.

**Critical:** appointments are confirmed **only by the verified webhook**, never by the browser. Reaper cron releases abandoned holds. Refunds: flag for manual handling in MVP.

---

## 7. Repo / folder structure (`belza-salon/`)

```
belza-salon/
├─ .env.example, .gitignore, next.config.ts, package.json, tsconfig.json
├─ tailwind.config.ts, components.json, vercel.json
├─ prisma/{schema.prisma, seed.ts, migrations/}
├─ public/images/
└─ src/
   ├─ app/
   │  ├─ layout.tsx, globals.css, page.tsx           # landing
   │  ├─ services/page.tsx                            # menu
   │  ├─ book/page.tsx, book/confirmation/[token]/page.tsx
   │  ├─ (admin)/admin/{layout,page,calendar,appointments/[id],clients,clients/[id],services,staff,settings}
   │  ├─ login/page.tsx
   │  └─ api/{services,staff,availability,bookings,bookings/[cancelToken],bookings/[cancelToken]/cancel,payments/intent,payments/webhook,cron/expire-pending}/route.ts
   ├─ components/{ui, booking, admin, marketing}
   ├─ server/{actions, queries}
   ├─ lib/{db,auth,availability,bookings,stripe,email,time,config,validations}.ts
   └─ middleware.ts                                   # protect /admin/*
```

---

## 8. Step-by-step deployment guide

> Run all commands inside `belza-salon/`. Node 20+.

### 8.1 Local setup
```bash
mkdir -p belza-salon && cd belza-salon
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"
npm i prisma @prisma/client zod next-auth@beta bcryptjs date-fns @date-fns/tz stripe resend nodemailer
npm i -D @types/bcryptjs @types/nodemailer tsx
npx shadcn@latest init
npx prisma init
```
`package.json`:
```jsonc
"prisma": { "seed": "tsx prisma/seed.ts" },
"scripts": { "dev": "next dev", "build": "prisma generate && next build",
  "db:migrate": "prisma migrate dev", "db:seed": "prisma db seed", "db:studio": "prisma studio" }
```
Local Postgres (keeps enums, matches prod):
```bash
docker run --name belza-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=belza -p 5432:5432 -d postgres:16
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/belza?schema=public"
```

### 8.2 Environment variables (`.env.example`)
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"   # Neon pooled
DIRECT_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"     # direct, for migrations
AUTH_SECRET="openssl rand -base64 32"
AUTH_URL="http://localhost:3000"            # prod: https://yourdomain.com
ADMIN_EMAIL="owner@salon.com"               # seed: first admin
ADMIN_PASSWORD="change-me-strong"           # seed only
PAYMENTS_ENABLED="false"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
EMAIL_PROVIDER="resend"                     # resend | smtp
RESEND_API_KEY="re_..."
EMAIL_FROM="Belza Salon <bookings@yourdomain.com>"
SMTP_HOST=""; SMTP_PORT="587"; SMTP_USER=""; SMTP_PASSWORD=""
CRON_SECRET="openssl rand -base64 32"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 8.3 Database (Neon)
New project → copy **pooled** string → `DATABASE_URL`, **direct** string → `DIRECT_URL` (both `?sslmode=require`). (Supabase alt: use Session pooler URL + direct URL.)

### 8.4 Migrate + seed
```bash
npx prisma migrate dev --name init
npm run db:seed
npm run dev   # http://localhost:3000 ; admin at /login
```

### 8.5 Stripe
1. API keys → `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Local: `stripe listen --forward-to localhost:3000/api/payments/webhook` → copy `whsec_...`; `stripe trigger payment_intent.succeeded`.
3. Prod: Webhooks → add endpoint `https://yourdomain.com/api/payments/webhook`, events `payment_intent.succeeded` + `payment_intent.payment_failed` → signing secret to Vercel.
4. Set `PAYMENTS_ENABLED=true` only after the webhook works.

### 8.6 Vercel
1. Push to GitHub → New Project → import repo.
2. **Set Root Directory to `belza-salon`** (essential — subdirectory app).
3. Add all env vars (Production + Preview); set `AUTH_URL`/`NEXT_PUBLIC_APP_URL` to deployed URL.
4. Build = `prisma generate && next build`.
5. Prod migrations: `npx prisma migrate deploy` + one-time `npx tsx prisma/seed.ts` against Neon. Never `migrate dev` on prod.
6. `vercel.json`: `{ "crons": [{ "path": "/api/cron/expire-pending", "schedule": "*/5 * * * *" }] }`

### 8.7 Custom domain
Vercel → Domains → add apex + `www`; set DNS at registrar (TLS automatic); update `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `EMAIL_FROM` domain, Stripe webhook URL; verify Resend sending domain (SPF/DKIM).

### 8.8 Go-live checklist
- [ ] Strong unique `AUTH_SECRET`, `CRON_SECRET`.
- [ ] First admin created; seed password rotated; `ADMIN_PASSWORD` removed.
- [ ] `Settings`: timezone, slot interval, deposit %, currency, contacts.
- [ ] Real services/categories/staff + **working hours** (no hours = no bookings).
- [ ] `migrate deploy` clean; tables verified in `prisma studio`.
- [ ] E2E booking with payments off → `CONFIRMED` + email.
- [ ] If charging: live Stripe keys + webhook, real-card test flips status via webhook.
- [ ] Concurrency: two browsers, same slot → one 409.
- [ ] Reaper: abandoned paid booking frees within ~15 min.
- [ ] `/admin/*` redirects to `/login` when logged out.
- [ ] Cancel link respects lead time; SEO/meta/favicon/OG set; error monitoring live.

---

## 9. Build order for Felix
1. Scaffold + DB (schema, migrate, seed; verify Prisma Studio).
2. Core libs (`db`, `time`, `config`, `validations`); unit-test time helpers.
3. Availability engine + `GET /api/services|staff|availability`; test slot math incl. DST.
4. Transactional booking + `POST /api/bookings` (payments off); concurrency 409 test; confirmation page.
5. Public UI: landing, menu, stepper wired to APIs; confirmation email.
6. Admin auth (`auth`, `middleware`, `/login`) + `/admin` shell guard.
7. Admin CRUD (Server Actions): services/categories, staff + hours, settings.
8. Admin calendar (day/week) + appointment detail + dashboard KPIs.
9. Clients list + profile + history.
10. Payments: `stripe.ts`, intent + webhook, deposit step, reaper cron; flip `PAYMENTS_ENABLED=true`, E2E test.
11. Polish (cancel email, SEO, error states) + deploy per §8.

**Acceptance:** a customer books a real service/staff/free-time, gets a confirmation email, optionally pays a deposit, and the slot becomes unbookable; admin logs in, sees today's appointments + revenue, manages calendar + CRUD; `PAYMENTS_ENABLED` toggles the deposit step cleanly with no crashes when Stripe keys absent; deploys to Vercel from `belza-salon/` root against Neon.
