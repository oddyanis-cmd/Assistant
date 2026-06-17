import { NextRequest, NextResponse } from 'next/server';
import { createBooking, SlotTakenError } from '@/lib/bookings';
import { createBookingSchema } from '@/lib/validations';
import { paymentsEnabled } from '@/lib/config';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const appointment = await createBooking(parsed.data);

    let clientSecret: string | null = null;
    let depositCents = 0;

    // If the appointment is PENDING_PAYMENT, create the Stripe PaymentIntent now
    if (appointment.status === 'PENDING_PAYMENT') {
      try {
        const settings    = await prisma.settings.findUnique({ where: { id: 'singleton' } });
        const depositPct  = settings?.depositPercent ?? 0;
        const amountCents = Math.round(appointment.priceCents * depositPct / 100);

        if (amountCents > 0) {
          const { getStripe } = await import('@/lib/stripe');
          const stripe = getStripe();

          const pi = await stripe.paymentIntents.create(
            {
              amount:   amountCents,
              currency: appointment.currency,
              metadata: { appointmentId: appointment.id },
            },
            { idempotencyKey: appointment.id },
          );

          await prisma.payment.create({
            data: {
              appointmentId:         appointment.id,
              stripePaymentIntentId: pi.id,
              amountCents,
              currency: appointment.currency,
              status:   'REQUIRES_PAYMENT',
            },
          });

          clientSecret = pi.client_secret;
          depositCents = amountCents;
        }
      } catch (stripeErr) {
        console.error('[api/bookings] Stripe error — cancelling held slot:', stripeErr);
        // Roll back: cancel the pending appointment so the slot is released
        await prisma.appointment.update({
          where: { id: appointment.id },
          data:  { status: 'CANCELLED' },
        });
        return NextResponse.json({ error: 'Payment initialisation failed. Please try again.' }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        appointmentId:  appointment.id,
        cancelToken:    appointment.cancelToken,
        status:         appointment.status,
        paymentsEnabled,
        ...(clientSecret ? { clientSecret, depositCents } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('[api/bookings] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
