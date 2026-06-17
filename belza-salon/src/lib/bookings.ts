/**
 * Transactional booking creation — §4.2 of the blueprint.
 *
 * Two-layer double-booking prevention:
 *   Layer 1: DB @@unique([staffId, startsAt]) — rejects identical staff+start
 *   Layer 2: Serializable transaction overlap check
 */

import { addMinutes } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { sendConfirmationEmail } from './email';
import { appUrl, paymentsEnabled } from './config';
import type { CreateBookingInput } from './validations';

export class SlotTakenError extends Error {
  constructor() {
    super('This time slot is no longer available. Please choose another time.');
    this.name = 'SlotTakenError';
  }
}

export async function createBooking(input: CreateBookingInput & { source?: string }) {
  const {
    serviceId,
    staffId: staffIdParam,
    startsAt: startsAtIso,
    firstName,
    lastName,
    email,
    phone,
    notes,
    marketingOptIn,
    source: sourceParam,
  } = input;

  const startsAt = new Date(startsAtIso);

  // ── Resolve staff (handles "any") ──────────────────────────────
  let resolvedStaffId: string;

  if (staffIdParam === 'any') {
    // Load service to determine block duration
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new Error('Service not found');
    const blockMin = service.durationMinutes + service.bufferAfterMin;
    const endsAtTemp = addMinutes(startsAt, blockMin);

    // Find first available staff for this service at this time
    const freeStaff = await prisma.staff.findFirst({
      where: {
        isActive: true,
        services: { some: { serviceId } },
        appointments: {
          none: {
            status:   { in: ['CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'] },
            startsAt: { lt: endsAtTemp },
            endsAt:   { gt: startsAt },
          },
        },
      },
    });

    if (!freeStaff) {
      throw new SlotTakenError();
    }
    resolvedStaffId = freeStaff.id;
  } else {
    resolvedStaffId = staffIdParam;
  }

  // ── Serializable transaction ────────────────────────────────────
  try {
    const appointment = await prisma.$transaction(
      async (tx) => {
        // Load service inside tx for block duration
        const service = await tx.service.findUnique({ where: { id: serviceId } });
        if (!service) throw new Error('Service not found');

        const blockMin = service.durationMinutes + service.bufferAfterMin;
        const endsAt   = addMinutes(startsAt, blockMin);

        // Overlap check
        const conflict = await tx.appointment.findFirst({
          where: {
            staffId: resolvedStaffId,
            status:  { in: ['CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'] },
            startsAt: { lt: endsAt },
            endsAt:   { gt: startsAt },
          },
          select: { id: true },
        });

        if (conflict) throw new SlotTakenError();

        // Upsert client
        const client = await tx.client.upsert({
          where:  { email },
          create: {
            firstName,
            lastName,
            email,
            phone,
            marketingOptIn: marketingOptIn ?? false,
          },
          update: {
            firstName,
            lastName,
            ...(phone ? { phone } : {}),
          },
        });

        // Determine deposit amount for status decision
        const settings = await tx.settings.findUnique({ where: { id: 'singleton' } });
        const depositPct = settings?.depositPercent ?? 0;
        const requiresPayment = paymentsEnabled && depositPct > 0 && sourceParam !== 'admin';
        const apptStatus = requiresPayment ? 'PENDING_PAYMENT' : 'CONFIRMED';

        // Create appointment
        return tx.appointment.create({
          data: {
            serviceId,
            staffId:    resolvedStaffId,
            clientId:   client.id,
            startsAt,
            endsAt,
            status:     apptStatus,
            priceCents: service.priceCents,
            currency:   service.currency,
            notes,
            source:     sourceParam ?? 'online',
          },
          include: {
            service: true,
            staff:   true,
            client:  true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // ── Send confirmation email (non-blocking, only when confirmed) ──
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
    const cancelUrl = `${appUrl}/book/confirmation/${appointment.cancelToken}`;

    if (appointment.status === 'CONFIRMED') {
    sendConfirmationEmail({
      to:          email,
      firstName,
      serviceName: appointment.service.name,
      staffName:   appointment.staff.name,
      startsAt:    appointment.startsAt,
      endsAt:      appointment.endsAt,
      priceCents:  appointment.priceCents,
      currency:    appointment.currency,
      cancelUrl,
      timezone:    settings?.timezone ?? 'America/New_York',
      salonName:   settings?.salonName ?? 'Belza',
      addressLine: settings?.addressLine ?? '',
    }).catch((err) => console.error('[email] send failed:', err));
    }

    return appointment;
  } catch (err) {
    if (err instanceof SlotTakenError) throw err;
    // Prisma unique constraint violation (P2002) → slot taken
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new SlotTakenError();
    }
    // Postgres serialization failure (40001) → retry at API layer
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2034' || (err.message?.includes('40001')))
    ) {
      throw new SlotTakenError();
    }
    throw err;
  }
}
