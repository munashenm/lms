import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["BANK", "CASH", "MOBILE"]).default("BANK"),
  campusId: z.string().optional().nullable(),
  accountRef: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const accounts = await prisma.financialAccount.findMany({
    where: getSchoolFilter(session!),
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance.expenses.manage") && !requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session!);
  const denied = await requireLicenseWrite(schoolId, { feature: "finance" });
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  const account = await prisma.financialAccount.create({
    data: { schoolId, ...parsed.data },
  });
  return NextResponse.json({ account }, { status: 201 });
}
