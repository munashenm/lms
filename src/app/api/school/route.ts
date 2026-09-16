import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { schoolSettingsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schoolId = resolveSettingsSchoolId(
    session!,
    request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ schools });
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { campuses: { where: { isActive: true }, orderBy: { name: "asc" } } },
  });

  if (!school) {
    return NextResponse.json({ message: "School not found" }, { status: 404 });
  }

  return NextResponse.json({ school });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!requirePermission(session, "settings:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const schoolId = resolveSettingsSchoolId(
    session!,
    body.schoolId ?? request.nextUrl.searchParams.get("schoolId")
  );

  if (!schoolId) {
    return NextResponse.json({ message: "School context required" }, { status: 400 });
  }

  const parsed = schoolSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "Invalid data",
        errors: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const nullableStrings = [
    "logoUrl",
    "primaryColor",
    "accentColor",
    "website",
    "heroHeadline",
    "heroSubtitle",
    "aboutText",
    "missionText",
    "visionText",
    "valuesText",
    "principalName",
    "principalTitle",
    "principalMessage",
    "admissionsText",
    "applicationInstructions",
    "faviconUrl",
    "heroImageUrl",
    "whatsapp",
    "officeHours",
    "facebookUrl",
    "instagramUrl",
    "twitterUrl",
    "linkedinUrl",
    "youtubeUrl",
    "email",
    "admissionYearId",
    "applicationsOpenFrom",
    "applicationsOpenUntil",
  ] as const;

  const data: Record<string, unknown> = { ...parsed.data };
  for (const key of nullableStrings) {
    if (key in data) {
      const value = data[key];
      if (value === "" || value === undefined) data[key] = null;
    }
  }
  if (typeof data.applicationsOpenFrom === "string" && data.applicationsOpenFrom) {
    data.applicationsOpenFrom = new Date(data.applicationsOpenFrom as string);
  }
  if (typeof data.applicationsOpenUntil === "string" && data.applicationsOpenUntil) {
    data.applicationsOpenUntil = new Date(data.applicationsOpenUntil as string);
  }

  try {
    const school = await prisma.school.update({
      where: { id: schoolId },
      data: data as Prisma.SchoolUpdateInput,
    });

    await logAudit({
      schoolId,
      userId: session!.userId,
      action: "UPDATE",
      entity: "School",
      entityId: school.id,
      metadata: { fields: Object.keys(parsed.data) },
    });

    return NextResponse.json({ school });
  } catch {
    return NextResponse.json({ message: "Could not save settings" }, { status: 500 });
  }
}
