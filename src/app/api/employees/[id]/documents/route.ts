import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { EmployeeDocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { visibleEmployeeDocuments } from "@/lib/timesheet-hours";

interface Params {
  params: Promise<{ id: string }>;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

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

  if (!file || !title) {
    return NextResponse.json({ message: "File and title required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "File must be under 10 MB" }, { status: 400 });
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ message: "Upload a PDF or image (JPG, PNG, WebP)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadsDir = path.join(process.cwd(), "public", "uploads", employee.schoolId, "hr", id);
  await mkdir(uploadsDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  await writeFile(path.join(uploadsDir, filename), buffer);

  const document = await prisma.employeeDocument.create({
    data: {
      employeeId: id,
      type,
      title,
      fileUrl: `/uploads/${employee.schoolId}/hr/${id}/${filename}`,
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
