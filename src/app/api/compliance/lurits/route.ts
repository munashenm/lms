import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import {
  matchEducatorForLurits,
  matchLearnerForLurits,
  parseLuritsFeedback,
  summariseLuritsApply,
} from "@/lib/compliance/lurits-feedback";
import { logAudit } from "@/lib/audit";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

export async function GET() {
  const session = await getSession();
  if (!session || !requirePermission(session, "sasams.view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const jobs = await prisma.luritsImportJob.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/compliance/lurits",
      method: "POST",
      feature: "reporting",
    });
    if (__licDenied) return __licDenied;
  }
if (!session || !requirePermission(session, "sasams.import")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Upload a LURITS feedback file" }, { status: 400 });
  }
  const content = await file.text();
  const records = parseLuritsFeedback(file.name, content);

  const job = await prisma.luritsImportJob.create({
    data: {
      schoolId,
      filename: file.name,
      fileType: records[0]?.fileType ?? "UNKNOWN",
      status: "PROCESSING",
      createdById: session.userId,
    },
  });

  try {
    const [learners, educators] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId },
        select: { id: true, saIdNumber: true, studentNumber: true },
      }),
      prisma.teacher.findMany({
        where: { schoolId },
        select: { id: true, saIdNumber: true, employeeNumber: true },
      }),
    ]);

    let learnerMatches = 0;
    let educatorMatches = 0;
    let updated = 0;

    for (const record of records) {
      if (!record.luritsNumber) continue;
      if (record.entityType === "educator") {
        const id = matchEducatorForLurits(record, educators);
        if (!id) continue;
        educatorMatches += 1;
        await prisma.teacher.update({
          where: { id },
          data: { luritsNumber: record.luritsNumber },
        });
        updated += 1;
      } else {
        const id = matchLearnerForLurits(record, learners);
        if (!id) continue;
        learnerMatches += 1;
        await prisma.student.update({
          where: { id },
          data: { luritsNumber: record.luritsNumber },
        });
        updated += 1;
      }
    }

    const summary = {
      ...summariseLuritsApply({ records, learnerMatches, educatorMatches, updated }),
      recordCount: records.length,
      fileType: records[0]?.fileType ?? "UNKNOWN",
    };

    const completed = await prisma.luritsImportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        summary,
        completedAt: new Date(),
      },
    });

    await logAudit({
      schoolId,
      userId: session.userId,
      action: "LURITS_IMPORT",
      entity: "LuritsImportJob",
      entityId: job.id,
      metadata: summary,
    });

    return NextResponse.json({ job: completed, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    await prisma.luritsImportJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
    });
    return NextResponse.json({ message }, { status: 500 });
  }
}