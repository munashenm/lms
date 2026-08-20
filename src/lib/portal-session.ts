import type { InstitutionType } from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./auth";
import {
  getViewSessionIdFromCookie,
  listAcademicSessions,
  resolveViewSession,
  type SessionOption,
} from "./academic-session";
import { getTerminology, type Terminology } from "./terminology";
import { requireSchoolId } from "./portal-data";
import { evaluateStoredLicense } from "@/lib/licensing/service";
import type { EvaluatedLicense } from "@/lib/licensing/types";
import { emptySchoolPortalBrand, toSchoolPortalBrand, type SchoolPortalBrand } from "./school-branding";

export async function getPortalSessionContext(session: SessionPayload): Promise<{
  schoolId: string | null;
  sessions: SessionOption[];
  viewSessionId: string | null;
  terminology: Terminology | null;
  institutionType: InstitutionType | null;
  license: EvaluatedLicense | null;
  branding: SchoolPortalBrand;
}> {
  let schoolId = session.schoolId;
  if (!schoolId) {
    try {
      schoolId = await requireSchoolId(session);
    } catch {
      return {
        schoolId: null,
        sessions: [],
        viewSessionId: null,
        terminology: null,
        institutionType: null,
        license: null,
        branding: emptySchoolPortalBrand(),
      };
    }
  }

  const cookieId = await getViewSessionIdFromCookie();
  const [sessions, viewSession, school, license] = await Promise.all([
    listAcademicSessions(schoolId),
    resolveViewSession(schoolId, cookieId),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, institutionType: true, logoUrl: true, primaryColor: true, accentColor: true },
    }),
    evaluateStoredLicense(schoolId).catch(() => null),
  ]);

  return {
    schoolId,
    sessions,
    viewSessionId: viewSession?.id ?? null,
    terminology: school ? getTerminology(school.institutionType) : null,
    institutionType: school?.institutionType ?? null,
    license,
    branding: toSchoolPortalBrand(school),
  };
}
