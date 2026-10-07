import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scopedId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";
import { websiteGallerySchema } from "@/lib/validators";
import { requireLicenseMutation } from "@/lib/licensing/enforce";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/website/gallery",
      method: "PATCH",
    });
    if (__licDenied) return __licDenied;
  }
if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.websiteGalleryItem.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const parsed = websiteGallerySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }
  const item = await prisma.websiteGalleryItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  
  const __licSchoolId = session?.schoolId ?? null;
  if (__licSchoolId) {
    const __licDenied = await requireLicenseMutation(__licSchoolId, {
      pathname: "/api/website/gallery",
      method: "DELETE",
    });
    if (__licDenied) return __licDenied;
  }
if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.websiteGalleryItem.findFirst({ where: scopedId(session, id) });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  await prisma.websiteGalleryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
