import { NextRequest, NextResponse } from "next/server";
import { FinanceProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter, requirePermission } from "@/lib/rbac";
import { z } from "zod";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

const projectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  targetAmount: z.number().nonnegative().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  opensAt: z.string().optional().nullable(),
  closesAt: z.string().optional().nullable(),
  allowParentPay: z.boolean().optional(),
});

const contributionSchema = z.object({
  projectId: z.string(),
  amount: z.number().positive(),
  studentId: z.string().optional().nullable(),
  payerName: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session || !requirePermission(session, "finance.view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const filter = getSchoolFilter(session);
  const schoolId = "schoolId" in filter ? filter.schoolId : null;
  if (!schoolId) return NextResponse.json({ message: "Select a school" }, { status: 400 });

  const projects = await prisma.financeProject.findMany({
    where: { schoolId },
    include: {
      contributions: { orderBy: { paidAt: "desc" }, take: 20 },
      _count: { select: { contributions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/finance/projects",
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

  const body = await request.json();
  if (body.action === "contribute") {
    const parsed = contributionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid contribution" }, { status: 400 });
    }
    const project = await prisma.financeProject.findFirst({
      where: { id: parsed.data.projectId, schoolId },
    });
    if (!project || project.status !== "OPEN") {
      return NextResponse.json({ message: "Project not open" }, { status: 400 });
    }
    const [contribution] = await prisma.$transaction([
      prisma.financeProjectContribution.create({
        data: {
          projectId: project.id,
          amount: parsed.data.amount,
          studentId: parsed.data.studentId || null,
          payerName: parsed.data.payerName || null,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
        },
      }),
      prisma.financeProject.update({
        where: { id: project.id },
        data: { amountRaised: { increment: parsed.data.amount } },
      }),
    ]);
    return NextResponse.json({ contribution }, { status: 201 });
  }

  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const project = await prisma.financeProject.create({
    data: {
      schoolId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      targetAmount: parsed.data.targetAmount ?? 0,
      status: (parsed.data.status as FinanceProjectStatus) ?? "OPEN",
      opensAt: parsed.data.opensAt ? new Date(parsed.data.opensAt) : null,
      closesAt: parsed.data.closesAt ? new Date(parsed.data.closesAt) : null,
      allowParentPay: parsed.data.allowParentPay ?? true,
      createdById: session.userId,
    },
  });
  return NextResponse.json({ project }, { status: 201 });
}