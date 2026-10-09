import { NextRequest, NextResponse } from "next/server";
import { VisitorStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { visitorSignOutSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { logAudit } from "@/lib/audit";
import { scopedId } from "@/lib/tenant";
import {
  canCheckoutVisitor,
  canWriteVisitorBook,
  toPublicVisitorEntry,
} from "@/lib/visitors";
import { visitorTransition } from "@/lib/gate/engine";
import { recordVisitorGate } from "@/lib/gate/visitors";

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

  if (parsed.data.action === "sign_out" && !canCheckoutVisitor(session)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const transition = visitorTransition({
    status: existing.status,
    signedOutAt: existing.signedOutAt,
    action: parsed.data.action,
  });
  if (!transition.ok) {
    return NextResponse.json({ message: transition.message }, { status: 409 });
  }

  const now = new Date();
  const entry = await prisma.visitorEntry.update({
    where: { id: existing.id },
    data: {
      status: transition.status as VisitorStatus,
      ...(transition.touchSignedIn ? { signedInAt: now } : {}),
      ...(transition.touchSignedOut ? { signedOutAt: now, signedOutById: session.userId } : {}),
    },
    include: {
      campus: { select: { name: true } },
      signedInBy: { select: { firstName: true, lastName: true } },
      signedOutBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (transition.gate) {
    await recordVisitorGate({
      schoolId: existing.schoolId,
      visitorId: existing.id,
      recordedById: session.userId,
      direction: transition.gate,
      now,
    });
  } else {
    await logAudit({
      schoolId: existing.schoolId,
      userId: session.userId,
      action: "VISITOR_CANCELLED",
      entity: "VisitorEntry",
      entityId: entry.id,
    });
  }

  return NextResponse.json({ entry: toPublicVisitorEntry(entry) });

  return NextResponse.json({ message: "Invalid action" }, { status: 400 });
}
