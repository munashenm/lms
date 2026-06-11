import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { applicationStatusSchema } from "@/lib/validators";
import { sendApplicationStatusUpdate } from "@/lib/application-notify";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = applicationStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.application.findUnique({
    where: { id },
    include: { school: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const application = await prisma.application.update({
    where: { id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes ?? undefined,
      reviewedAt: new Date(),
    },
  });

  if (existing.status !== parsed.data.status) {
    sendApplicationStatusUpdate({
      email: existing.email,
      phone: existing.phone,
      firstName: existing.firstName,
      referenceNo: existing.referenceNo,
      status: APPLICATION_STATUS_LABELS[parsed.data.status] ?? parsed.data.status,
      schoolName: existing.school.name,
    });
  }

  return NextResponse.json({ application });
}
