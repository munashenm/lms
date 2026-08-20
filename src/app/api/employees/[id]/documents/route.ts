import { NextRequest, NextResponse } from "next/server";
import { EmployeeDocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { visibleEmployeeDocuments } from "@/lib/timesheet-hours";
import { validateRegistrationDocument } from "@/lib/registration-docs";
import { saveRegistrationFile } from "@/lib/registration-uploads";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });
  if (!employee || !canAccessSchool(session, employee.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const isSelf = employee.userId === session.userId;
  const canManage = requirePermission(session, "hr.documents.manage");
  if (!isSelf && !canManage && !requirePermission(session, "hr.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  return NextResponse.json({
    documents: visibleEmployeeDocuments(employee.documents, {
      isSelf,
      canManageDocs: canManage,
      canView: requirePermission(session, "hr.view"),
    }),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "hr.documents.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || !canAccessSchool(session!, employee.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const denied = await requireLicenseWrite(employee.schoolId, { feature: "hr_payroll" });
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  const type = (formData.get("type") as EmployeeDocumentType) || EmployeeDocumentType.OTHER;
  const expiresAt = formData.get("expiresAt") as string | null;

  if (!(file instanceof File) || !title) {
    return NextResponse.json({ message: "File and title required" }, { status: 400 });
  }
  const invalid = validateRegistrationDocument(file);
  if (invalid) {
    return NextResponse.json({ message: invalid }, { status: 400 });
  }

  const saved = await saveRegistrationFile({
    schoolId: employee.schoolId,
    folder: `hr/${id}`,
    file,
  });

  const document = await prisma.employeeDocument.create({
    data: {
      employeeId: id,
      type,
      title,
      fileUrl: saved.url,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  await logAudit({
    schoolId: employee.schoolId,
    userId: session!.userId,
    action: "EMPLOYEE_DOCUMENT_UPLOADED",
    entity: "EmployeeDocument",
    entityId: document.id,
    metadata: { employeeId: id, type, title },
  });
  return NextResponse.json({ document }, { status: 201 });
}
