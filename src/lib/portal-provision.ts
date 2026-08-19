import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import { hashPassword } from "./auth";
import { logAudit } from "./audit";
import { issuePasswordSetup } from "./password-reset";

export { learnerPortalShouldBeActive, staffPortalShouldBeActive, nextSelfAttendanceAction } from "./portal-lifecycle";

export function normalizePortalEmail(email: string | null | undefined): string | null {
  const value = (email ?? "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

export type PortalGuardianPlan = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  relationship: string;
  loginEmail: string | null;
};

export type PortalProvisionPlan = {
  studentLoginEmail: string | null;
  guardian: PortalGuardianPlan | null;
};

export function planPortalProvision(input: {
  applicantLastName: string;
  applicantEmail?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
}): PortalProvisionPlan {
  const applicantEmail = normalizePortalEmail(input.applicantEmail);
  const guardianEmail = normalizePortalEmail(input.guardianEmail);
  const guardianFirst = (input.guardianFirstName ?? "").trim();
  const guardianLast = (input.guardianLastName ?? "").trim();
  const hasGuardian = Boolean(guardianFirst && guardianLast) || Boolean(guardianEmail);

  if (!hasGuardian) {
    return { studentLoginEmail: applicantEmail, guardian: null };
  }

  const studentLoginEmail =
    applicantEmail && applicantEmail !== guardianEmail ? applicantEmail : null;

  return {
    studentLoginEmail,
    guardian: {
      firstName: guardianFirst || "Guardian",
      lastName: guardianLast || input.applicantLastName.trim() || "Family",
      email: guardianEmail,
      phone: (input.guardianPhone ?? "").trim() || null,
      relationship: (input.guardianRelationship ?? "").trim() || "Parent",
      loginEmail: guardianEmail,
    },
  };
}

export const STAFF_PORTAL_ROLES = [
  UserRole.STAFF,
  UserRole.TEACHER,
  UserRole.FINANCE_OFFICER,
  UserRole.HR_OFFICER,
  UserRole.ADMISSIONS_OFFICER,
] as const;

export type StaffPortalRole = (typeof STAFF_PORTAL_ROLES)[number];

export function isStaffPortalRole(role: string): role is StaffPortalRole {
  return (STAFF_PORTAL_ROLES as readonly string[]).includes(role);
}

export function isOfficerPortalRole(role: UserRole): boolean {
  return (
    role === UserRole.FINANCE_OFFICER ||
    role === UserRole.HR_OFFICER ||
    role === UserRole.ADMISSIONS_OFFICER
  );
}

export function canAssignStaffPortalRole(actorRole: UserRole, portalRole: StaffPortalRole): boolean {
  if (portalRole === UserRole.STAFF || portalRole === UserRole.TEACHER) return true;
  return actorRole === UserRole.SCHOOL_ADMIN || actorRole === UserRole.SUPER_ADMIN;
}

/** Roles that may be invited from Admin → Users. Never STUDENT, PARENT, TEACHER, or SUPER_ADMIN. */
export const DIRECTORY_INVITE_ROLES = [
  UserRole.STAFF,
  UserRole.FINANCE_OFFICER,
  UserRole.HR_OFFICER,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.PRINCIPAL,
  UserRole.SCHOOL_ADMIN,
] as const;

export type DirectoryInviteRole = (typeof DIRECTORY_INVITE_ROLES)[number];

export function isDirectoryInviteRole(role: string): role is DirectoryInviteRole {
  return (DIRECTORY_INVITE_ROLES as readonly string[]).includes(role);
}

export function canAssignDirectoryRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (!isDirectoryInviteRole(targetRole)) return false;
  if (targetRole === UserRole.SCHOOL_ADMIN) return actorRole === UserRole.SUPER_ADMIN;
  return actorRole === UserRole.SCHOOL_ADMIN || actorRole === UserRole.SUPER_ADMIN;
}

export function directoryRolesForActor(actorRole: UserRole): DirectoryInviteRole[] {
  return DIRECTORY_INVITE_ROLES.filter((role) => canAssignDirectoryRole(actorRole, role));
}

export function needsAdministratorLicense(role: UserRole): boolean {
  return (
    role === UserRole.SCHOOL_ADMIN ||
    role === UserRole.PRINCIPAL ||
    role === UserRole.FINANCE_OFFICER ||
    role === UserRole.HR_OFFICER ||
    role === UserRole.ADMISSIONS_OFFICER
  );
}

export function defaultStaffPortalRole(input: {
  category?: string | null;
  teacherId?: string | null;
}): StaffPortalRole {
  if (input.teacherId) return UserRole.TEACHER;
  return UserRole.STAFF;
}

