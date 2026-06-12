import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "audit:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const entity = searchParams.get("entity") ?? undefined;
  const take = 50;
  const skip = (page - 1) * take;

  const schoolId =
    session!.role === UserRole.SUPER_ADMIN
      ? searchParams.get("schoolId") ?? undefined
      : resolveSettingsSchoolId(session!, searchParams.get("schoolId")) ?? undefined;

  const filter = getSchoolFilter(session!);
  const where = {
    ...(schoolId
      ? { schoolId }
      : "schoolId" in filter
        ? { schoolId: filter.schoolId }
        : {}),
    ...(entity ? { entity } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: { page, take, total, pages: Math.ceil(total / take) },
  });
}
