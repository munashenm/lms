import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";

const schema = z.object({
  studentId: z.string().min(1),
  notifyAbsent: z.boolean(),
  notifyLate: z.boolean(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== UserRole.PARENT) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const guardian = await getGuardianForSession(session);
  if (!guardian) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

  const link = guardian.students.find((row) => row.studentId === parsed.data.studentId);
  if (!link) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

  try {
    await prisma.studentGuardian.update({
      where: { id: link.id },
      data: {
        notifyAbsent: parsed.data.notifyAbsent,
        notifyLate: parsed.data.notifyLate,
      },
    });
  } catch (error) {
    console.error("attendance alert save failed", error);
    return NextResponse.json({ message: "Could not save alerts" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
