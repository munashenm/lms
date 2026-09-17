import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, canAccessSchool } from "@/lib/rbac";
import { getStudentForSession, getChildStudentIds } from "@/lib/portal-data";
import { UserRole } from "@prisma/client";
import { institutionScope } from "@/lib/tenant";
import { tenantMiss } from "@/lib/authorize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...institutionScope(session) },
    include: {
      student: true,
      lineItems: true,
      payments: { orderBy: { paidAt: "desc" } },
      school: { select: { name: true } },
    },
  });

  if (!invoice || !canAccessSchool(session, invoice.schoolId)) {
    return tenantMiss();
  }

  if (session.role === UserRole.STUDENT) {
    const student = await getStudentForSession(session);
    if (!student || invoice.studentId !== student.id) {
      return tenantMiss();
    }
  } else if (session.role === UserRole.PARENT) {
    const childIds = await getChildStudentIds(session);
    if (!childIds.includes(invoice.studentId)) {
      return tenantMiss();
    }
  } else if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({ invoice });
}
