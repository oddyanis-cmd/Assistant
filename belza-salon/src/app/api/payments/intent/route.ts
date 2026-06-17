import { NextRequest, NextResponse } from 'next/server';
import { paymentsEnabled } from '@/lib/config';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({ appointmentId: z.string().min(1) });

export async function POST(req: NextRequest) {
  if (!paymentsEnabled) {
    return NextResponse.json(
      { error: 'Payments are not enabled on this instance.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing appointmentId' }, { status: 422 });

  const { appointmentId } = parsed.data;

  const appt = await prisma.appointment.findUnique({
    where:   { id: appointmentId },
    include: { payment: true, service: true },
  });
  if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

  // Idempotent: return existing intent if already created
  if (appt.payment?.stripePaymentIntentId) {
    const { getStripe } = await import('@/lib/stripe');
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(appt.payment.stripePaymentIntentId);
    return NextResponse.json({ clientSecret: pi.client_secret });
  }

  // Calculate deposit amount
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  const depositPct = settings?.depositPercent ?? 0;
  const amountCents = Math.round(appt.priceCents * depositPct / 100);

  if (amountCents <= 0) {
    // 0% deposit — nothing to charge; confirm directly
    await prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'CONFIRMED' } });
    return NextResponse.json({ status: 'confirmed', clientSecret: null });
  }

  const { getStripe } = await import('@/lib/stripe');
  const stripe = getStripe();

  const pi = await stripe.paymentIntents.create(
    {
      amount:   amountCents,
      currency: appt.currency,
      metadata: { appointmentId },
    },
    { idempotencyKey: appointmentId },
  );

  // Persist the payment record
  await prisma.payment.create({
    data: {
      appointmentId,
      stripePaymentIntentId: pi.id,
      amountCents,
      currency: appt.currency,
      status:   'REQUIRES_PAYMENT',
    },
  });

  return NextResponse.json({ clientSecret: pi.client_secret });
}
