import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";
import { toCsv, csvDownloadHeaders } from "@/lib/csv";
import { formatDate } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "audit:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const entity = searchParams.get("entity") ?? undefined;
  const format = searchParams.get("format");
  const take = format === "csv" ? 5000 : 50;
  const skip = format === "csv" ? 0 : (page - 1) * 50;

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

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  if (format === "csv") {
    const csv = toCsv(
      ["Date", "Action", "Entity", "Entity ID", "User", "Email"],
      logs.map((log) => [
        formatDate(log.createdAt),
        log.action,
        log.entity,
        log.entityId ?? "",
        log.user ? `${log.user.firstName} ${log.user.lastName}` : "System",
        log.user?.email ?? "",
      ])
    );
    return new NextResponse(csv, { headers: csvDownloadHeaders("audit-log.csv") });
  }

  const total = await prisma.auditLog.count({ where });

  return NextResponse.json({
    logs,
    pagination: { page, take: 50, total, pages: Math.ceil(total / 50) },
  });
}
