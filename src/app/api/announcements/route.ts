import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { announcementSchema } from "@/lib/validators";
import { UserRole } from "@prisma/client";

const AUDIENCE_FOR_ROLE: Partial<Record<UserRole, string[]>> = {
  [UserRole.STUDENT]: ["ALL", "STUDENTS"],
  [UserRole.PARENT]: ["ALL", "PARENTS", "STUDENTS"],
  [UserRole.TEACHER]: ["ALL", "STAFF", "TEACHERS"],
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const audienceFilter = AUDIENCE_FOR_ROLE[session.role];

  const announcements = await prisma.announcement.findMany({
    where: {
      ...getSchoolFilter(session),
      ...(audienceFilter && { audience: { in: audienceFilter as ("ALL" | "STUDENTS" | "PARENTS" | "STAFF" | "TEACHERS" | "FINANCE")[] } }),
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    },
    include: {
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
    take: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50,
  });

  return NextResponse.json({ announcements });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "announcements:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const schoolId = await requireSchoolId(session);
  const announcement = await prisma.announcement.create({
    data: {
      schoolId,
      authorId: session.userId,
      title: parsed.data.title,
      content: parsed.data.content,
      audience: parsed.data.audience,
      isPinned: parsed.data.isPinned ?? false,
    },
  });

  return NextResponse.json({ announcement }, { status: 201 });
}
