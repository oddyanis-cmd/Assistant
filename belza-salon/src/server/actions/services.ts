'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

// ── Category schemas ──────────────────────────────────────────────────

const categorySchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  sortOrder:   z.coerce.number().int().min(0).default(0),
});

export type ActionResult = { success: true; id?: string } | { success: false; error: string };

export async function createCategory(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categorySchema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') ?? '',
    sortOrder:   formData.get('sortOrder') ?? 0,
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const cat = await prisma.serviceCategory.create({
    data: {
      name:        parsed.data.name,
      description: parsed.data.description || null,
      sortOrder:   parsed.data.sortOrder,
    },
  });
  revalidatePath('/admin/services');
  return { success: true, id: cat.id };
}

export async function updateCategory(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  const parsed = categorySchema.safeParse({
    name:        formData.get('name'),
    description: formData.get('description') ?? '',
    sortOrder:   formData.get('sortOrder') ?? 0,
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  await prisma.serviceCategory.update({
    where: { id },
    data: {
      name:        parsed.data.name,
      description: parsed.data.description || null,
      sortOrder:   parsed.data.sortOrder,
    },
  });
  revalidatePath('/admin/services');
  return { success: true };
}

export async function deleteCategory(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  const serviceCount = await prisma.service.count({ where: { categoryId: id } });
  if (serviceCount > 0) return { success: false, error: 'Cannot delete a category that has services. Reassign or delete those services first.' };

  await prisma.serviceCategory.delete({ where: { id } });
  revalidatePath('/admin/services');
  return { success: true };
}

// ── Service schemas ───────────────────────────────────────────────────

const serviceSchema = z.object({
  name:            z.string().min(1).max(100),
  description:     z.string().max(500).optional().or(z.literal('')),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  priceCents:      z.coerce.number().int().min(0),
  bufferAfterMin:  z.coerce.number().int().min(0).max(120).default(0),
  isActive:        z.coerce.boolean().default(true),
  sortOrder:       z.coerce.number().int().min(0).default(0),
  categoryId:      z.string().min(1),
});

export async function createService(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = serviceSchema.safeParse({
    name:            formData.get('name'),
    description:     formData.get('description') ?? '',
    durationMinutes: formData.get('durationMinutes'),
    priceCents:      formData.get('priceCents'),
    bufferAfterMin:  formData.get('bufferAfterMin') ?? 0,
    isActive:        formData.get('isActive') !== 'false',
    sortOrder:       formData.get('sortOrder') ?? 0,
    categoryId:      formData.get('categoryId'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const svc = await prisma.service.create({
    data: {
      name:            parsed.data.name,
      description:     parsed.data.description || null,
      durationMinutes: parsed.data.durationMinutes,
      priceCents:      parsed.data.priceCents,
      bufferAfterMin:  parsed.data.bufferAfterMin,
      isActive:        parsed.data.isActive,
      sortOrder:       parsed.data.sortOrder,
      categoryId:      parsed.data.categoryId,
    },
  });
  revalidatePath('/admin/services');
  return { success: true, id: svc.id };
}

export async function updateService(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  const parsed = serviceSchema.safeParse({
    name:            formData.get('name'),
    description:     formData.get('description') ?? '',
    durationMinutes: formData.get('durationMinutes'),
    priceCents:      formData.get('priceCents'),
    bufferAfterMin:  formData.get('bufferAfterMin') ?? 0,
    isActive:        formData.get('isActive') !== 'false',
    sortOrder:       formData.get('sortOrder') ?? 0,
    categoryId:      formData.get('categoryId'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  await prisma.service.update({ where: { id }, data: { ...parsed.data, description: parsed.data.description || null } });
  revalidatePath('/admin/services');
  return { success: true };
}

export async function deleteService(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = formData.get('id') as string;
  if (!id) return { success: false, error: 'Missing id' };

  const apptCount = await prisma.appointment.count({ where: { serviceId: id, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } });
  if (apptCount > 0) return { success: false, error: 'Cannot delete a service with active appointments.' };

  await prisma.service.delete({ where: { id } });
  revalidatePath('/admin/services');
  return { success: true };
}
