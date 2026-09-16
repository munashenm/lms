import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { licenseCustomerSchema } from "@/lib/validators";
import { logLicenseServerAudit } from "@/lib/license-server/audit";
import { emptyToNull } from "@/lib/class-teachers";
import { requestMeta } from "@/lib/request-meta";
import { forbiddenJson } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN || !requirePermission(session, "license.manage")) {
    return forbiddenJson();
  }
  const customers = await prisma.licenseCustomer.findMany({
    include: { _count: { select: { licences: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ customers });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN || !requirePermission(session, "license.manage")) {
    return forbiddenJson();
  }
  const parsed = licenseCustomerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid customer" }, { status: 400 });
  }
  const customer = await prisma.licenseCustomer.create({
    data: {
      name: parsed.data.name.trim(),
      email: emptyToNull(parsed.data.email),
      notes: emptyToNull(parsed.data.notes),
    },
  });
  await logLicenseServerAudit({
    action: "CUSTOMER_CREATED",
    actor: session.email,
    result: "ok",
    metadata: { customerId: customer.id, name: customer.name },
    ipAddress: requestMeta(request).ipAddress,
  });
  return NextResponse.json({ customer }, { status: 201 });
}
