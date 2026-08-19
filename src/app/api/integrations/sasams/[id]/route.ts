import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "sasams.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const job = await prisma.importJob.findFirst({
    where: { id, schoolId },
    include: {
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      batches: true,
      mapping: true,
      errors: { take: 200, orderBy: { createdAt: "desc" } },
      stagingRecords: { take: 200, orderBy: { sourceRow: "asc" } },
    },
  });
  if (!job) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({
    job: {
      ...job,
      encryptedStorageKey: job.encryptedStorageKey ? "[stored]" : null,
    },
  });
}
