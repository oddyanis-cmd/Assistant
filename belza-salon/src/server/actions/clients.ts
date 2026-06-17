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

const clientUpdateSchema = z.object({
  firstName:      z.string().min(1).max(100),
  lastName:       z.string().max(100).optional().or(z.literal('')),
  phone:          z.string().max(30).optional().or(z.literal('')),
  notes:          z.string().max(2000).optional().or(z.literal('')),
  marketingOptIn: z.coerce.boolean().default(false),
});

export async function updateClient(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  const parsed = clientUpdateSchema.safeParse({
    firstName:      formData.get('firstName'),
    lastName:       formData.get('lastName') ?? '',
    phone:          formData.get('phone') ?? '',
    notes:          formData.get('notes') ?? '',
    marketingOptIn: formData.get('marketingOptIn') === 'true',
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  await prisma.client.update({
    where: { id },
    data: {
      firstName:      parsed.data.firstName,
      lastName:       parsed.data.lastName   || null,
      phone:          parsed.data.phone      || null,
      notes:          parsed.data.notes      || null,
      marketingOptIn: parsed.data.marketingOptIn,
    },
  });

  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${id}`);
  return { success: true };
}
