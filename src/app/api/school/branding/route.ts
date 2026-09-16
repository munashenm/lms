import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";
import { logAudit } from "@/lib/audit";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const KINDS = ["logo", "favicon", "hero", "gallery"] as const;
type BrandingKind = (typeof KINDS)[number];

function extFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const form = await request.formData();
  const schoolId = resolveSettingsSchoolId(
    session!,
    (form.get("schoolId") as string | null) ?? request.nextUrl.searchParams.get("schoolId")
  );
  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "logo") as BrandingKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ message: "Unknown upload kind" }, { status: 400 });
  }

  const file = form.get("file") ?? form.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Image file required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ message: "Use PNG, JPEG or WebP files" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "Image must be under 5MB" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", schoolId, "branding");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `${kind}-${Date.now()}.${extFor(file.type)}`;
  await writeFile(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));
  const url = `/uploads/${schoolId}/branding/${filename}`;

  if (kind === "gallery") {
    const item = await prisma.websiteGalleryItem.create({
      data: {
        schoolId,
        imageUrl: url,
        caption: String(form.get("caption") ?? "") || null,
        altText: String(form.get("altText") ?? "") || null,
      },
    });
    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "CREATE",
      entity: "WebsiteGalleryItem",
      entityId: item.id,
    });
    return NextResponse.json({ item, url }, { status: 201 });
  }

  const field = kind === "logo" ? "logoUrl" : kind === "favicon" ? "faviconUrl" : "heroImageUrl";
  const school = await prisma.school.update({
    where: { id: schoolId },
    data: { [field]: url },
  });
  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "School",
    entityId: schoolId,
    metadata: { [field]: url },
  });
  return NextResponse.json({ school, url });
}
