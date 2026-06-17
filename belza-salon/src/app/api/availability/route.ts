import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/availability';
import { availabilityQuerySchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const parsed = availabilityQuerySchema.safeParse({
      serviceId: searchParams.get('serviceId'),
      staffId:   searchParams.get('staffId'),
      date:      searchParams.get('date'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', issues: parsed.error.issues }, { status: 422 });
    }

    const { serviceId, staffId, date } = parsed.data;

    const slots = await getAvailableSlots(serviceId, staffId, date);

    return NextResponse.json({
      slots: slots.map((s) => ({
        startsAt:  s.startsAt.toISOString(),
        staffId:   s.staffId,
        staffName: s.staffName,
      })),
    });
  } catch (err) {
    console.error('[api/availability] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