function portalWelcomeKind(
  role: UserRole
): "welcome_student" | "welcome_parent" | "welcome_staff" {
  if (role === UserRole.STUDENT) return "welcome_student";
  if (role === UserRole.PARENT) return "welcome_parent";
  return "welcome_staff";
}

export async function findOrCreatePortalUser(params: {
  schoolId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: UserRole;
  actorId: string;
  source?: string;
}): Promise<{ userId: string; created: boolean } | { skipped: true }> {
  const email = normalizePortalEmail(params.email);
  if (!email) return { skipped: true };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.schoolId === params.schoolId && existing.role === params.role && existing.isActive) {
      return { userId: existing.id, created: false };
    }
    return { skipped: true };
  }

  const user = await prisma.user.create({
    data: {
      schoolId: params.schoolId,
      email,
      passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone ?? null,
      role: params.role,
      isActive: true,
      emailVerified: false,
    },
  });
  await issuePasswordSetup({
    userId: user.id,
    schoolId: params.schoolId,
    email,
    firstName: params.firstName,
    kind: portalWelcomeKind(params.role),
  });
  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    metadata: { role: params.role, source: params.source ?? "application" },
  });
  return { userId: user.id, created: true };
}

export async function provisionPortalAccounts(params: {
  studentId: string;
  schoolId: string;
  actorId: string;
  application: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    guardianFirstName: string | null;
    guardianLastName: string | null;
    guardianEmail: string | null;
    guardianPhone: string | null;
    guardianRelationship: string | null;
  };
}): Promise<{ studentLoginCreated: boolean; guardianLinked: boolean; invitesSent: number }> {
  const plan = planPortalProvision({
    applicantLastName: params.application.lastName,
    applicantEmail: params.application.email,
    guardianFirstName: params.application.guardianFirstName,
    guardianLastName: params.application.guardianLastName,
    guardianEmail: params.application.guardianEmail,
    guardianPhone: params.application.guardianPhone,
    guardianRelationship: params.application.guardianRelationship,
  });

  const student = await prisma.student.findFirst({
    where: { id: params.studentId, schoolId: params.schoolId },
    select: { userId: true },
  });
  if (!student) return { studentLoginCreated: false, guardianLinked: false, invitesSent: 0 };

  let studentLoginCreated = false;
  let guardianLinked = false;
  let invitesSent = 0;

  if (plan.studentLoginEmail && !student.userId) {
    const result = await findOrCreatePortalUser({
      schoolId: params.schoolId,
      email: plan.studentLoginEmail,
      firstName: params.application.firstName,
      lastName: params.application.lastName,
      phone: params.application.phone,
      role: UserRole.STUDENT,
      actorId: params.actorId,
    });
    if (!("skipped" in result)) {
      await prisma.student.update({
        where: { id: params.studentId },
        data: { userId: result.userId },
      });
      studentLoginCreated = result.created;
      if (result.created) invitesSent += 1;
    }
  }

  if (plan.guardian) {
    let userId: string | null = null;
    if (plan.guardian.loginEmail) {
      const result = await findOrCreatePortalUser({
        schoolId: params.schoolId,
        email: plan.guardian.loginEmail,
        firstName: plan.guardian.firstName,
        lastName: plan.guardian.lastName,
        phone: plan.guardian.phone,
        role: UserRole.PARENT,
        actorId: params.actorId,
      });
      if (!("skipped" in result)) {
        userId = result.userId;
        if (result.created) invitesSent += 1;
      }
    }

    let guardian = plan.guardian.email
      ? await prisma.guardian.findFirst({
          where: { schoolId: params.schoolId, email: plan.guardian.email },
        })
      : null;

    if (!guardian) {
      guardian = await prisma.guardian.create({
        data: {
          schoolId: params.schoolId,
          userId,
          firstName: plan.guardian.firstName,
          lastName: plan.guardian.lastName,
          email: plan.guardian.email,
          phone: plan.guardian.phone,
          relationship: plan.guardian.relationship,
        },
      });
    } else if (!guardian.userId && userId) {
      guardian = await prisma.guardian.update({
        where: { id: guardian.id },
        data: { userId },
      });
    }

    const existingLink = await prisma.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId: params.studentId, guardianId: guardian.id } },
    });
    if (!existingLink) {
      const hasPrimary = await prisma.studentGuardian.findFirst({
        where: { studentId: params.studentId, isPrimary: true },
        select: { id: true },
      });
      await prisma.studentGuardian.create({
        data: {
          studentId: params.studentId,
          guardianId: guardian.id,
          relationship: plan.guardian.relationship,
          isPrimary: !hasPrimary,
        },
      });
    }
    guardianLinked = true;
  }

  return { studentLoginCreated, guardianLinked, invitesSent };
}

