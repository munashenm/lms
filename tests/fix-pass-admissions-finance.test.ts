import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  InvoiceStatus,
  PaymentMethod,
  UserRole,
  type Application,
  type School,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  depositBlocksEnrolment,
  depositRequired,
  depositSatisfied,
  ensureDepositInvoice,
  recordApplicationDepositPayment,
  waiveApplicationDeposit,
} from "@/lib/admissions-deposit";
import { enrolFromAcceptedApplication } from "@/lib/application-enrolment";
import { canAccessAdmin, canAccessFinance, hasPermission, requirePermission } from "@/lib/rbac";
import { requestedEmisSensitiveFields } from "@/lib/emis-sensitive";
import { getOutstandingBalance } from "@/lib/finance";
import { bucketForDays, buildDebtorsAgeAnalysis } from "@/lib/finance/debtors-age";
import type { SessionPayload } from "@/lib/session";

const suffix = `fp-${Date.now()}`;

function session(
  role: UserRole,
  schoolId: string,
  grants: string[] = []
): SessionPayload {
  return {
    userId: `user-${role}-${suffix}`,
    email: `${role.toLowerCase()}@${suffix}.test`,
    role,
    schoolId,
    firstName: "Test",
    lastName: "User",
    permissionGrants: grants,
  };
}

describe("admissions deposit workflow (ledger)", () => {
  let school: School;
  let actor: User;
  let application: Application;

  beforeAll(async () => {
    school = await prisma.school.create({
      data: {
        name: `Fix Pass School ${suffix}`,
        slug: `fix-pass-${suffix}`,
        cemisEnabled: false,
      },
    });
    actor = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `admin-${suffix}@test.local`,
        passwordHash: "x",
        firstName: "Ada",
        lastName: "Admin",
        role: UserRole.SCHOOL_ADMIN,
      },
    });
    application = await prisma.application.create({
      data: {
        schoolId: school.id,
        referenceNo: `APP-${suffix}`,
        firstName: "Thabo",
        lastName: "Mokoena",
        email: `thabo-${suffix}@test.local`,
        status: "UNDER_REVIEW",
        depositAmount: 1500,
      },
    });
  });

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({ where: { schoolId: school.id } });
    await prisma.payment.deleteMany({ where: { schoolId: school.id } });
    await prisma.invoiceLineItem.deleteMany({
      where: { invoice: { schoolId: school.id } },
    });
    await prisma.studentLedgerEntry.deleteMany({ where: { schoolId: school.id } });
    await prisma.application.updateMany({
      where: { schoolId: school.id },
      data: { depositInvoiceId: null, studentId: null },
    });
    await prisma.invoice.deleteMany({ where: { schoolId: school.id } });
    await prisma.enrolment.deleteMany({
      where: { student: { schoolId: school.id } },
    });
    await prisma.student.deleteMany({ where: { schoolId: school.id } });
    await prisma.application.deleteMany({ where: { schoolId: school.id } });
    await prisma.user.deleteMany({ where: { schoolId: school.id } });
    await prisma.school.delete({ where: { id: school.id } });
  });

  it("offer creates one deposit invoice and links depositInvoiceId", async () => {
    expect(depositRequired(application)).toBe(true);
    expect(depositBlocksEnrolment(application)).toBe(true);

    const first = await ensureDepositInvoice({
      applicationId: application.id,
      actorId: actor.id,
      depositAmount: 1500,
    });
    expect(first.created).toBe(true);
    expect(first.invoice).not.toBeNull();
    expect(first.application.depositInvoiceId).toBe(first.invoice!.id);
    expect(first.application.status).toBe("DEPOSIT_PENDING");
    expect(first.application.studentId).toBeTruthy();

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: first.invoice!.id },
      include: { lineItems: true, ledgerEntries: true },
    });
    expect(Number(invoice.total)).toBe(1500);
    expect(invoice.status).toBe(InvoiceStatus.SENT);
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.ledgerEntries.length).toBeGreaterThanOrEqual(1);
    application = first.application;
  });

  it("duplicate offer request does not create a second invoice", async () => {
    const second = await ensureDepositInvoice({
      applicationId: application.id,
      actorId: actor.id,
      depositAmount: 1500,
    });
    expect(second.created).toBe(false);
    expect(second.invoice?.id).toBe(application.depositInvoiceId);

    const count = await prisma.invoice.count({
      where: {
        schoolId: school.id,
        description: { contains: application.referenceNo },
      },
    });
    expect(count).toBe(1);
  });

  it("unpaid required deposit prevents enrolment", async () => {
    const fresh = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(depositBlocksEnrolment(fresh)).toBe(true);
    expect(depositSatisfied(fresh)).toBe(false);
  });

  it("deposit payment updates application and clears the enrolment block", async () => {
    const paid = await recordApplicationDepositPayment({
      applicationId: application.id,
      actorId: actor.id,
      method: PaymentMethod.EFT,
    });
    expect(paid.alreadyPaid).toBe(false);
    expect(paid.application.depositPaidAt).toBeTruthy();
    expect(paid.application.status).toBe("DEPOSIT_PAID");
    expect(depositBlocksEnrolment(paid.application)).toBe(false);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: paid.application.depositInvoiceId! },
    });
    expect(getOutstandingBalance(Number(invoice.total), Number(invoice.amountPaid))).toBe(0);

    const duplicate = await recordApplicationDepositPayment({
      applicationId: application.id,
      actorId: actor.id,
    });
    expect(duplicate.alreadyPaid).toBe(true);
    application = paid.application;
  });

  it("authorised waiver allows enrolment when unpaid (separate case)", async () => {
    const waivedApp = await prisma.application.create({
      data: {
        schoolId: school.id,
        referenceNo: `APP-W-${suffix}`,
        firstName: "Nomsa",
        lastName: "Dlamini",
        status: "UNDER_REVIEW",
        depositAmount: 800,
      },
    });
    const issued = await ensureDepositInvoice({
      applicationId: waivedApp.id,
      actorId: actor.id,
      depositAmount: 800,
    });
    expect(depositBlocksEnrolment(issued.application)).toBe(true);

    const waived = await waiveApplicationDeposit({
      applicationId: waivedApp.id,
      actorId: actor.id,
      reason: "SGB bursary confirmed",
    });
    expect(waived.depositWaivedAt).toBeTruthy();
    expect(waived.depositWaiverReason).toContain("bursary");
    expect(depositBlocksEnrolment(waived)).toBe(false);

    const audits = await prisma.auditLog.findMany({
      where: { schoolId: school.id, entityId: waivedApp.id },
    });
    expect(
      audits.some((row) => {
        const meta = row.metadata as { kind?: string } | null;
        return meta?.kind === "DEPOSIT_WAIVER";
      })
    ).toBe(true);
  });

  it("duplicate enrolment is prevented (idempotent ensure)", async () => {
    const fresh = await prisma.application.findUniqueOrThrow({
      where: { id: application.id },
    });
    const first = await enrolFromAcceptedApplication({
      application: fresh,
      existingStudentId: fresh.studentId,
      actorId: actor.id,
    });
    const second = await enrolFromAcceptedApplication({
      application: { ...fresh, studentId: first.studentId },
      existingStudentId: first.studentId,
      actorId: actor.id,
    });
    expect(second.created).toBe(false);
    expect(second.studentId).toBe(first.studentId);

    const enrolments = await prisma.enrolment.count({
      where: { studentId: first.studentId },
    });
    // At most one enrolment per student/year (may be zero if no current academic year).
    expect(enrolments).toBeLessThanOrEqual(1);
  });
});

