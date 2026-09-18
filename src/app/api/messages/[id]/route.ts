import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  action: z.enum(["read", "archive", "unarchive"]),
});

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || !requirePermission(session, "messaging.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const message = await prisma.internalMessage.findFirst({
    where: {
      id,
      OR: [{ senderId: session.userId }, { recipients: { some: { userId: session.userId } } }],
    },
    include: {
      sender: { select: { firstName: true, lastName: true, role: true } },
      recipients: { include: { user: { select: { firstName: true, lastName: true, role: true } } } },
    },
  });
  if (!message) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ message });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || !requirePermission(session, "messaging.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  const receipt = await prisma.messageRecipient.findFirst({
    where: { messageId: id, userId: session.userId },
  });
  if (!receipt) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const updated = await prisma.messageRecipient.update({
    where: { id: receipt.id },
    data:
      parsed.data.action === "read"
        ? { readAt: new Date() }
        : parsed.data.action === "archive"
          ? { archivedAt: new Date() }
          : { archivedAt: null },
  });
  return NextResponse.json({ receipt: updated });
}