export async function provisionStaffAccount(params: {
  schoolId: string;
  actorId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone?: string | null;
  role: StaffPortalRole;
  employeeId?: string | null;
  teacherId?: string | null;
  resend?: boolean;
  source?: string;
}): Promise<{ created: boolean; linked: boolean; invitesSent: number; skipped: boolean }> {
  const email = normalizePortalEmail(params.email);
  if (!email) {
    return { created: false, linked: false, invitesSent: 0, skipped: true };
  }

  const employee = params.employeeId
    ? await prisma.employee.findFirst({
        where: { id: params.employeeId, schoolId: params.schoolId },
        select: { id: true, userId: true },
      })
    : params.teacherId
      ? await prisma.employee.findUnique({
          where: { teacherId: params.teacherId },
          select: { id: true, userId: true },
        })
      : null;

  const teacher = params.teacherId
    ? await prisma.teacher.findFirst({
        where: { id: params.teacherId, schoolId: params.schoolId },
        select: { id: true, userId: true },
      })
    : null;

  const existingUserId = employee?.userId ?? teacher?.userId ?? null;
  if (existingUserId) {
    if (params.resend) {
      const user = await prisma.user.findFirst({
        where: { id: existingUserId, schoolId: params.schoolId, isActive: true },
        select: { id: true, email: true, firstName: true, role: true },
      });
      if (user) {
        await issuePasswordSetup({
          userId: user.id,
          schoolId: params.schoolId,
          email: user.email,
          firstName: user.firstName,
          kind: "reset",
        });
        return { created: false, linked: true, invitesSent: 1, skipped: false };
      }
    }
    return { created: false, linked: true, invitesSent: 0, skipped: false };
  }

  const result = await findOrCreatePortalUser({
    schoolId: params.schoolId,
    email,
    firstName: params.firstName,
    lastName: params.lastName,
    phone: params.phone,
    role: params.role,
    actorId: params.actorId,
    source: params.source ?? "employee",
  });
  if ("skipped" in result) {
    return { created: false, linked: false, invitesSent: 0, skipped: true };
  }

  if (employee && !employee.userId) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: { userId: result.userId },
    });
  }
  if (teacher && !teacher.userId) {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { userId: result.userId },
    });
  }

  return {
    created: result.created,
    linked: true,
    invitesSent: result.created ? 1 : 0,
    skipped: false,
  };
}

export async function setLinkedUserActive(params: {
  userId: string | null | undefined;
  schoolId: string;
  actorId: string;
  isActive: boolean;
}): Promise<{ updated: boolean }> {
  if (!params.userId) return { updated: false };
  const user = await prisma.user.findFirst({
    where: { id: params.userId, schoolId: params.schoolId },
    select: { id: true, isActive: true, role: true },
  });
  if (!user || user.role === UserRole.SUPER_ADMIN || user.isActive === params.isActive) {
    return { updated: false };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { isActive: params.isActive },
  });
  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: params.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entity: "User",
    entityId: user.id,
    metadata: { source: "lifecycle" },
  });
  return { updated: true };
}

export async function provisionExistingStudent(params: {
  studentId: string;
  schoolId: string;
  actorId: string;
}): Promise<{ studentLoginCreated: boolean; guardianLinked: boolean; invitesSent: number }> {
  const student = await prisma.student.findFirst({
    where: { id: params.studentId, schoolId: params.schoolId },
    include: {
      guardians: { include: { guardian: true }, orderBy: { isPrimary: "desc" } },
    },
  });
  if (!student) return { studentLoginCreated: false, guardianLinked: false, invitesSent: 0 };

  const first = student.guardians[0]?.guardian;
  const result = await provisionPortalAccounts({
    studentId: student.id,
    schoolId: params.schoolId,
    actorId: params.actorId,
    application: {
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      guardianFirstName: first?.firstName ?? null,
      guardianLastName: first?.lastName ?? null,
      guardianEmail: first?.email ?? null,
      guardianPhone: first?.phone ?? null,
      guardianRelationship: student.guardians[0]?.relationship ?? first?.relationship ?? null,
    },
  });

  let invitesSent = result.invitesSent;
  let guardianLinked = result.guardianLinked;
  for (const link of student.guardians.slice(1)) {
    const extra = await provisionPortalAccounts({
      studentId: student.id,
      schoolId: params.schoolId,
      actorId: params.actorId,
      application: {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        guardianFirstName: link.guardian.firstName,
        guardianLastName: link.guardian.lastName,
        guardianEmail: link.guardian.email,
        guardianPhone: link.guardian.phone,
        guardianRelationship: link.relationship,
      },
    });
    invitesSent += extra.invitesSent;
    if (extra.guardianLinked) guardianLinked = true;
  }

  return {
    studentLoginCreated: result.studentLoginCreated,
    guardianLinked,
    invitesSent,
  };
}
