-- =============================================================================
-- Shiny Beauty Center — Catalog + Staff Seed (Phase 2)
-- File: supabase/seed_catalog.sql
-- Idempotent: run after 001_schema.sql and seed.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SERVICE CATEGORIES
-- ---------------------------------------------------------------------------
insert into public.service_categories (id, name_en, name_ar, sort_order, is_active) values
  ('c0000001-0000-0000-0000-000000000001', 'Massages',        'المساج',            1, true),
  ('c0000001-0000-0000-0000-000000000002', 'Facials',         'العناية بالبشرة',   2, true),
  ('c0000001-0000-0000-0000-000000000003', 'Lash Services',   'خدمات الرموش',      3, true),
  ('c0000001-0000-0000-0000-000000000004', 'Manicure',        'مانيكير',           4, true),
  ('c0000001-0000-0000-0000-000000000005', 'Pedicure',        'باديكير',           5, true),
  ('c0000001-0000-0000-0000-000000000006', 'Moroccan Bath',   'الحمام المغربي',    6, true)
on conflict (id) do update set
  name_en    = excluded.name_en,
  name_ar    = excluded.name_ar,
  sort_order = excluded.sort_order,
  is_active  = excluded.is_active;

-- ---------------------------------------------------------------------------
-- SERVICES
-- ---------------------------------------------------------------------------
insert into public.services
  (id, category_id, name_en, name_ar, description_en, description_ar,
   price, duration_minutes, is_active)
