import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, hasPermission } from "@/lib/rbac";
import { processCommunicationBatch } from "@/lib/bulk-fee-comms";
import { requireLicenseWrite } from "@/lib/licensing/enforce";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (
    !hasPermission(session.role, "announcements:write") &&
    !hasPermission(session.role, "settings:write") &&
    !hasPermission(session.role, "finance:write")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const batch = await prisma.communicationBatch.findUnique({ where: { id } });
  if (!batch || !canAccessSchool(session, batch.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(batch.schoolId);
  if (denied) return denied;

  const result = await processCommunicationBatch(id, 50);
  return NextResponse.json(result);
}
