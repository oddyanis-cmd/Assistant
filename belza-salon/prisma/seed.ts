import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Belza Salon database...');

  // ── Settings singleton ────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id:              'singleton',
      salonName:       'Belza',
      timezone:        'America/New_York',
      slotIntervalMin: 15,
      leadTimeMinutes: 120,
      maxAdvanceDays:  60,
      depositPercent:  0,
      currency:        'usd',
      contactEmail:    'hello@belzasalon.com',
      contactPhone:    '+1 (212) 555-0182',
      addressLine:     '182 Spring Street, New York, NY 10012',
    },
  });

  // ── Admin user ────────────────────────────────────────────────────
  const adminEmail    = process.env.ADMIN_EMAIL    ?? 'admin@belzasalon.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-strong';
  const passwordHash  = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where:  { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash, name: 'Salon Owner', role: 'ADMIN' },
  });

  // ── Service categories ────────────────────────────────────────────
  const catHair = await prisma.serviceCategory.upsert({
    where:  { id: 'cat-hair' },
    update: {},
    create: {
      id:          'cat-hair',
      name:        'Hair Colour',
      description: 'Precision colour work using Schwarzkopf Professional and L\'Oréal Paris.',
      sortOrder:   1,
    },
  });

  const catCuts = await prisma.serviceCategory.upsert({
    where:  { id: 'cat-cuts' },
    update: {},
    create: {
      id:          'cat-cuts',
      name:        'Cuts & Styling',
      description: 'From everyday precision cuts to full blow-dry and event styling.',
      sortOrder:   2,
    },
  });

  const catTreatments = await prisma.serviceCategory.upsert({
    where:  { id: 'cat-treat' },
    update: {},
    create: {
      id:          'cat-treat',
      name:        'Treatments',
      description: 'Keratin, deep conditioning, scalp therapy and more.',
      sortOrder:   3,
    },
  });

  // ── Services ──────────────────────────────────────────────────────
  const svcBalayage = await prisma.service.upsert({
    where:  { id: 'svc-balayage' },
    update: {},
    create: {
      id:              'svc-balayage',
      name:            'Balayage & Toner',
      description:     'Hand-painted highlights with custom toner for a natural sun-kissed look.',
      durationMinutes: 150,
      priceCents:      12000,
      bufferAfterMin:  15,
      isActive:        true,
      sortOrder:       1,
      categoryId:      catHair.id,
    },
  });

  const svcFullColour = await prisma.service.upsert({
    where:  { id: 'svc-fullcolour' },
    update: {},
    create: {
      id:              'svc-fullcolour',
      name:            'Full Colour',
      description:     'All-over root-to-tip colour with consultation and gloss finish.',
      durationMinutes: 90,
      priceCents:      8500,
      bufferAfterMin:  10,
      isActive:        true,
      sortOrder:       2,
      categoryId:      catHair.id,
    },
  });

  const svcRootTouchup = await prisma.service.upsert({
    where:  { id: 'svc-roottouchup' },
    update: {},
    create: {
      id:              'svc-roottouchup',
      name:            'Root Touch-Up',
      description:     'Targeted root coverage blended seamlessly with existing colour.',
      durationMinutes: 60,
      priceCents:      6000,
      bufferAfterMin:  10,
      isActive:        true,
      sortOrder:       3,
      categoryId:      catHair.id,
    },
  });

  const svcPrecisionCut = await prisma.service.upsert({
    where:  { id: 'svc-precisioncut' },
    update: {},
    create: {
      id:              'svc-precisioncut',
      name:            'Precision Haircut',
      description:     'Expert cut tailored to your face shape and lifestyle. Includes wash and blow-dry finish.',
      durationMinutes: 60,
      priceCents:      5500,
      bufferAfterMin:  10,
      isActive:        true,
      sortOrder:       1,
      categoryId:      catCuts.id,
    },
  });

  const svcBlowDry = await prisma.service.upsert({
    where:  { id: 'svc-blowdry' },
    update: {},
    create: {
      id:              'svc-blowdry',
      name:            'Blow-Dry & Style',
      description:     'Wash, condition and professional blow-dry to your chosen finish.',
      durationMinutes: 45,
      priceCents:      4000,
      bufferAfterMin:  5,
      isActive:        true,
      sortOrder:       2,
      categoryId:      catCuts.id,
    },
  });

  const svcKeratin = await prisma.service.upsert({
    where:  { id: 'svc-keratin' },
    update: {},
    create: {
      id:              'svc-keratin',
      name:            'Keratin Treatment',
      description:     'Smoothing keratin treatment that eliminates frizz and adds brilliant shine for up to 3 months.',
      durationMinutes: 180,
      priceCents:      22000,
      bufferAfterMin:  15,
      isActive:        true,
      sortOrder:       1,
      categoryId:      catTreatments.id,
    },
  });

  const svcDeepCondition = await prisma.service.upsert({
    where:  { id: 'svc-deepcondition' },
    update: {},
    create: {
      id:              'svc-deepcondition',
      name:            'Deep Conditioning Mask',
      description:     'Intensive hydration and repair treatment with steam activation for all hair types.',
      durationMinutes: 45,
      priceCents:      5500,
      bufferAfterMin:  5,
      isActive:        true,
      sortOrder:       2,
      categoryId:      catTreatments.id,
    },
  });

  const svcScalpTherapy = await prisma.service.upsert({
    where:  { id: 'svc-scalptherapy' },
    update: {},
    create: {
      id:              'svc-scalptherapy',
      name:            'Scalp Therapy',
      description:     'Professional scalp analysis and targeted treatment for dandruff, oiliness, or hair loss.',
      durationMinutes: 60,
      priceCents:      7500,
      bufferAfterMin:  10,
      isActive:        true,
      sortOrder:       3,
      categoryId:      catTreatments.id,
    },
  });

  // ── Staff ─────────────────────────────────────────────────────────
  const staffElena = await prisma.staff.upsert({
    where:  { id: 'staff-elena' },
    update: {},
    create: {
      id:       'staff-elena',
      name:     'Elena Martinez',
      title:    'Senior Colour Specialist',
      bio:      'Elena has 10+ years of experience in hair colouring and has trained with top colourists in New York and Paris. She specialises in balayage, colour corrections, and transformative styles.',
      email:    'elena@belzasalon.com',
      isActive: true,
      sortOrder: 1,
    },
  });

  const staffKai = await prisma.staff.upsert({
    where:  { id: 'staff-kai' },
    update: {},
    create: {
      id:       'staff-kai',
      name:     'Kai Thompson',
      title:    'Creative Director & Stylist',
      bio:      'Kai brings a bold, fashion-forward approach to every cut. With a background in editorial styling, they excel at precision cuts, textured styles, and men\'s grooming.',
      email:    'kai@belzasalon.com',
      isActive: true,
      sortOrder: 2,
    },
  });

  const staffSara = await prisma.staff.upsert({
    where:  { id: 'staff-sara' },
    update: {},
    create: {
      id:       'staff-sara',
      name:     'Sara Linden',
      title:    'Hair & Scalp Therapist',
      bio:      'Sara combines technical skill with a holistic approach. Certified in trichology, she specialises in hair treatments, scalp health, and restorative services.',
      email:    'sara@belzasalon.com',
      isActive: true,
      sortOrder: 3,
    },
  });

  // ── Staff ↔ Service links ─────────────────────────────────────────
  const staffServiceLinks = [
    // Elena: all colour + balayage + cuts
    { staffId: staffElena.id, serviceId: svcBalayage.id },
    { staffId: staffElena.id, serviceId: svcFullColour.id },
    { staffId: staffElena.id, serviceId: svcRootTouchup.id },
    { staffId: staffElena.id, serviceId: svcPrecisionCut.id },
    // Kai: cuts + styling + some colour
    { staffId: staffKai.id, serviceId: svcPrecisionCut.id },
    { staffId: staffKai.id, serviceId: svcBlowDry.id },
    { staffId: staffKai.id, serviceId: svcFullColour.id },
    { staffId: staffKai.id, serviceId: svcRootTouchup.id },
    // Sara: treatments + cuts
    { staffId: staffSara.id, serviceId: svcKeratin.id },
    { staffId: staffSara.id, serviceId: svcDeepCondition.id },
    { staffId: staffSara.id, serviceId: svcScalpTherapy.id },
    { staffId: staffSara.id, serviceId: svcPrecisionCut.id },
    { staffId: staffSara.id, serviceId: svcBlowDry.id },
  ];

  for (const link of staffServiceLinks) {
    await prisma.staffService.upsert({
      where:  { staffId_serviceId: { staffId: link.staffId, serviceId: link.serviceId } },
      update: {},
      create: link,
    });
  }

  // ── Working hours (Mon–Sat, 9am–6pm; Sun closed) ──────────────────
  // Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // 540 = 9:00, 1080 = 18:00
  const workDays = [1, 2, 3, 4, 5]; // Mon–Fri
  const satDay   = [6];              // Sat

  for (const staff of [staffElena, staffKai, staffSara]) {
    for (const day of workDays) {
      await prisma.staffWorkingHours.upsert({
        where:  { staffId_dayOfWeek_startMinutes: { staffId: staff.id, dayOfWeek: day, startMinutes: 540 } },
        update: {},
        create: {
          staffId:      staff.id,
          dayOfWeek:    day,
          startMinutes: 540,  // 9:00 AM
          endMinutes:   1080, // 6:00 PM
        },
      });
    }
    for (const day of satDay) {
      await prisma.staffWorkingHours.upsert({
        where:  { staffId_dayOfWeek_startMinutes: { staffId: staff.id, dayOfWeek: day, startMinutes: 540 } },
        update: {},
        create: {
          staffId:      staff.id,
          dayOfWeek:    day,
          startMinutes: 540,  // 9:00 AM
          endMinutes:   1020, // 5:00 PM
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Categories: Hair Colour, Cuts & Styling, Treatments`);
  console.log(`  Services: 8`);
  console.log(`  Staff: Elena Martinez, Kai Thompson, Sara Linden`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
