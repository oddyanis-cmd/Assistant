import { NextRequest, NextResponse } from 'next/server';
import { createBooking, SlotTakenError } from '@/lib/bookings';
import { createBookingSchema } from '@/lib/validations';
import { paymentsEnabled } from '@/lib/config';

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

    // Payments off: appointment is immediately CONFIRMED
    // Payments on: would return PENDING_PAYMENT + payment intent (next milestone)
    return NextResponse.json(
      {
        appointmentId: appointment.id,
        cancelToken:   appointment.cancelToken,
        status:        appointment.status,
        paymentsEnabled,
        // payment field: undefined in payments-off path
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
