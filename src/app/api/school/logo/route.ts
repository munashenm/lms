import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";
import { logAudit } from "@/lib/audit";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg"]);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const form = await request.formData();
  const schoolId = resolveSettingsSchoolId(
    session!,
    (form.get("schoolId") as string | null) ??
      request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const file = form.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Logo file required" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { message: "Use a PNG or JPEG logo so it prints on invoices and reports" },
      { status: 400 }
    );
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ message: "Logo must be under 2MB" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";

  const uploadsDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    schoolId,
    "branding"
  );
  await mkdir(uploadsDir, { recursive: true });
  const filename = `logo-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  const logoUrl = `/uploads/${schoolId}/branding/${filename}`;

  const school = await prisma.school.update({
    where: { id: schoolId },
    data: { logoUrl },
  });

  await logAudit({
    schoolId,
    userId: session!.userId,
    action: "UPDATE",
    entity: "School",
    entityId: schoolId,
    metadata: { logoUrl },
  });

  return NextResponse.json({ school, logoUrl });
}
