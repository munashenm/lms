import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { requireSchoolId } from "@/lib/portal-data";
import {
  VIEW_SESSION_COOKIE,
  listAcademicSessions,
  resolveViewSession,
} from "@/lib/academic-session";
import { prisma } from "@/lib/db";
import { getTerminology } from "@/lib/terminology";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  let schoolId: string | null = session.schoolId;
  if (!schoolId) {
    try {
      schoolId = await requireSchoolId(session);
    } catch {
      return NextResponse.json({ sessions: [], viewSession: null, terminology: null });
    }
  }

  const cookieId = (await cookies()).get(VIEW_SESSION_COOKIE)?.value ?? null;
  const sessions = await listAcademicSessions(schoolId);
  const viewSession = await resolveViewSession(schoolId, cookieId);
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { institutionType: true, periodStructure: true, name: true },
  });

  return NextResponse.json({
    schoolId,
    schoolName: school?.name ?? null,
    institutionType: school?.institutionType ?? null,
    periodStructure: school?.periodStructure ?? null,
    terminology: school ? getTerminology(school.institutionType) : null,
    sessions,
    viewSession,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const academicYearId = body.academicYearId as string | null | undefined;

  const cookieStore = await cookies();

  if (!academicYearId) {
    cookieStore.delete(VIEW_SESSION_COOKIE);
    return NextResponse.json({ ok: true, viewSession: null });
  }

  const filter = getSchoolFilter(session);
  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, ...filter },
    select: {
      id: true,
      name: true,
      status: true,
      isCurrent: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!year) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  cookieStore.set(VIEW_SESSION_COOKIE, year.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });

  return NextResponse.json({ ok: true, viewSession: year });
}
