import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { websiteFaqSchema } from "@/lib/validators";
import { requireSchoolId } from "@/lib/portal-data";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

export async function GET() {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const schoolId = await requireSchoolId(session);
  const faqs = await prisma.websiteFaq.findMany({
    where: { schoolId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ faqs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/website/faqs",
      method: "POST",
    });
    if (__licDenied) return __licDenied;
  }

if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const parsed = websiteFaqSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  const schoolId = await requireSchoolId(session);
  const faq = await prisma.websiteFaq.create({
    data: { schoolId, ...parsed.data, isPublished: parsed.data.isPublished ?? true },
  });
  return NextResponse.json({ faq }, { status: 201 });
}
