import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { visitorSignOutSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { asInputJson } from "@/lib/json";
import { scopedId } from "@/lib/tenant";
import {
  canCheckoutVisitor,
  canSignOutVisitor,
  canWriteVisitorBook,
  toPublicVisitorEntry,
} from "@/lib/visitors";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || !canWriteVisitorBook(session)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.visitorEntry.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId, { feature: "visitor_management" });
  if (denied) return denied;

  const parsed = visitorSignOutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  if (parsed.data.action === "sign_out") {
    if (!canCheckoutVisitor(session)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
    if (!canSignOutVisitor(existing.signedOutAt)) {
      return NextResponse.json({ message: "This visitor has already signed out" }, { status: 409 });
    }

    const entry = await prisma.visitorEntry.update({
      where: { id },
      data: {
        signedOutAt: new Date(),
        signedOutById: session.userId,
        status: "CHECKED_OUT",
      },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
    });

    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "VISITOR_CHECKED_OUT",
      entity: "VisitorEntry",
      entityId: entry.id,
      metadata: asInputJson({ action: "sign_out" }),
    });

    return NextResponse.json({ entry: toPublicVisitorEntry(entry) });
  }

  if (parsed.data.action === "check_in" || parsed.data.action === "deny") {
    const entry = await prisma.visitorEntry.update({
      where: { id },
      data:
        parsed.data.action === "deny"
          ? { status: "DENIED" }
          : { status: "CHECKED_IN", signedInAt: new Date() },
      include: {
        campus: { select: { name: true } },
        signedInBy: { select: { firstName: true, lastName: true } },
        signedOutBy: { select: { firstName: true, lastName: true } },
      },
    });
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: parsed.data.action === "deny" ? "VISITOR_DENIED" : "VISITOR_CHECKED_IN",
      entity: "VisitorEntry",
      entityId: entry.id,
    });
    return NextResponse.json({ entry: toPublicVisitorEntry(entry) });
  }

  return NextResponse.json({ message: "Invalid action" }, { status: 400 });
}
