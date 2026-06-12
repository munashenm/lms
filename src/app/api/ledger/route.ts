import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission, getSchoolFilter } from "@/lib/rbac";
import { ledgerEntrySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      ...getSchoolFilter(session!),
      ...(type && { type: type as "INCOME" | "EXPENSE" }),
    },
    orderBy: { entryDate: "desc" },
  });

  const income = entries.filter((e) => e.type === "INCOME").reduce((s, e) => s + Number(e.amount), 0);
  const expenses = entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);

  return NextResponse.json({
    entries,
    summary: { income, expenses, net: income - expenses },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = ledgerEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  if (!session!.schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const entry = await prisma.ledgerEntry.create({
    data: {
      schoolId: session!.schoolId,
      type: parsed.data.type,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      reference: parsed.data.reference ?? null,
      entryDate: new Date(parsed.data.entryDate),
      recordedById: session!.userId,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
