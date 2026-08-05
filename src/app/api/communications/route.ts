import { NextRequest, NextResponse } from "next/server";
import { CommunicationCategory } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:read") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId = session!.schoolId ?? (await requireSchoolId(session!).catch(() => null));
  if (!schoolId && session!.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "School required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as CommunicationCategory | null;
  const studentId = searchParams.get("studentId");

  const logs = await prisma.communicationLog.findMany({
    where: {
      ...(schoolId ? { schoolId } : getSchoolFilter(session!)),
      ...(category ? { category } : {}),
      ...(studentId ? { studentId } : {}),
    },
    include: {
      student: {
        select: { firstName: true, lastName: true, studentNumber: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ logs });
}
