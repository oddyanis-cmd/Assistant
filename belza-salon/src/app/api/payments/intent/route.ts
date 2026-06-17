import { NextResponse } from 'next/server';
import { paymentsEnabled } from '@/lib/config';

// Payments stub — enabled in milestone 2 (Stripe integration)
export async function POST() {
  if (!paymentsEnabled) {
    return NextResponse.json(
      { error: 'Payments are not enabled on this instance.' },
      { status: 403 },
    );
  }
  // TODO milestone 2: create Stripe PaymentIntent
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
