import { NextRequest, NextResponse } from "next/server";
import { ComplianceExportKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { checkEducatorEmis, checkLearnerEmis, summariseCompliance } from "@/lib/compliance/emis-fields";
import { buildSasamsExportPackage, packageToCsvBundle } from "@/lib/compliance/sasams-export";
import { buildCemisMarksPackage, cemisPackageToCsv } from "@/lib/compliance/cemis-export";
import { buildPromotionLuritsPackage, promotionPackageToCsv } from "@/lib/compliance/promotion-export";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !requirePermission(session, "sasams.view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const jobs = await prisma.complianceExportJob.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !requirePermission(session, "sasams.execute")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind ?? "SASAMS_PACKAGE") as ComplianceExportKind;
  const academicYearId = typeof body.academicYearId === "string" ? body.academicYearId : undefined;
  const termId = typeof body.termId === "string" ? body.termId : undefined;
  const format = body.format === "csv" ? "csv" : "json";
  const allowWithErrors = Boolean(body.allowWithErrors);

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return NextResponse.json({ message: "School not found" }, { status: 404 });

  try {
    if (kind === "SASAMS_PACKAGE") {
      const learners = await prisma.student.findMany({
        where: { schoolId, status: { in: ["ACTIVE", "SUSPENDED"] } },
        include: {
          grade: { select: { name: true } },
          class: { select: { name: true } },
          guardians: {
            include: {
              guardian: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                  saIdNumber: true,
                  relationship: true,
                },
              },
            },
          },
        },
      });
      const educators = await prisma.teacher.findMany({ where: { schoolId } });
      const issues = [
        ...learners.flatMap((l) =>
          checkLearnerEmis({
            ...l,
            gradeName: l.grade?.name,
            className: l.class?.name,
          })
        ),
        ...educators.flatMap((e) => checkEducatorEmis(e)),
      ];
      const summary = summariseCompliance(issues);
      if (summary.blocking && !allowWithErrors) {
        return NextResponse.json(
          {
            message: "Resolve Compliance Centre errors before exporting, or pass allowWithErrors.",
            summary,
          },
          { status: 400 }
        );
      }

      const pkg = buildSasamsExportPackage({
        school,
        learners: learners.map((l) => ({
          ...l,
          gradeName: l.grade?.name,
          className: l.class?.name,
          guardians: l.guardians.map((g) => ({
            firstName: g.guardian.firstName,
            lastName: g.guardian.lastName,
            relationship: g.relationship || g.guardian.relationship,
            phone: g.guardian.phone,
            email: g.guardian.email,
            saIdNumber: g.guardian.saIdNumber,
            isPrimary: g.isPrimary,
          })),
        })),
        educators,
      });

      const filename =
        format === "csv"
          ? `sa-sams-export-${school.slug}-${Date.now()}.json`
          : `sa-sams-export-${school.slug}-${Date.now()}.json`;
      const payload =
        format === "csv"
          ? { bundle: packageToCsvBundle(pkg), package: pkg }
          : pkg;

      const job = await prisma.complianceExportJob.create({
        data: {
          schoolId,
          kind: "SASAMS_PACKAGE",
          status: "READY",
          filename,
          mimeType: "application/json",
          payload: payload as object,
          summary: { ...summary, learnerCount: learners.length, educatorCount: educators.length },
          createdById: session.userId,
          completedAt: new Date(),
        },
      });
      await logAudit({
        schoolId,
        userId: session.userId,
        action: "COMPLIANCE_EXPORT",
        entity: "ComplianceExportJob",
        entityId: job.id,
        metadata: { kind, summary },
      });
      return NextResponse.json({ job, package: pkg, csvBundle: format === "csv" ? packageToCsvBundle(pkg) : undefined });
    }

    if (kind === "CEMIS_MARKS") {
      const marks = await prisma.mark.findMany({
        where: {
          student: { schoolId },
          assessment: {
            ...(termId ? { termId } : {}),
            ...(academicYearId ? { term: { academicYearId } } : {}),
          },
        },
        include: {
          student: {
            select: {
              studentNumber: true,
              firstName: true,
              lastName: true,
              luritsNumber: true,
              grade: { select: { name: true } },
              class: { select: { name: true } },
            },
          },
          assessment: {
            select: {
              title: true,
              maxMarks: true,
              term: { select: { name: true, academicYear: { select: { name: true } } } },
              subject: { select: { code: true, name: true } },
            },
          },
        },
        take: 10000,
      });

      const yearName = marks[0]?.assessment.term?.academicYear?.name ?? null;
      const termName = marks[0]?.assessment.term?.name ?? null;
      const pkg = buildCemisMarksPackage({
        school,
        academicYear: yearName,
        term: termName,
        rows: marks.map((m) => ({
          studentNumber: m.student.studentNumber,
          luritsNumber: m.student.luritsNumber,
          firstName: m.student.firstName,
          lastName: m.student.lastName,
          gradeName: m.student.grade?.name,
          className: m.student.class?.name,
          subjectCode: m.assessment.subject?.code,
          subjectName: m.assessment.subject?.name,
          assessmentTitle: m.assessment.title,
          termName: m.assessment.term?.name,
          score: Number(m.score),
          maxMarks: m.assessment.maxMarks != null ? Number(m.assessment.maxMarks) : null,
          gradeSymbol: m.gradeSymbol,
          recordedAt: m.recordedAt,
        })),
      });

      const job = await prisma.complianceExportJob.create({
        data: {
          schoolId,
          kind: "CEMIS_MARKS",
          status: "READY",
          academicYearId: academicYearId ?? null,
          termId: termId ?? null,
          filename: `cemis-marks-${school.slug}-${Date.now()}.csv`,
          mimeType: "text/csv",
          payload: { package: pkg, csv: cemisPackageToCsv(pkg) },
          summary: { markCount: marks.length },
          createdById: session.userId,
          completedAt: new Date(),
        },
      });
      await logAudit({
        schoolId,
        userId: session.userId,
        action: "COMPLIANCE_EXPORT",
        entity: "ComplianceExportJob",
        entityId: job.id,
        metadata: { kind },
      });
      return NextResponse.json({ job, package: pkg, csv: cemisPackageToCsv(pkg) });
    }

    if (kind === "LURITS_PROMOTION") {
      const decisions = await prisma.promotionDecision.findMany({
        where: {
          schoolId,
          ...(academicYearId ? { fromAcademicYearId: academicYearId } : {}),
        },
        include: {
          student: {
            select: {
              studentNumber: true,
              firstName: true,
              lastName: true,
              saIdNumber: true,
              luritsNumber: true,
            },
          },
          fromGrade: { select: { name: true } },
          toGrade: { select: { name: true } },
          fromAcademicYear: { select: { name: true } },
          toAcademicYear: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });

      const pkg = buildPromotionLuritsPackage({
        school,
        fromAcademicYear: decisions[0]?.fromAcademicYear?.name,
        rows: decisions.map((d) => ({
          studentNumber: d.student.studentNumber,
          luritsNumber: d.student.luritsNumber,
          firstName: d.student.firstName,
          lastName: d.student.lastName,
          saIdNumber: d.student.saIdNumber,
          fromGradeName: d.fromGrade?.name,
          toGradeName: d.toGrade?.name,
          fromYearName: d.fromAcademicYear?.name,
          toYearName: d.toAcademicYear?.name,
          outcome: d.outcome,
          eligibility: d.eligibility,
          average: d.average != null ? Number(d.average) : null,
          attendancePercent: d.attendancePercent != null ? Number(d.attendancePercent) : null,
          createdAt: d.createdAt,
        })),
      });

      const job = await prisma.complianceExportJob.create({
        data: {
          schoolId,
          kind: "LURITS_PROMOTION",
          status: "READY",
          academicYearId: academicYearId ?? null,
          filename: `lurits-promotion-${school.slug}-${Date.now()}.csv`,
          mimeType: "text/csv",
          payload: { package: pkg, csv: promotionPackageToCsv(pkg) },
          summary: { decisionCount: decisions.length },
          createdById: session.userId,
          completedAt: new Date(),
        },
      });
      await logAudit({
        schoolId,
        userId: session.userId,
        action: "COMPLIANCE_EXPORT",
        entity: "ComplianceExportJob",
        entityId: job.id,
        metadata: { kind },
      });
      return NextResponse.json({ job, package: pkg, csv: promotionPackageToCsv(pkg) });
    }

    return NextResponse.json({ message: "Unknown export kind" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    await prisma.complianceExportJob.create({
      data: {
        schoolId,
        kind,
        status: "FAILED",
        errorMessage: message,
        createdById: session.userId,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ message }, { status: 500 });
  }
}