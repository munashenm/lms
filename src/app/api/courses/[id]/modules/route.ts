import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { moduleSchema } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "classes:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id: courseId } = await params;
  const body = await request.json();
  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ message: "Course not found" }, { status: 404 });
  }

  const mod = await prisma.module.create({
    data: {
      courseId,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      credits: parsed.data.credits ?? null,
      sortOrder: parsed.data.sortOrder,
    },
  });

  return NextResponse.json({ module: mod }, { status: 201 });
}
