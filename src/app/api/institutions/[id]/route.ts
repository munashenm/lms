import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  isActive: z.boolean(),
});

/**
 * Soft-deactivate / reactivate an institution.
 * Hard-delete is intentionally not exposed — School FK cascades would wipe the tenant.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const existing = await prisma.school.findUnique({
    where: { id },
    select: { id: true, name: true, isActive: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const school = await prisma.school.update({
    where: { id },
    data: { isActive: parsed.data.isActive },
    select: { id: true, name: true, slug: true, isActive: true },
  });

  await logAudit({
    schoolId: school.id,
    userId: session.userId,
    action: parsed.data.isActive ? "INSTITUTION_REACTIVATED" : "INSTITUTION_DEACTIVATED",
    entity: "School",
    entityId: school.id,
    metadata: { name: school.name, isActive: school.isActive },
  });

  return NextResponse.json({ school });
}

export async function DELETE() {
  return NextResponse.json(
    {
      message:
        "Hard-delete of institutions is disabled. Deactivate the school with PATCH { isActive: false } instead.",
    },
    { status: 405 }
  );
}
