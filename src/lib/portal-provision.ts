import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import { hashPassword } from "./auth";
import { logAudit } from "./audit";
import { issuePasswordSetup } from "./password-reset";

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

export async function findOrCreatePortalUser(params: {
  schoolId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: typeof UserRole.STUDENT | typeof UserRole.PARENT;
  actorId: string;
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
    kind: params.role === UserRole.PARENT ? "welcome_parent" : "welcome_student",
  });
  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    metadata: { role: params.role, source: "application" },
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
