import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { deleteBackupJob, readBackupPackage, verifyStoredBackup } from "@/lib/backup/engine";
import { logAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/request-meta";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "backup.download") && !requirePermission(session, "backup.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const job = await prisma.backupJob.findFirst({ where: { id, schoolId } });
  if (!job) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (request.nextUrl.searchParams.get("download") === "1") {
    if (!requirePermission(session, "backup.download")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    const pkg = await readBackupPackage(schoolId, id);
    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "BACKUP_DOWNLOADED",
      entity: "BackupJob",
      entityId: id,
      ...requestMeta(request),
    });
    return new NextResponse(new Uint8Array(pkg), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${job.filename ?? `${id}.lmsbackup`}"`,
      },
    });
  }

  return NextResponse.json({ job: { ...job, sizeBytes: job.sizeBytes.toString() } });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "backup.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json()) as { schoolId?: string; action?: string };
  const schoolId = await resolveLicenseSchoolId(session!, body.schoolId);
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (body.action === "verify") {
    const result = await verifyStoredBackup(schoolId, id);
    return NextResponse.json(result);
  }
  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "backup.delete")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const schoolId = await resolveLicenseSchoolId(
    session!,
    request.nextUrl.searchParams.get("schoolId")
  );
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  await deleteBackupJob(schoolId, id, session!.userId);
  return NextResponse.json({ ok: true });
}
