import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scopedId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";
import { websiteFaqSchema } from "@/lib/validators";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/website/faqs",
      method: "PATCH",
    });
    if (__licDenied) return __licDenied;
  }
if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.websiteFaq.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const parsed = websiteFaqSchema.partial().safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }
  const faq = await prisma.websiteFaq.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ faq });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/website/faqs",
      method: "DELETE",
    });
    if (__licDenied) return __licDenied;
  }
if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.websiteFaq.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  await prisma.websiteFaq.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
