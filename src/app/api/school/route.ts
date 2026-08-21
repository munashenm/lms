import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { schoolSettingsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { resolveSettingsSchoolId } from "@/lib/school-integrations";

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

  const data = {
    ...parsed.data,
    ...(parsed.data.logoUrl !== undefined && {
      logoUrl: parsed.data.logoUrl || null,
    }),
    ...(parsed.data.primaryColor !== undefined && {
      primaryColor: parsed.data.primaryColor || null,
    }),
    ...(parsed.data.accentColor !== undefined && {
      accentColor: parsed.data.accentColor || null,
    }),
    ...(parsed.data.website !== undefined && {
      website: parsed.data.website || null,
    }),
    ...(parsed.data.heroHeadline !== undefined && {
      heroHeadline: parsed.data.heroHeadline || null,
    }),
    ...(parsed.data.heroSubtitle !== undefined && {
      heroSubtitle: parsed.data.heroSubtitle || null,
    }),
    ...(parsed.data.aboutText !== undefined && {
      aboutText: parsed.data.aboutText || null,
    }),
    ...(parsed.data.missionText !== undefined && {
      missionText: parsed.data.missionText || null,
    }),
    ...(parsed.data.admissionsText !== undefined && {
      admissionsText: parsed.data.admissionsText || null,
    }),
    ...(parsed.data.email !== undefined && {
      email: parsed.data.email || null,
    }),
    ...(parsed.data.bankName !== undefined && {
      bankName: parsed.data.bankName || null,
    }),
    ...(parsed.data.bankAccountName !== undefined && {
      bankAccountName: parsed.data.bankAccountName || null,
    }),
    ...(parsed.data.bankAccountNumber !== undefined && {
      bankAccountNumber: parsed.data.bankAccountNumber
        ? parsed.data.bankAccountNumber.replace(/\s+/g, "")
        : null,
    }),
    ...(parsed.data.bankBranchCode !== undefined && {
      bankBranchCode: parsed.data.bankBranchCode
        ? parsed.data.bankBranchCode.replace(/\s+/g, "")
        : null,
    }),
  };

  try {
    const school = await prisma.school.update({
      where: { id: schoolId },
      data,
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
