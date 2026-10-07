import { NextRequest, NextResponse } from "next/server";
import { BudgetStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { z } from "zod";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

const budgetSchema = z.object({
  name: z.string().min(1).max(120),
  academicYearId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  notes: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        category: z.string().min(1).max(120),
        description: z.string().optional().nullable(),
        amount: z.number().nonnegative(),
        sortOrder: z.number().int().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session || !requirePermission(session, "finance.view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const budgets = await prisma.budget.findMany({
    where: { schoolId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ budgets });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/finance/budgets",
      method: "POST",
      feature: "finance",
    });
    if (__licDenied) return __licDenied;
  }

if (!session || !requirePermission(session, "finance:write")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const parsed = budgetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", issues: parsed.error.flatten() }, { status: 400 });
  }

  const budget = await prisma.budget.create({
    data: {
      schoolId,
      name: parsed.data.name,
      academicYearId: parsed.data.academicYearId || null,
      status: (parsed.data.status as BudgetStatus) ?? "DRAFT",
      notes: parsed.data.notes || null,
      createdById: session.userId,
      lines: parsed.data.lines
        ? {
            create: parsed.data.lines.map((line, index) => ({
              category: line.category,
              description: line.description || null,
              amount: line.amount,
              sortOrder: line.sortOrder ?? index,
            })),
          }
        : undefined,
    },
    include: { lines: true },
  });

  return NextResponse.json({ budget }, { status: 201 });
}