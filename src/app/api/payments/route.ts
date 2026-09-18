import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireStaffPermission, getSchoolFilter } from "@/lib/rbac";
import { paymentSchema } from "@/lib/validators";
import { requireLicenseWrite } from "@/lib/licensing/enforce";
import { consumeIdempotency } from "@/lib/rate-limit";
import { assertPaidAtAcceptable, parseCollectionPaidAt } from "@/lib/fee-collection";
import { scopedId } from "@/lib/tenant";
import { saveFinanceSlip } from "@/lib/finance-uploads";
import { assertUniqueBankReference, createManualPayment } from "@/lib/manual-payment";

export async function GET() {
  const session = await getSession();
  if (!requireStaffPermission(session, "finance:read") && !requireStaffPermission(session, "finance.view")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const payments = await prisma.payment.findMany({
    where: { invoice: getSchoolFilter(session!) },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          student: { select: { firstName: true, lastName: true, studentNumber: true } },
        },
      },
    },
    orderBy: { paidAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ payments });
}

async function parsePaymentBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const allocationsRaw = form.get("allocations");
    let allocations: Array<{ instalmentId: string; amount: number }> | undefined;
    if (typeof allocationsRaw === "string" && allocationsRaw) {
      try {
        allocations = JSON.parse(allocationsRaw);
      } catch {
        allocations = undefined;
      }
    }
    const proof = form.get("proof");
    return {
      data: {
        invoiceId: String(form.get("invoiceId") ?? ""),
        amount: Number(form.get("amount")),
        method: String(form.get("method") ?? ""),
        reference: String(form.get("reference") ?? "") || undefined,
        bankReference: String(form.get("bankReference") ?? "") || undefined,
        notes: String(form.get("notes") ?? "") || undefined,
        feeType: String(form.get("feeType") ?? "") || undefined,
        academicYearId: String(form.get("academicYearId") ?? "") || undefined,
        paidAt: String(form.get("paidAt") ?? "") || undefined,
        allocations,
      },
      proof: proof instanceof File && proof.size > 0 ? proof : null,
    };
  }
  const json = await request.json();
  return { data: json, proof: null as File | null };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (
    !requireStaffPermission(session, "finance.payments.create") &&
    !requireStaffPermission(session, "finance.record_payment") &&
    !requireStaffPermission(session, "finance:write")
  ) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const parsedBody = await parsePaymentBody(request);
  const parsed = paymentSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid data" }, { status: 400 });
  }

  const {
    invoiceId,
    amount,
    method,
    reference,
    bankReference,
    notes,
    feeType,
    academicYearId,
    allocations,
    paidAt: paidAtRaw,
  } = parsed.data;

  let paidAt: Date | undefined;
  if (paidAtRaw) {
    const parsedPaidAt = parseCollectionPaidAt(paidAtRaw);
    if (!parsedPaidAt) {
      return NextResponse.json({ message: "Invalid collection date and time" }, { status: 400 });
    }
    const paidAtError = assertPaidAtAcceptable(parsedPaidAt);
    if (paidAtError) {
      return NextResponse.json({ message: paidAtError }, { status: 400 });
    }
    paidAt = parsedPaidAt;
  }

  const invoice = await prisma.invoice.findFirst({
    where: scopedId(session!, invoiceId),
    include: { student: { select: { userId: true, firstName: true, lastName: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
    return NextResponse.json({ message: "This invoice cannot accept collections" }, { status: 400 });
  }

  const denied = await requireLicenseWrite(invoice.schoolId, { feature: "finance" });
  if (denied) return denied;

  const bankRef = (bankReference || reference || "").trim();
  if (bankRef) {
    const duplicate = await assertUniqueBankReference({
      schoolId: invoice.schoolId,
      bankReference: bankRef,
    });
    if (duplicate) {
      return NextResponse.json({ message: "A payment with this bank/payment reference already exists" }, { status: 409 });
    }
  }

  const idempotencyKey = `payment:${invoice.id}:${session!.userId}:${amount}:${bankRef}:${paidAt?.toISOString() ?? ""}`;
  if (!consumeIdempotency(idempotencyKey, 15_000)) {
    return NextResponse.json({ message: "Payment is already being recorded" }, { status: 409 });
  }

  let proofUrl: string | null = null;
  if (parsedBody.proof) {
    try {
      proofUrl = await saveFinanceSlip(invoice.schoolId, "payments", parsedBody.proof);
    } catch (err) {
      return NextResponse.json(
        { message: err instanceof Error ? err.message : "Could not save proof of payment" },
        { status: 400 }
      );
    }
  }

  const payment = await createManualPayment({
    schoolId: invoice.schoolId,
    invoiceId,
    amount,
    method,
    reference: reference || null,
    bankReference: bankRef || null,
    notes: notes || null,
    feeType: feeType || null,
    academicYearId: academicYearId || null,
    proofUrl,
    paidAt,
    recordedById: session!.userId,
    allocations,
  });

  const refreshed = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { amountPaid: true, status: true },
  });

  return NextResponse.json(
    {
      payment,
      amountPaid: refreshed ? Number(refreshed.amountPaid) : Number(invoice.amountPaid),
      status: refreshed?.status ?? invoice.status,
    },
    { status: 201 }
  );
}
