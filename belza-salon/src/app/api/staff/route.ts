import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { staffQuerySchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const parsed = staffQuerySchema.safeParse({ serviceId: searchParams.get('serviceId') ?? undefined });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', issues: parsed.error.issues }, { status: 422 });
    }

    const { serviceId } = parsed.data;

    const staff = await prisma.staff.findMany({
      where: {
        isActive: true,
        ...(serviceId ? { services: { some: { serviceId } } } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id:       true,
        name:     true,
        title:    true,
        bio:      true,
        imageUrl: true,
      },
    });

    return NextResponse.json({ staff });
  } catch (err) {
    console.error('[api/staff] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