values

  -- ── Massages ──────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000001',
   'Swedish Relaxation Massage',
   'مساج سويدي استرخائي',
   'A full-body Swedish massage using light to medium pressure to ease tension, improve circulation, and leave you deeply relaxed.',
   'مساج سويدي على الجسم كاملاً بضغط خفيف إلى متوسط لتخفيف التوتر وتحسين الدورة الدموية وترك الجسم في حالة من الاسترخاء العميق.',
   220.00, 60, true),

  ('a0000001-0000-0000-0000-000000000002',
   'c0000001-0000-0000-0000-000000000001',
   'Deep Tissue Massage',
   'مساج الأنسجة العميقة',
   'Targets deep muscle layers to release chronic tension and knots. Ideal for active women and those with persistent stiffness.',
   'يستهدف طبقات العضلات العميقة لتحرير التوتر المزمن والعقد. مثالي للنساء النشطات ومن يعانين من التيبس المستمر.',
   280.00, 75, true),

  ('a0000001-0000-0000-0000-000000000003',
   'c0000001-0000-0000-0000-000000000001',
   'Hot Stone Massage',
   'مساج الأحجار الساخنة',
   'Smooth heated basalt stones melt away tension while warm oil nourishes your skin. A truly luxurious experience.',
   'أحجار بازلتية ملساء ساخنة تذيب التوتر بينما يغذي الزيت الدافئ بشرتك. تجربة فاخرة بحق.',
   350.00, 90, true),

  -- ── Facials ───────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000004',
   'c0000001-0000-0000-0000-000000000002',
   'Classic Hydrating Facial',
   'تنظيف بشرة كلاسيكي مرطب',
   'Deep cleanse, exfoliation, and a moisturising mask tailored to your skin type. Leaves skin glowing and refreshed.',
   'تنظيف عميق وتقشير وقناع مرطب مصمم لنوع بشرتك. يترك البشرة مشرقة ومنتعشة.',
   180.00, 60, true),

  ('a0000001-0000-0000-0000-000000000005',
   'c0000001-0000-0000-0000-000000000002',
   'Anti-Aging Facial',
   'علاج تجديد شباب البشرة',
   'Advanced firming treatment with collagen-boosting serums and a lifting massage to visibly reduce fine lines.',
   'علاج شد متقدم بأمصال مقوية للكولاجين ومساج رافع لتقليل الخطوط الدقيقة بشكل واضح.',
   320.00, 75, true),

  ('a0000001-0000-0000-0000-000000000006',
   'c0000001-0000-0000-0000-000000000002',
   'Brightening Vitamin C Facial',
   'علاج الإشراق بفيتامين سي',
   'A radiance-boosting facial using vitamin C serums and antioxidant-rich masks to even skin tone and restore natural glow.',
   'علاج لتعزيز الإشراق باستخدام أمصال فيتامين سي وأقنعة غنية بمضادات الأكسدة لتوحيد لون البشرة واستعادة التوهج الطبيعي.',
   250.00, 60, true),

  -- ── Lash Services ─────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000007',
   'c0000001-0000-0000-0000-000000000003',
   'Classic Lash Extensions',
   'وصلات رموش كلاسيكية',
   'One silk extension per natural lash for a beautifully natural, lengthened look. Long-lasting and feather-light.',
   'امتداد حريري واحد لكل رمشة طبيعية لمظهر جميل وطبيعي وممدود. طويل الأمد وخفيف كالريشة.',
   180.00, 90, true),

  ('a0000001-0000-0000-0000-000000000008',
   'c0000001-0000-0000-0000-000000000003',
   'Volume Lash Extensions',
   'وصلات رموش حجمية',
   'Multiple ultra-fine extensions per lash for dramatic, full-fan volume. Perfect for a glamorous, made-up look.',
   'امتدادات فائقة النعومة متعددة لكل رمشة لحجم مروحي ودرامي مكثف. مثالية للمظهر الجذاب.',
   260.00, 120, true),

  ('a0000001-0000-0000-0000-000000000009',
   'c0000001-0000-0000-0000-000000000003',
   'Lash Lift & Tint',
   'رفع وتلوين الرموش',
   'Curl and lift your natural lashes from the root, then tint them for a mascara-free darkened look that lasts 6–8 weeks.',
   'تجعيل ورفع رموشك الطبيعية من الجذر ثم تلوينها للحصول على مظهر داكن بدون ماسكارا يدوم 6-8 أسابيع.',
   150.00, 60, true),

  -- ── Manicure ──────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000010',
   'c0000001-0000-0000-0000-000000000004',
   'Classic Manicure',
   'مانيكير كلاسيكي',
   'Nail shaping, cuticle care, hand massage, and your choice of polish for beautifully groomed hands.',
   'تشكيل الأظافر والعناية بالقشرة ومساج اليدين ولون طلاء من اختيارك لأيدي مرتبة بشكل جميل.',
   80.00, 45, true),

  ('a0000001-0000-0000-0000-000000000011',
   'c0000001-0000-0000-0000-000000000004',
   'Gel Manicure',
   'مانيكير جيل',
   'Long-lasting gel polish that stays chip-free for up to 3 weeks. Includes shaping, cuticle work, and UV-cured colour.',
   'طلاء جيل طويل الأمد يبقى بدون تقشير لمدة تصل إلى 3 أسابيع. يشمل التشكيل والعناية بالقشرة واللون المعالج بالأشعة فوق البنفسجية.',
   120.00, 60, true),

  ('a0000001-0000-0000-0000-000000000012',
   'c0000001-0000-0000-0000-000000000004',
   'Nail Art Design',
   'تصميم نقش الأظافر',
   'Express your personality with hand-painted nail art. From minimalist lines to intricate florals — designed just for you.',
   'عبري عن شخصيتك بنقش أظافر مرسوم يدوياً. من الخطوط البسيطة إلى الزهور المعقدة — مصمم خصيصاً لك.',
   150.00, 75, true),

  -- ── Pedicure ──────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000013',
   'c0000001-0000-0000-0000-000000000005',
   'Classic Pedicure',
   'باديكير كلاسيكي',
   'Foot soak, callus removal, nail shaping, cuticle care, foot massage, and polish for beautifully soft feet.',
   'نقع القدمين وإزالة الجلد الميت وتشكيل الأظافر والعناية بالقشرة ومساج القدمين والطلاء لقدمين ناعمتين.',
   100.00, 60, true),

  ('a0000001-0000-0000-0000-000000000014',
   'c0000001-0000-0000-0000-000000000005',
   'Luxury Spa Pedicure',
   'باديكير سبا فاخر',
   'An indulgent pedicure with exfoliating scrub, nourishing paraffin wax, hot towel wrap, and extended foot-and-calf massage.',
   'باديكير متميز مع مقشر للجلد، شمع البارافين المغذي، ضمادة المنشفة الساخنة، ومساج موسع للقدم والساق.',
   180.00, 90, true),

  -- ── Moroccan Bath ─────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000015',
   'c0000001-0000-0000-0000-000000000006',
   'Classic Moroccan Hammam',
   'الحمام المغربي الكلاسيكي',
   'Traditional steam session followed by a thorough exfoliation with the iconic Kessa glove and black soap, then a moisturising mask.',
   'جلسة بخار تقليدية تليها تقشير شامل بقفاز الكيسة المميز والصابون البلدي ثم قناع مرطب.',
   300.00, 90, true),

  ('a0000001-0000-0000-0000-000000000016',
   'c0000001-0000-0000-0000-000000000006',
   'Signature Hammam & Massage',
   'حمام مغربي مميز مع مساج',
   'Our signature luxury experience: classic Hammam exfoliation followed by a full relaxation massage with argan-infused oil.',
   'تجربتنا الفاخرة المميزة: تقشير الحمام الكلاسيكي متبوعاً بمساج استرخاء كامل بزيت الأرغان.',
   480.00, 150, true)

