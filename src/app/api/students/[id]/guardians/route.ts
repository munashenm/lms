import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessSchool, requirePermission } from "@/lib/rbac";
import { studentGuardianSchema } from "@/lib/validators";
import { provisionPortalAccounts } from "@/lib/portal-provision";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || !canAccessSchool(session, student.schoolId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const parsed = studentGuardianSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data", errors: parsed.error.issues }, { status: 400 });
  }

  let provision: { studentLoginCreated: boolean; guardianLinked: boolean; invitesSent: number };
  try {
    provision = await provisionPortalAccounts({
      studentId: student.id,
      schoolId: student.schoolId,
      actorId: session.userId,
      application: {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        guardianFirstName: parsed.data.firstName,
        guardianLastName: parsed.data.lastName,
        guardianEmail: parsed.data.email || null,
        guardianPhone: parsed.data.phone || null,
        guardianRelationship: parsed.data.relationship || "Parent",
      },
    });
  } catch {
    return NextResponse.json({ message: "Could not link guardian" }, { status: 400 });
  }

  return NextResponse.json({ provision }, { status: 201 });
}
