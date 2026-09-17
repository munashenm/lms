import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { applicationSchema } from "@/lib/validators";
import { notifySchoolRoles } from "@/lib/notifications";
import { sendApplicationConfirmation } from "@/lib/application-notify";
import { licenseDeniedResponse, licenseWriteGuard } from "@/lib/licensing/enforce";
import {
  admissionYearNumber,
  applicationReferencePrefix,
  isApplicationsOpen,
  nextApplicationReference,
} from "@/lib/admissions";
import { saveRegistrationFile } from "@/lib/registration-uploads";
import { validateRegistrationDocument } from "@/lib/registration-docs";
import { clientIp, rateLimit, rateLimitedJson } from "@/lib/rate-limit";

async function readApplicationPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const files = form.getAll("documents").filter((value): value is File => value instanceof File && value.size > 0);
    const types = form.getAll("documentTypes").map((value) => String(value));
    const raw: Record<string, unknown> = {};
    form.forEach((value, key) => {
      if (key === "documents" || key === "documentTypes") return;
      if (typeof value === "string") raw[key] = value;
    });
    return { raw, files, types };
  }
  return { raw: await request.json(), files: [] as File[], types: [] as string[] };
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "students:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const applications = await prisma.application.findMany({
    where: getSchoolFilter(session!),
    include: { documents: true },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json({ applications });
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const limited = rateLimit({ key: `apply:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    const body = rateLimitedJson(limited.retryAfterSec);
    return NextResponse.json(body.body, { status: body.status, headers: body.headers });
  }

  const { raw, files, types } = await readApplicationPayload(request);
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((i) => {
      errors[i.path[0]?.toString() ?? "form"] = i.message;
    });
    return NextResponse.json({ errors }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { slug: parsed.data.schoolSlug },
    include: { admissionYear: true },
  });

  if (!school) {
    return NextResponse.json({ message: "School not found" }, { status: 404 });
  }

  const window = isApplicationsOpen(school);
  if (!window.open) {
    return NextResponse.json({ message: window.message }, { status: 400 });
  }

  const guard = await licenseWriteGuard({ schoolId: school.id, feature: "admissions", action: "write" });
  if (!guard.ok) return licenseDeniedResponse(guard);

  for (const file of files) {
    const invalid = validateRegistrationDocument(file);
    if (invalid) {
      return NextResponse.json({ message: invalid }, { status: 400 });
    }
  }

  const year = admissionYearNumber(school.admissionYear);
  const prefix = applicationReferencePrefix(year);
  const count = await prisma.application.count({
    where: { schoolId: school.id, referenceNo: { startsWith: prefix } },
  });
  const referenceNo = nextApplicationReference(year, count + 1);
  const popiaAccepted =
    parsed.data.popiaAccepted === true ||
    parsed.data.popiaAccepted === "true" ||
    parsed.data.popiaAccepted === "on" ||
    parsed.data.popiaAccepted === "1";

  const gender = parsed.data.gender ?? null;

  const application = await prisma.application.create({
    data: {
      schoolId: school.id,
      referenceNo,
      academicYearId: parsed.data.academicYearId || school.admissionYearId,
      campusId: emptyToNull(parsed.data.campusId),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      saIdNumber: emptyToNull(parsed.data.saIdNumber),
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
      gender,
      nationality: emptyToNull(parsed.data.nationality),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      address: emptyToNull(parsed.data.address),
      city: emptyToNull(parsed.data.city),
      province: emptyToNull(parsed.data.province),
      postalCode: emptyToNull(parsed.data.postalCode),
      gradeApplied: emptyToNull(parsed.data.gradeApplied),
      courseApplied: emptyToNull(parsed.data.courseApplied),
      previousSchool: emptyToNull(parsed.data.previousSchool),
      previousGrade: emptyToNull(parsed.data.previousGrade),
      additionalInfo: emptyToNull(parsed.data.additionalInfo),
      notes: emptyToNull(parsed.data.notes) ?? emptyToNull(parsed.data.additionalInfo),
      popiaAccepted,
      guardianFirstName: emptyToNull(parsed.data.guardianFirstName),
      guardianLastName: emptyToNull(parsed.data.guardianLastName),
      guardianEmail: emptyToNull(parsed.data.guardianEmail),
      guardianPhone: emptyToNull(parsed.data.guardianPhone),
      guardianRelationship: emptyToNull(parsed.data.guardianRelationship),
    },
  });

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const saved = await saveRegistrationFile({
      schoolId: school.id,
      folder: `applications/${application.id}`,
      file,
    });
    const documentType = types[index] || "OTHER";
    await prisma.applicationDocument.create({
      data: {
        applicationId: application.id,
        documentType,
        title: documentType,
        fileName: saved.filename,
        fileUrl: saved.url,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
      },
    });
  }

  await notifySchoolRoles({
    schoolId: school.id,
    roles: [UserRole.ADMISSIONS_OFFICER, UserRole.SCHOOL_ADMIN],
    title: "New application",
    message: `${parsed.data.firstName} ${parsed.data.lastName} submitted application ${referenceNo}.`,
    type: "ADMISSION",
    link: "/admin/applications",
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  await sendApplicationConfirmation({
    schoolId: school.id,
    referenceNo,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    schoolName: school.name,
    appUrl,
  });

  return NextResponse.json({ application, referenceNo }, { status: 201 });
}