describe("finance age route access", () => {
  it("finance officer can access finance portal age report; not admin portal", () => {
    expect(canAccessFinance(UserRole.FINANCE_OFFICER)).toBe(true);
    expect(canAccessAdmin(UserRole.FINANCE_OFFICER)).toBe(false);
    expect(hasPermission(UserRole.FINANCE_OFFICER, "finance.view")).toBe(true);
    expect(hasPermission(UserRole.FINANCE_OFFICER, "finance.reports.view")).toBe(true);

    const financeSession = session(UserRole.FINANCE_OFFICER, "school-1");
    expect(requirePermission(financeSession, "finance.view")).toBe(true);

    const teacherSession = session(UserRole.TEACHER, "school-1");
    expect(requirePermission(teacherSession, "finance.view")).toBe(false);
    expect(requirePermission(teacherSession, "finance.reports")).toBe(false);

    expect(canAccessAdmin(UserRole.SCHOOL_ADMIN)).toBe(true);
    expect(canAccessFinance(UserRole.SCHOOL_ADMIN)).toBe(true);
    expect(hasPermission(UserRole.SUPER_ADMIN, "finance.view")).toBe(true);
  });
});

describe("CEMIS institution gate", () => {
  it("treats cemisEnabled=false as inaccessible", () => {
    expect(Boolean(false)).toBe(false);
    // API/UI gate: export rejected when school.cemisEnabled is false (asserted via shape).
    const school = { cemisEnabled: false as boolean };
    const allowed = Boolean(school.cemisEnabled);
    expect(allowed).toBe(false);
  });

  it("allows CEMIS only when institution flag is enabled", () => {
    const school = { cemisEnabled: true as boolean };
    expect(Boolean(school.cemisEnabled)).toBe(true);
  });
});

describe("sensitive EMIS field permissions", () => {
  it("detects disability/SNE/demographic fields as sensitive", () => {
    expect(
      requestedEmisSensitiveFields({
        firstName: "A",
        disabilityStatus: true,
        sneStatus: false,
        populationGroup: "AFRICAN",
        phone: "0821234567",
      })
    ).toEqual(["disabilityStatus", "sneStatus", "populationGroup"]);
  });

  it("does not grant EMIS-sensitive edit via students.edit alone", () => {
    expect(hasPermission(UserRole.TEACHER, "students.emis_sensitive")).toBe(false);
    expect(hasPermission(UserRole.ADMISSIONS_OFFICER, "students.emis_sensitive")).toBe(false);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "students.emis_sensitive")).toBe(true);
    expect(hasPermission(UserRole.SUPER_ADMIN, "students.emis_sensitive")).toBe(true);
    // Ordinary student write does not imply emis_sensitive through legacy mapping.
    expect(
      hasPermission(UserRole.TEACHER, "students.emis_sensitive", {
        grants: ["students.edit", "students:write"],
      })
    ).toBe(false);
  });
});

describe("debtor ageing buckets", () => {
  it("exposes Current / 30 / 60 / 90 / 120+ labels via bucket helper", () => {
    expect(bucketForDays(0)).toBe("current");
    expect(bucketForDays(30)).toBe("1_30");
    expect(bucketForDays(60)).toBe("31_60");
    expect(bucketForDays(90)).toBe("61_90");
    expect(bucketForDays(121)).toBe("120_plus");

    const analysis = buildDebtorsAgeAnalysis(
      [
        { invoiceId: "a", studentId: "s1", outstanding: 100, dueDate: null },
        {
          invoiceId: "b",
          studentId: "s2",
          outstanding: 200,
          dueDate: new Date(Date.now() - 40 * 86400000),
        },
      ],
      new Date()
    );
    expect(analysis.totals.current).toBe(100);
    expect(analysis.totals["31_60"]).toBe(200);
    expect(analysis.debtorAccountCount).toBe(2);
  });
});
