import { NextRequest, NextResponse } from "next/server";
import { AccrualMethod, LeaveType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { z } from "zod";

const schema = z.object({
  leaveType: z.nativeEnum(LeaveType),
  name: z.string().min(1),
  daysPerYear: z.coerce.number().min(0),
  accrualMethod: z.nativeEnum(AccrualMethod).optional(),
  requiresHrApproval: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "hr.view") && !requirePermission(session, "hr.leave.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const policies = await prisma.leavePolicy.findMany({
    where: getSchoolFilter(session!),
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ policies });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "hr.leave.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "hr_payroll" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const policy = await prisma.leavePolicy.create({
    data: { schoolId, ...parsed.data },
  });
  return NextResponse.json({ policy }, { status: 201 });
}
