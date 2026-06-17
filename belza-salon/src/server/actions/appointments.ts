'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createBooking } from '@/lib/bookings';
import type { ActionResult } from './services';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

// ── Admin walk-in / manual booking ───────────────────────────────────

const adminCreateBookingSchema = z.object({
  serviceId: z.string().min(1),
  staffId:   z.string().min(1),
  startsAt:  z.string().datetime(),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().max(100).optional().or(z.literal('')),
  email:     z.string().email(),
  phone:     z.string().max(30).optional().or(z.literal('')),
  notes:     z.string().max(1000).optional().or(z.literal('')),
});

export async function adminCreateAppointment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = adminCreateBookingSchema.safeParse({
    serviceId: formData.get('serviceId'),
    staffId:   formData.get('staffId'),
    startsAt:  formData.get('startsAt'),
    firstName: formData.get('firstName'),
    lastName:  formData.get('lastName') ?? '',
    email:     formData.get('email'),
    phone:     formData.get('phone') ?? '',
    notes:     formData.get('notes') ?? '',
  });

  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const appt = await createBooking({
      ...parsed.data,
      source:         'admin',
      marketingOptIn: false,
      lastName:       parsed.data.lastName || undefined,
      phone:          parsed.data.phone    || undefined,
      notes:          parsed.data.notes    || undefined,
    });
    revalidatePath('/admin');
    revalidatePath('/admin/appointments');
    return { success: true, id: appt.id };
  } catch (err) {
    if (err instanceof Error && err.name === 'SlotTakenError') {
      return { success: false, error: 'That time slot is no longer available.' };
    }
    throw err;
  }
}

// ── Reschedule ────────────────────────────────────────────────────────

const rescheduleSchema = z.object({
  id:       z.string().min(1),
  startsAt: z.string().datetime(),
});

export async function rescheduleAppointment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = rescheduleSchema.safeParse({
    id:       formData.get('id'),
    startsAt: formData.get('startsAt'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const appt = await prisma.appointment.findUnique({
    where:   { id: parsed.data.id },
    include: { service: true },
  });
  if (!appt) return { success: false, error: 'Appointment not found.' };

  const newStart = new Date(parsed.data.startsAt);
  const newEnd   = new Date(newStart.getTime() + (appt.service.durationMinutes + appt.service.bufferAfterMin) * 60000);

  // Overlap check
  const conflict = await prisma.appointment.findFirst({
    where: {
      id:      { not: appt.id },
      staffId: appt.staffId,
      status:  { in: ['CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'] },
      startsAt: { lt: newEnd },
      endsAt:   { gt: newStart },
    },
  });
  if (conflict) return { success: false, error: 'Time slot is already taken.' };

  await prisma.appointment.update({
    where: { id: appt.id },
    data:  { startsAt: newStart, endsAt: newEnd },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/appointments');
  revalidatePath(`/admin/appointments/${appt.id}`);
  return { success: true };
}

// ── Status mutations ──────────────────────────────────────────────────

async function setStatus(id: string, status: 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { success: false, error: 'Missing id' };

  await prisma.appointment.update({ where: { id }, data: { status } });

  revalidatePath('/admin');
  revalidatePath('/admin/appointments');
  revalidatePath(`/admin/appointments/${id}`);
  return { success: true };
}

export async function cancelAppointment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setStatus(formData.get('id') as string, 'CANCELLED');
}

export async function markCompleted(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setStatus(formData.get('id') as string, 'COMPLETED');
}

export async function markNoShow(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setStatus(formData.get('id') as string, 'NO_SHOW');
}
