'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

const settingsSchema = z.object({
  salonName:       z.string().min(1).max(100),
  timezone:        z.string().min(1),
  slotIntervalMin: z.coerce.number().int().min(5).max(60),
  leadTimeMinutes: z.coerce.number().int().min(0).max(1440),
  maxAdvanceDays:  z.coerce.number().int().min(1).max(365),
  depositPercent:  z.coerce.number().int().min(0).max(100),
  currency:        z.string().length(3),
  contactEmail:    z.string().email().optional().or(z.literal('')),
  contactPhone:    z.string().max(30).optional().or(z.literal('')),
  addressLine:     z.string().max(200).optional().or(z.literal('')),
});

export type SettingsFormState =
  | { success: true }
  | { success: false; error: string };

export async function updateSettings(
  _prev: SettingsFormState | null,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const raw = {
    salonName:       formData.get('salonName'),
    timezone:        formData.get('timezone'),
    slotIntervalMin: formData.get('slotIntervalMin'),
    leadTimeMinutes: formData.get('leadTimeMinutes'),
    maxAdvanceDays:  formData.get('maxAdvanceDays'),
    depositPercent:  formData.get('depositPercent'),
    currency:        formData.get('currency'),
    contactEmail:    formData.get('contactEmail') ?? '',
    contactPhone:    formData.get('contactPhone') ?? '',
    addressLine:     formData.get('addressLine') ?? '',
  };

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors.map((e) => e.message).join(', ') };
  }

  const data = parsed.data;

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {
      salonName:       data.salonName,
      timezone:        data.timezone,
      slotIntervalMin: data.slotIntervalMin,
      leadTimeMinutes: data.leadTimeMinutes,
      maxAdvanceDays:  data.maxAdvanceDays,
      depositPercent:  data.depositPercent,
      currency:        data.currency,
      contactEmail:    data.contactEmail || null,
      contactPhone:    data.contactPhone || null,
      addressLine:     data.addressLine  || null,
    },
    create: {
      id:              'singleton',
      salonName:       data.salonName,
      timezone:        data.timezone,
      slotIntervalMin: data.slotIntervalMin,
      leadTimeMinutes: data.leadTimeMinutes,
      maxAdvanceDays:  data.maxAdvanceDays,
      depositPercent:  data.depositPercent,
      currency:        data.currency,
      contactEmail:    data.contactEmail || null,
      contactPhone:    data.contactPhone || null,
      addressLine:     data.addressLine  || null,
    },
  });

  revalidatePath('/admin/settings');
  return { success: true };
}
