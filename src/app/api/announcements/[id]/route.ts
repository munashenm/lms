import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { z } from "zod";

const announcementPatchSchema = z.object({
  isPublic: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "announcements:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.announcement.findFirst({
    where: { id, ...getSchoolFilter(session!) },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const parsed = announcementPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const denied = await requireLicenseWrite(existing.schoolId);
  if (denied) return denied;

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(parsed.data.isPublic !== undefined && { isPublic: parsed.data.isPublic }),
      ...(parsed.data.isPinned !== undefined && { isPinned: parsed.data.isPinned }),
    },
  });
  return NextResponse.json({ announcement });
}
