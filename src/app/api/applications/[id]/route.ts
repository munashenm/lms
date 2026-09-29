import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { applicationStatusSchema } from "@/lib/validators";
import { sendApplicationStatusUpdate } from "@/lib/application-notify";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { licenseDeniedResponse, licenseWriteGuard, requireLicenseWrite } from "@/lib/licensing/enforce";
import {
  enrolFromAcceptedApplication,
  findStudentForApplication,
  shouldCreateStudentOnAccept,
} from "@/lib/application-enrolment";
import { provisionPortalAccounts } from "@/lib/portal-provision";
import { scopedId } from "@/lib/tenant";
import {
  depositBlocksEnrolment,
  ensureDepositInvoice,
  recordApplicationDepositPayment,
  waiveApplicationDeposit,
} from "@/lib/admissions-deposit";
import { logAudit } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!requirePermission(session, "students:write")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = applicationStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.application.findFirst({
    where: scopedId(session!, id),
    include: { school: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const denied = await requireLicenseWrite(existing.schoolId, { feature: "admissions" });
  if (denied) return denied;

  let working = existing;
  let depositInvoiceCreated = false;

  // Issue offer (+ optional deposit invoice via finance ledger).
  if (parsed.data.status === "OFFER_ISSUED" || parsed.data.status === "DEPOSIT_PENDING") {
    const result = await ensureDepositInvoice({
      applicationId: existing.id,
      actorId: session.userId,
      depositAmount: parsed.data.depositAmount,
      offerExpiresAt: parsed.data.offerExpiresAt
        ? new Date(parsed.data.offerExpiresAt)
        : undefined,
    });
    working = { ...existing, ...result.application };
    depositInvoiceCreated = result.created;
  }

  // Record deposit payment through the shared finance payment path (idempotent).
  if (parsed.data.markDepositPaid) {
    try {
      const paid = await recordApplicationDepositPayment({
        applicationId: working.id,
        actorId: session.userId,
      });
      working = { ...working, ...paid.application };
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Could not record deposit payment" },
        { status: 400 }
      );
    }
  }

  // Authorised deposit waiver (permission + reason + audit).
  if (parsed.data.waiveDeposit) {
    const canWaive =
      requirePermission(session, "admissions.deposit_waive") ||
      requirePermission(session, "finance.payments.approve") ||
      requirePermission(session, "settings:write");
    if (!canWaive) {
      return NextResponse.json({ message: "Deposit waiver not permitted" }, { status: 403 });
    }
    const reason = (parsed.data.waiverReason ?? parsed.data.notes ?? "").trim();
    if (!reason) {
      return NextResponse.json({ message: "Waiver reason is required" }, { status: 400 });
    }
    try {
      const waived = await waiveApplicationDeposit({
        applicationId: working.id,
        actorId: session.userId,
        reason,
      });
      working = { ...working, ...waived };
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Could not waive deposit" },
        { status: 400 }
      );
    }
  }

  const nextStatus = parsed.data.status;
  const enrolling =
    nextStatus === "ACCEPTED" || nextStatus === "ENROLLED" || nextStatus === "DEPOSIT_PAID"
      ? nextStatus === "ACCEPTED" || nextStatus === "ENROLLED"
      : false;

  if ((nextStatus === "ACCEPTED" || nextStatus === "ENROLLED") && depositBlocksEnrolment(working)) {
    return NextResponse.json(
      {
        message:
          "A required admissions deposit is unpaid. Record payment or an authorised waiver before enrolment.",
      },
      { status: 400 }
    );
  }

  let enrolled: { studentId: string; studentNumber: string; created: boolean } | null = null;
  if (enrolling && shouldCreateStudentOnAccept({ nextStatus, studentId: working.studentId })) {
    const linkedStudentId = await findStudentForApplication(working);
    if (!linkedStudentId) {
      const guard = await licenseWriteGuard({
        schoolId: working.schoolId,
        action: "create_learner",
      });
      if (!guard.ok) return licenseDeniedResponse(guard);
    }
    try {
      enrolled = await enrolFromAcceptedApplication({
        application: working,
        existingStudentId: linkedStudentId,
        actorId: session.userId,
        hostel: parsed.data.hostel,
        transport: parsed.data.transport,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Could not enrol applicant" },
        { status: 400 }
      );
    }
  } else if (enrolling && working.studentId) {
    // Student already linked (e.g. via deposit invoice) — ensure enrolment idempotently.
    try {
      enrolled = await enrolFromAcceptedApplication({
        application: working,
        existingStudentId: working.studentId,
        actorId: session.userId,
        hostel: parsed.data.hostel,
        transport: parsed.data.transport,
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Could not enrol applicant" },
        { status: 400 }
      );
    }
  }

  const studentId = enrolled?.studentId ?? working.studentId;

  const acceptOfferFields =
    nextStatus === "ACCEPTED" &&
    (working.status === "OFFER_ISSUED" ||
      working.status === "DEPOSIT_PENDING" ||
      working.status === "DEPOSIT_PAID")
      ? { offerAcceptedAt: working.offerAcceptedAt ?? new Date() }
      : {};

  // When offer+deposit was already handled above, keep the deposit workflow status unless
  // the client is moving to a later stage.
  const statusToPersist =
    (parsed.data.status === "OFFER_ISSUED" || parsed.data.status === "DEPOSIT_PENDING") &&
    (working.status === "DEPOSIT_PENDING" || working.status === "DEPOSIT_PAID" || working.status === "OFFER_ISSUED")
      ? working.status
      : nextStatus;

  const application = await prisma.application.update({
    where: { id },
    data: {
      status: statusToPersist,
      notes: parsed.data.notes ?? undefined,
      reviewedAt: new Date(),
      studentId: enrolled?.studentId ?? undefined,
      ...acceptOfferFields,
    },
  });

  if (enrolled?.created) {
    await logAudit({
      schoolId: working.schoolId,
      userId: session.userId,
      action: "CREATE",
      entity: "Student",
      entityId: enrolled.studentId,
      metadata: { source: "application_enrolment", applicationId: id },
    });
  }

  let provision: { studentLoginCreated: boolean; guardianLinked: boolean; invitesSent: number } | null = null;
  if ((statusToPersist === "ACCEPTED" || statusToPersist === "ENROLLED") && studentId) {
    try {
      provision = await provisionPortalAccounts({
        studentId,
        schoolId: working.schoolId,
        actorId: session.userId,
        application: working,
      });
    } catch {
      provision = { studentLoginCreated: false, guardianLinked: false, invitesSent: 0 };
    }
  }

  if (existing.status !== statusToPersist) {
    await sendApplicationStatusUpdate({
      schoolId: working.schoolId,
      email: working.email,
      phone: working.phone,
      firstName: working.firstName,
      referenceNo: working.referenceNo,
      status: APPLICATION_STATUS_LABELS[statusToPersist] ?? statusToPersist,
      schoolName: existing.school.name,
    });
  }

  return NextResponse.json({
    application,
    depositInvoiceCreated,
    student: enrolled
      ? { id: enrolled.studentId, studentNumber: enrolled.studentNumber, created: enrolled.created }
      : null,
    provision,
  });
}
