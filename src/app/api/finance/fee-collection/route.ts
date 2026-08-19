import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import {
  COLLECTABLE_INVOICE_STATUSES,
  FEE_COLLECTION_MIN_QUERY,
  feeCollectionSearchWhere,
  toPublicFeeCollectionStudent,
} from "@/lib/fee-collection";

const studentInclude = {
  grade: { select: { name: true } },
  class: { select: { name: true } },
  invoices: {
    where: { status: { in: [...COLLECTABLE_INVOICE_STATUSES] } },
    select: {
      id: true,
      invoiceNumber: true,
      description: true,
      status: true,
      total: true,
      amountPaid: true,
      dueDate: true,
      issuedAt: true,
    },
    orderBy: { issuedAt: "desc" as const },
  },
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const filter = getSchoolFilter(session);
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const classId = searchParams.get("classId") ?? "";
  const studentId = searchParams.get("studentId") ?? "";

  const classes = await prisma.class.findMany({
    where: { ...filter, isActive: true },
    select: { id: true, name: true, grade: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const where = feeCollectionSearchWhere({
    schoolId: "schoolId" in filter ? filter.schoolId : undefined,
    query,
    classId,
    studentId,
  });

  if (!where) {
    return NextResponse.json({
      students: [],
      classes: classes.map((row) => ({
        id: row.id,
        name: row.name,
        gradeName: row.grade?.name ?? null,
      })),
      message:
        query.trim().length > 0 && query.trim().length < FEE_COLLECTION_MIN_QUERY
          ? `Enter at least ${FEE_COLLECTION_MIN_QUERY} characters, or choose a class.`
          : undefined,
    });
  }

  const students = await prisma.student.findMany({
    where,
    include: studentInclude,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 40,
  });

  return NextResponse.json({
    students: students.map(toPublicFeeCollectionStudent),
    classes: classes.map((row) => ({
      id: row.id,
      name: row.name,
      gradeName: row.grade?.name ?? null,
    })),
  });
}
