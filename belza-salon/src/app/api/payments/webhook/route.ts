import { NextRequest, NextResponse } from 'next/server';
import { paymentsEnabled } from '@/lib/config';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/config';
import { sendConfirmationEmail } from '@/lib/email';

// Node runtime required for raw body access (Stripe signature verification)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!paymentsEnabled) {
    return NextResponse.json(
      { error: 'Payments are not enabled on this instance.' },
      { status: 403 },
    );
  }

  const sig     = req.headers.get('stripe-signature');
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: import('stripe').default.Event;
  try {
    const { getStripe } = await import('@/lib/stripe');
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as import('stripe').default.PaymentIntent;

    // Idempotent: check if already processed
    const payment = await prisma.payment.findUnique({
      where:   { stripePaymentIntentId: pi.id },
      include: {
        appointment: {
          include: {
            client:  true,
            service: true,
            staff:   true,
          },
        },
      },
    });

    if (!payment) {
      console.warn('[webhook] payment_intent.succeeded: no matching Payment record for', pi.id);
      return NextResponse.json({ received: true });
    }

    if (payment.status === 'SUCCEEDED') {
      // Already processed — idempotent return
      return NextResponse.json({ received: true });
    }

    // Flip payment + appointment status
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data:  { status: 'SUCCEEDED' },
      }),
      prisma.appointment.update({
        where: { id: payment.appointmentId },
        data:  { status: 'CONFIRMED' },
      }),
    ]);

    // Send confirmation email
    const appt     = payment.appointment;
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
    const cancelUrl = `${appUrl}/book/confirmation/${appt.cancelToken}`;

    sendConfirmationEmail({
      to:          appt.client.email,
      firstName:   appt.client.firstName,
      serviceName: appt.service.name,
      staffName:   appt.staff.name,
      startsAt:    appt.startsAt,
      endsAt:      appt.endsAt,
      priceCents:  appt.priceCents,
      currency:    appt.currency,
      cancelUrl,
      timezone:    settings?.timezone ?? 'America/New_York',
      salonName:   settings?.salonName ?? 'Belza',
      addressLine: settings?.addressLine ?? '',
    }).catch((err) => console.error('[webhook] email send failed:', err));

    console.log(`[webhook] payment_intent.succeeded: confirmed appointment ${payment.appointmentId}`);
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as import('stripe').default.PaymentIntent;
    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: pi.id },
      data:  { status: 'FAILED' },
    });
    console.log(`[webhook] payment_intent.payment_failed for PI ${pi.id}`);
  }

  return NextResponse.json({ received: true });
}
