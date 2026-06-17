import { NextRequest, NextResponse } from 'next/server';
import { paymentsEnabled } from '@/lib/config';

// Node runtime required for raw body access (Stripe signature verification)
export const runtime = 'nodejs';

// Webhook stub — enabled in milestone 2 (Stripe integration)
export async function POST(_req: NextRequest) {
  if (!paymentsEnabled) {
    return NextResponse.json(
      { error: 'Payments are not enabled on this instance.' },
      { status: 403 },
    );
  }
  // TODO milestone 2: verify Stripe signature, handle payment_intent.succeeded
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
