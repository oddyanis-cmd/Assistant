'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from './services';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const staffSchema = z.object({
  name:      z.string().min(1).max(100),
  title:     z.string().max(100).optional().or(z.literal('')),
  bio:       z.string().max(1000).optional().or(z.literal('')),
  imageUrl:  z.string().url().optional().or(z.literal('')),
  email:     z.string().email().optional().or(z.literal('')),
  isActive:  z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function createStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = staffSchema.safeParse({
    name:      formData.get('name'),
    title:     formData.get('title') ?? '',
    bio:       formData.get('bio') ?? '',
    imageUrl:  formData.get('imageUrl') ?? '',
    email:     formData.get('email') ?? '',
    isActive:  formData.get('isActive') !== 'false',
    sortOrder: formData.get('sortOrder') ?? 0,
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const s = await prisma.staff.create({
    data: {
      name:      parsed.data.name,
      title:     parsed.data.title   || null,
      bio:       parsed.data.bio     || null,
      imageUrl:  parsed.data.imageUrl  || null,
      email:     parsed.data.email   || null,
      isActive:  parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
    },
  });
  revalidatePath('/admin/team');
  return { success: true, id: s.id };
}

export async function updateStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  const parsed = staffSchema.safeParse({
    name:      formData.get('name'),
    title:     formData.get('title') ?? '',
    bio:       formData.get('bio') ?? '',
    imageUrl:  formData.get('imageUrl') ?? '',
    email:     formData.get('email') ?? '',
    isActive:  formData.get('isActive') !== 'false',
    sortOrder: formData.get('sortOrder') ?? 0,
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  await prisma.staff.update({
    where: { id },
    data: {
      name:      parsed.data.name,
      title:     parsed.data.title   || null,
      bio:       parsed.data.bio     || null,
      imageUrl:  parsed.data.imageUrl  || null,
      email:     parsed.data.email   || null,
      isActive:  parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
    },
  });
  revalidatePath('/admin/team');
  return { success: true };
}

export async function deleteStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  const apptCount = await prisma.appointment.count({ where: { staffId: id, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } });
  if (apptCount > 0) return { success: false, error: 'Cannot delete staff with active appointments.' };

  await prisma.staff.delete({ where: { id } });
  revalidatePath('/admin/team');
  return { success: true };
}

// ── Service links ─────────────────────────────────────────────────────

export async function setStaffServices(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const staffId    = formData.get('staffId') as string;
  const serviceIds = formData.getAll('serviceIds') as string[];
  if (!staffId) return { success: false, error: 'Missing staffId' };

  await prisma.$transaction([
    prisma.staffService.deleteMany({ where: { staffId } }),
    ...serviceIds.map((serviceId) =>
      prisma.staffService.create({ data: { staffId, serviceId } }),
    ),
  ]);
  revalidatePath('/admin/team');
  return { success: true };
}

// ── Working hours ─────────────────────────────────────────────────────

const workingHoursSchema = z.array(
  z.object({
    dayOfWeek:    z.coerce.number().int().min(0).max(6),
    startMinutes: z.coerce.number().int().min(0).max(1439),
    endMinutes:   z.coerce.number().int().min(1).max(1440),
  }),
);

export async function setWorkingHours(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const staffId = formData.get('staffId') as string;
  if (!staffId) return { success: false, error: 'Missing staffId' };

  const raw = formData.get('hours');
  if (!raw) return { success: false, error: 'Missing hours' };

  let hours: unknown;
  try {
    hours = JSON.parse(raw as string);
  } catch {
    return { success: false, error: 'Invalid JSON for hours' };
  }

  const parsed = workingHoursSchema.safeParse(hours);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Validate endMinutes > startMinutes for each row
  for (const h of parsed.data) {
    if (h.endMinutes <= h.startMinutes) {
      return { success: false, error: `Day ${h.dayOfWeek}: end time must be after start time.` };
    }
  }

  await prisma.$transaction([
    prisma.staffWorkingHours.deleteMany({ where: { staffId } }),
    ...parsed.data.map((h) =>
      prisma.staffWorkingHours.create({ data: { staffId, ...h } }),
    ),
  ]);
  revalidatePath('/admin/team');
  return { success: true };
}

// ── Time off ──────────────────────────────────────────────────────────

const timeOffSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt:   z.string().datetime(),
  reason:   z.string().max(500).optional().or(z.literal('')),
});

export async function addTimeOff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const staffId = formData.get('staffId') as string;
  if (!staffId) return { success: false, error: 'Missing staffId' };

  const parsed = timeOffSchema.safeParse({
    startsAt: formData.get('startsAt'),
    endsAt:   formData.get('endsAt'),
    reason:   formData.get('reason') ?? '',
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { startsAt, endsAt, reason } = parsed.data;
  if (new Date(endsAt) <= new Date(startsAt)) return { success: false, error: 'End must be after start.' };

  const to = await prisma.staffTimeOff.create({
    data: { staffId, startsAt: new Date(startsAt), endsAt: new Date(endsAt), reason: reason || null },
  });
  revalidatePath('/admin/team');
  return { success: true, id: to.id };
}

export async function deleteTimeOff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  await prisma.staffTimeOff.delete({ where: { id } });
  revalidatePath('/admin/team');
  return { success: true };
}
