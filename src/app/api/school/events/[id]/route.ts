import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { schoolEventUpdateSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function loadEvent(id: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return prisma.schoolEvent.findFirst({
    where: { id, ...getSchoolFilter(session) },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "announcements:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await loadEvent(id, session);
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const parsed = schoolEventUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const event = await prisma.schoolEvent.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description || null }),
      ...(parsed.data.startsAt !== undefined && { startsAt: new Date(parsed.data.startsAt) }),
      ...(parsed.data.endsAt !== undefined && {
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      }),
      ...(parsed.data.isPublic !== undefined && { isPublic: parsed.data.isPublic }),
    },
  });
  return NextResponse.json({ event });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "announcements:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await loadEvent(id, session);
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  await prisma.schoolEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
