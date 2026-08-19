import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { ensureFinanceCatalog } from "@/lib/finance-catalog";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  vatNumber: z.string().optional(),
  accountRef: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "finance.view") && !requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = session!.schoolId;
  if (schoolId) await ensureFinanceCatalog(schoolId);
  const suppliers = await prisma.supplier.findMany({
    where: getSchoolFilter(session!),
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ suppliers });
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
  const supplier = await prisma.supplier.create({
    data: { schoolId, ...parsed.data, email: parsed.data.email || null },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "CREATE",
    entity: "Supplier",
    entityId: supplier.id,
    metadata: { name: supplier.name },
  });
  return NextResponse.json({ supplier }, { status: 201 });
}
