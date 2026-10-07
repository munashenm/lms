import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SYSTEM_MODULES } from "@/lib/modules";
import { createInstitutionSchema } from "@/lib/validators";
import { createInstitutionWithTrial } from "@/lib/institutions/create";
import { DEFAULT_PRICE_PER_LEARNER } from "@/lib/licensing/commercial";

export async function GET() {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      institutionType: true,
      isActive: true,
      _count: { select: { users: true, students: true } },
      schoolModules: { select: { moduleKey: true, enabled: true } },
      license: {
        select: {
          status: true,
          expiresAt: true,
          planCode: true,
          pricePerLearner: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    schools: schools.map((school) => {
      const disabled = school.schoolModules.filter((row) => !row.enabled).map((row) => row.moduleKey);
      return {
        ...school,
        enabledModules: SYSTEM_MODULES.length - disabled.length,
        disabledModules: disabled,
      };
    }),
    defaults: {
      suggestedPricePerLearner: DEFAULT_PRICE_PER_LEARNER.toString(),
      priceCurrency: "ZAR",
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const parsed = createInstitutionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid data", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await createInstitutionWithTrial({
      ...parsed.data,
      adminPhone: parsed.data.adminPhone || null,
      trialExpiresAt: parsed.data.trialExpiresAt ? new Date(parsed.data.trialExpiresAt) : null,
      actorUserId: session.userId,
      actorEmail: session.email,
    });
    return NextResponse.json(
      {
        ok: true,
        school: {
          id: result.school.id,
          name: result.school.name,
          slug: result.school.slug,
        },
        adminUserId: result.adminUserId,
        invitesSent: result.invitesSent,
        license: {
          status: result.license.status,
          expiresAt: result.license.expiresAt,
          pricePerLearner: result.license.pricePerLearner?.toString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not create institution" },
      { status }
    );
  }
}
