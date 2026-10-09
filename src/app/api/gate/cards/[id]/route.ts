import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSchoolPermission } from "@/lib/gate/access";
import { cardActionSchema } from "@/lib/gate/schema";
import { deactivateAccessCard, issueAccessCard } from "@/lib/gate/cards";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireSchoolPermission("cards:manage");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const parsed = cardActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const card = await prisma.accessCard.findFirst({
    where: { id, schoolId: auth.schoolId },
    select: { id: true, holderType: true, studentId: true, userId: true },
  });
  if (!card) return NextResponse.json({ message: "Card not found" }, { status: 404 });

  if (parsed.data.action === "deactivate") {
    const result = await deactivateAccessCard({
      schoolId: auth.schoolId,
      actorId: auth.session.userId,
      cardId: card.id,
      reason: parsed.data.reason?.trim() || "Deactivated",
    });
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const issued = await issueAccessCard({
    schoolId: auth.schoolId,
    actorId: auth.session.userId,
    holderType: card.holderType,
    studentId: card.studentId,
    userId: card.userId,
    reason: parsed.data.reason?.trim() || "Reissued",
  });
  if (!issued.ok) return NextResponse.json({ message: issued.message }, { status: 404 });
  return NextResponse.json(issued);
}