on conflict (id) do update set
  name_en          = excluded.name_en,
  name_ar          = excluded.name_ar,
  description_en   = excluded.description_en,
  description_ar   = excluded.description_ar,
  price            = excluded.price,
  duration_minutes = excluded.duration_minutes,
  is_active        = excluded.is_active;

-- ---------------------------------------------------------------------------
-- STAFF PROFILES
-- Staff users live in auth.users; in seed we use profiles with fixed UUIDs
-- and link staff_profiles to them. If auth.users rows don't exist yet (offline
-- seed), we insert placeholder profiles directly.
-- ---------------------------------------------------------------------------

-- Placeholder auth user rows (only insert if not present)
insert into auth.users (id, email, role, created_at, updated_at, raw_user_meta_data)
values
  ('e0000001-0000-0000-0000-000000000001', 'layla@shiny.sa',    'authenticated', now(), now(),
   '{"full_name":"Layla Al-Rashidi"}'),
  ('e0000001-0000-0000-0000-000000000002', 'hessa@shiny.sa',    'authenticated', now(), now(),
   '{"full_name":"Hessa Al-Otaibi"}'),
  ('e0000001-0000-0000-0000-000000000003', 'noura@shiny.sa',    'authenticated', now(), now(),
   '{"full_name":"Noura Al-Harbi"}')
on conflict (id) do nothing;

-- Profiles
insert into public.profiles (id, full_name, phone, locale, is_active)
values
  ('e0000001-0000-0000-0000-000000000001', 'Layla Al-Rashidi', '+966501110001', 'ar', true),
  ('e0000001-0000-0000-0000-000000000002', 'Hessa Al-Otaibi',  '+966501110002', 'ar', true),
  ('e0000001-0000-0000-0000-000000000003', 'Noura Al-Harbi',   '+966501110003', 'ar', true)
on conflict (id) do update set
  full_name  = excluded.full_name,
  phone      = excluded.phone,
  is_active  = excluded.is_active;

-- Staff profiles
insert into public.staff_profiles (id, user_id, bio, specialties, color_hex, is_active)
values
  ('f0000001-0000-0000-0000-000000000001',
   'e0000001-0000-0000-0000-000000000001',
   'Layla is a certified massage therapist with 8 years of experience specialising in relaxation and deep-tissue techniques.',
   array['Massage','Body Treatments'],
   '#fda4af', true),

  ('f0000001-0000-0000-0000-000000000002',
   'e0000001-0000-0000-0000-000000000002',
   'Hessa is a licensed aesthetician and lash artist with 6 years of expertise in advanced facials and lash extensions.',
   array['Facials','Lash Extensions','Lash Lift'],
   '#c4b5fd', true),

  ('f0000001-0000-0000-0000-000000000003',
   'e0000001-0000-0000-0000-000000000003',
   'Noura is a nail technician and Hammam specialist with 5 years of experience creating stunning nail art and authentic Hammam experiences.',
   array['Manicure','Pedicure','Moroccan Bath'],
   '#86efac', true)
on conflict (id) do update set
  bio         = excluded.bio,
  specialties = excluded.specialties,
  color_hex   = excluded.color_hex,
  is_active   = excluded.is_active;

-- ---------------------------------------------------------------------------
-- STAFF AVAILABILITY (working hours: Sun–Thu 10:00–20:00, Fri off, Sat 11:00–18:00)
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
-- ---------------------------------------------------------------------------
do $$
declare
  sp1 uuid := 'f0000001-0000-0000-0000-000000000001';  -- Layla
  sp2 uuid := 'f0000001-0000-0000-0000-000000000002';  -- Hessa
  sp3 uuid := 'f0000001-0000-0000-0000-000000000003';  -- Noura
  d smallint;
