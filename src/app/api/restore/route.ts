import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveLicenseSchoolId } from "@/lib/licensing/enforce";
import { createRestoreJob, executeRestore, validateRestorePackage } from "@/lib/backup/restore";
import { readBackupPackage } from "@/lib/backup/engine";
import { getBackupEncryptionKey } from "@/lib/backup/crypto";
import { unpackBackup } from "@/lib/backup/package";
import type { BackupSnapshot } from "@/lib/backup/types";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "backup.restore") && !requirePermission(session, "backup.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await resolveLicenseSchoolId(session!, request.nextUrl.searchParams.get("schoolId"));
  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const jobs = await prisma.restoreJob.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "backup.restore")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let schoolId: string | null = null;
  let backupJobId: string | undefined;
  let pkg: Buffer | null = null;
  let confirm = false;
  let restoreJobId: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    schoolId = await resolveLicenseSchoolId(session!, String(form.get("schoolId") ?? ""));
    const file = form.get("file");
    if (file instanceof File) {
      pkg = Buffer.from(await file.arrayBuffer());
    }
    confirm = form.get("confirm") === "true";
    restoreJobId = String(form.get("restoreJobId") ?? "") || undefined;
  } else {
    const body = (await request.json()) as {
      schoolId?: string;
      backupJobId?: string;
      confirm?: boolean;
      restoreJobId?: string;
    };
    schoolId = await resolveLicenseSchoolId(session!, body.schoolId);
    backupJobId = body.backupJobId;
    confirm = Boolean(body.confirm);
    restoreJobId = body.restoreJobId;
  }

  if (!schoolId || !canAccessSchool(session!, schoolId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!restoreJobId) {
    const job = await createRestoreJob({
      schoolId,
      createdById: session!.userId,
      backupJobId: backupJobId ?? null,
      sourceType: pkg ? "OFFLINE_UPLOAD" : "CLOUD",
    });
    restoreJobId = job.id;
  }

  if (!pkg && backupJobId) {
    pkg = await readBackupPackage(schoolId, backupJobId);
  }
  if (!pkg) {
    return NextResponse.json({ message: "Backup file or cloud backup id is required" }, { status: 400 });
  }

  const validated = await validateRestorePackage({ schoolId, restoreJobId, pkg });
  if (!validated.ok) {
    return NextResponse.json({ restoreJobId, ...validated }, { status: 400 });
  }

  if (!confirm) {
    return NextResponse.json({ restoreJobId, ready: true, ...validated });
  }

  let snapshot = validated.snapshot;
  if (!snapshot) {
    const unpacked = unpackBackup(pkg, getBackupEncryptionKey());
    if (!unpacked.ok) {
      return NextResponse.json({ message: "Could not read backup payload" }, { status: 400 });
    }
    snapshot = JSON.parse(unpacked.plaintext.toString("utf8")) as BackupSnapshot;
  }

  const result = await executeRestore({
    schoolId,
    restoreJobId,
    snapshot,
    preserveUserId: session!.userId,
  });
  return NextResponse.json({ restoreJobId, ...result });
}
