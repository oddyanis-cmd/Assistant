import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cancelBookingSchema } from '@/lib/validations';
import { addMinutes } from 'date-fns';

export const dynamic = 'force-dynamic';

// Lead-time gate: customers may cancel up to 24 hours before the appointment
const CANCEL_LEAD_HOURS = 24;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cancelToken: string }> },
) {
  try {
    const { cancelToken } = await params;
    const body   = await req.json().catch(() => ({}));
    const parsed = cancelBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const appointment = await prisma.appointment.findUnique({ where: { cancelToken } });

    if (!appointment) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (appointment.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 409 });
    }

    if (['COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
      return NextResponse.json({ error: 'Completed appointments cannot be cancelled' }, { status: 409 });
    }

    // Lead-time gate
    const now           = new Date();
    const cancelDeadline = new Date(appointment.startsAt.getTime() - CANCEL_LEAD_HOURS * 60 * 60 * 1000);
    if (now > cancelDeadline) {
      return NextResponse.json(
        { error: `Cancellations must be made at least ${CANCEL_LEAD_HOURS} hours in advance.` },
        { status: 409 },
      );
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data:  { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true, appointmentId: appointment.id });
  } catch (err) {
    console.error('[api/bookings/[cancelToken]/cancel] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
