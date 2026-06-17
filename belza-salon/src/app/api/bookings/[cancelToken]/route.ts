import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cancelToken: string }> },
) {
  try {
    const { cancelToken } = await params;

    const appointment = await prisma.appointment.findUnique({
      where:   { cancelToken },
      include: {
        service: { select: { name: true, durationMinutes: true, bufferAfterMin: true } },
        staff:   { select: { name: true, title: true } },
        client:  { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({
      id:          appointment.id,
      cancelToken: appointment.cancelToken,
      status:      appointment.status,
      startsAt:    appointment.startsAt.toISOString(),
      endsAt:      appointment.endsAt.toISOString(),
      priceCents:  appointment.priceCents,
      currency:    appointment.currency,
      notes:       appointment.notes,
      service:     appointment.service,
      staff:       appointment.staff,
      client: {
        firstName: appointment.client.firstName,
        lastName:  appointment.client.lastName,
        email:     appointment.client.email,
      },
    });
  } catch (err) {
    console.error('[api/bookings/[cancelToken]] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
