import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cronSecret } from '@/lib/config';
import { addMinutes } from 'date-fns';

export const dynamic = 'force-dynamic';

// Called by Vercel Cron every 5 min (vercel.json).
// Releases PENDING_PAYMENT slots abandoned for > 15 minutes.
const PENDING_EXPIRY_MINUTES = 15;

export async function GET(req: NextRequest) {
  // Verify cron secret when set
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const cutoff = addMinutes(new Date(), -PENDING_EXPIRY_MINUTES);

  const { count } = await prisma.appointment.updateMany({
    where: {
      status:    'PENDING_PAYMENT',
      createdAt: { lt: cutoff },
    },
    data: { status: 'CANCELLED' },
  });

  console.log(`[cron/expire-pending] Expired ${count} pending appointments`);
  return NextResponse.json({ expired: count });
}