begin
  -- Working days Sun–Thu (0–4) for all three staff
  foreach d in array array[0,1,2,3,4] loop
    insert into public.staff_availability (staff_id, day_of_week, start_time, end_time, is_available)
    values
      (sp1, d, '10:00', '20:00', true),
      (sp2, d, '10:00', '20:00', true),
      (sp3, d, '10:00', '20:00', true)
    on conflict (staff_id, day_of_week) do update set
      start_time   = excluded.start_time,
      end_time     = excluded.end_time,
      is_available = excluded.is_available;
  end loop;

  -- Friday off
  insert into public.staff_availability (staff_id, day_of_week, start_time, end_time, is_available)
  values
    (sp1, 5, '10:00', '20:00', false),
    (sp2, 5, '10:00', '20:00', false),
    (sp3, 5, '10:00', '20:00', false)
  on conflict (staff_id, day_of_week) do update set
    is_available = false;

  -- Saturday shorter hours
  insert into public.staff_availability (staff_id, day_of_week, start_time, end_time, is_available)
  values
    (sp1, 6, '11:00', '18:00', true),
    (sp2, 6, '11:00', '18:00', true),
    (sp3, 6, '11:00', '18:00', true)
  on conflict (staff_id, day_of_week) do update set
    start_time   = excluded.start_time,
    end_time     = excluded.end_time,
    is_available = excluded.is_available;
end;
$$;

-- ---------------------------------------------------------------------------
-- CLIENTS (sample clients for dev/demo)
-- ---------------------------------------------------------------------------
insert into public.clients
  (id, user_id, full_name, phone, email, locale, is_active)
values
  ('cb000001-0000-0000-0000-000000000001',
   null, 'Sara Mohammed Al-Qasim', '+966507771001', 'sara@example.com', 'ar', true),
  ('cb000001-0000-0000-0000-000000000002',
   null, 'Fatima Khalid Al-Zahrani', '+966507771002', 'fatima@example.com', 'ar', true),
  ('cb000001-0000-0000-0000-000000000003',
   null, 'Aisha Ibrahim Al-Dosari', '+966507771003', 'aisha@example.com', 'en', true),
  ('cb000001-0000-0000-0000-000000000004',
   null, 'Rima Nasser Al-Mutairi', '+966507771004', 'rima@example.com', 'ar', true)
on conflict (id) do update set
  full_name  = excluded.full_name,
  phone      = excluded.phone,
  email      = excluded.email,
  is_active  = excluded.is_active;

-- ---------------------------------------------------------------------------
-- SAMPLE APPOINTMENTS (future dates, for My Appointments demo)
-- Calculated relative to a fixed anchor so the seed remains runnable at any time.
-- ---------------------------------------------------------------------------
insert into public.appointments
  (id, client_id, staff_id, service_id, status, start_at, end_at)
values
  -- Confirmed upcoming — Classic Facial with Hessa, 2 days from now at 11:00
  ('ad000001-0000-0000-0000-000000000001',
   'cb000001-0000-0000-0000-000000000001',
   'f0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000004',
   'confirmed',
   (current_date + interval '2 days')::timestamptz + interval '11 hours',
   (current_date + interval '2 days')::timestamptz + interval '12 hours'),

  -- Confirmed upcoming — Swedish Massage with Layla, 5 days from now at 14:00
  ('ad000001-0000-0000-0000-000000000002',
   'cb000001-0000-0000-0000-000000000002',
   'f0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   'confirmed',
   (current_date + interval '5 days')::timestamptz + interval '14 hours',
   (current_date + interval '5 days')::timestamptz + interval '15 hours'),

  -- Completed past — Lash Lift with Hessa, 10 days ago
  ('ad000001-0000-0000-0000-000000000003',
   'cb000001-0000-0000-0000-000000000001',
   'f0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000009',
   'completed',
   (current_date - interval '10 days')::timestamptz + interval '11 hours',
   (current_date - interval '10 days')::timestamptz + interval '12 hours'),

  -- Completed past — Moroccan Hammam with Noura, 20 days ago
  ('ad000001-0000-0000-0000-000000000004',
   'cb000001-0000-0000-0000-000000000003',
   'f0000001-0000-0000-0000-000000000003',
   'a0000001-0000-0000-0000-000000000015',
   'completed',
   (current_date - interval '20 days')::timestamptz + interval '13 hours',
   (current_date - interval '20 days')::timestamptz + interval '14 hours' + interval '30 minutes')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- LOYALTY POINTS for sample clients
-- ---------------------------------------------------------------------------
insert into public.loyalty_points (client_id, points, reason, ref_type)
values
  ('cb000001-0000-0000-0000-000000000001', 22,  'Completed appointment', 'appointment'),
  ('cb000001-0000-0000-0000-000000000001', 30,  'Completed appointment', 'appointment'),
  ('cb000001-0000-0000-0000-000000000002', 22,  'Completed appointment', 'appointment'),
  ('cb000001-0000-0000-0000-000000000003', 30,  'Completed appointment', 'appointment');
