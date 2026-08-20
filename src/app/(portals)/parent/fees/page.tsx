import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { InvoiceList } from "@/components/finance/invoice-list";
import { InstalmentSchedule } from "@/components/finance/instalment-schedule";
import { FeeStatementButton } from "@/components/finance/fee-statement-button";
import { ChildFilter } from "@/components/finance/child-filter";
import { StatCard } from "@/components/dashboard/stat-card";
import { getOutstandingBalance } from "@/lib/finance";
import { formatZAR } from "@/lib/utils";
import { getTerminology } from "@/lib/terminology";
import { PayOnlineButton } from "@/components/finance/pay-online-button";
import { InstalmentStatus } from "@prisma/client";
import { CreditCard, TrendingDown } from "lucide-react";
import { getDocumentReleases, summarizeDocumentReleases } from "@/lib/fee-clearance";
import { DocumentsHoldNotice } from "@/components/documents/documents-hold-notice";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function ParentFeesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const terms = getTerminology(guardian?.school.institutionType);
  const { studentId } = await searchParams;

  const children = guardian?.students.map((sg) => sg.student) ?? [];
  const childIds = children.map((c) => c.id);
  const filterIds = studentId && childIds.includes(studentId) ? [studentId] : childIds;
  const releaseMap = await getDocumentReleases(filterIds);
  const { blocked, releasedIds } = summarizeDocumentReleases(filterIds, releaseMap);
  const showReleasedNote =
    filterIds.length > 0 &&
    !blocked &&
    releasedIds.length === filterIds.length &&
    filterIds.some((id) => releaseMap.get(id)?.requireFees);

  const invoices = filterIds.length
    ? await prisma.invoice.findMany({
        where: { studentId: { in: filterIds }, status: { not: "DRAFT" } },
        include: {
          student: { select: { firstName: true, lastName: true, studentNumber: true } },
        },
        orderBy: { issuedAt: "desc" },
      })
    : [];
  const instalments = filterIds.length
    ? await prisma.chargeInstalment.findMany({
        where: {
          charge: { studentId: { in: filterIds }, reversedAt: null },
          status: { in: [InstalmentStatus.PENDING, InstalmentStatus.PARTIAL] },
        },
        include: { charge: { select: { description: true } } },
        orderBy: { dueDate: "asc" },
        take: 12,
      })
    : [];

  const totalOutstanding = invoices.reduce(
    (s, i) => s + getOutstandingBalance(Number(i.total), Number(i.amountPaid)),
    0
  );
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
  const payInvoice = invoices.find((i) => getOutstandingBalance(Number(i.total), Number(i.amountPaid)) > 0);

  const mapped = invoices.map((i) => ({
    ...i,
    total: Number(i.total),
    amountPaid: Number(i.amountPaid),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{terms.fees}</h1>
          <p className="text-muted text-sm mt-1">View statements and pay outstanding invoices online</p>
        </div>
        {filterIds.length === 1 ? <FeeStatementButton studentId={filterIds[0]} /> : null}
      </div>

      <ChildFilter
        students={children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }))}
        selectedId={studentId}
        basePath="/parent/fees"
      />

      {blocked ? (
        <DocumentsHoldNotice outstandingCents={blocked.outstandingCents} feesHref="/parent/fees" />
      ) : null}
      {showReleasedNote ? (
        <p className="text-sm text-muted">
          Selected accounts are paid in full, so reports, certificates and letters are available.{" "}
          <Link href="/parent/report-cards" className="text-primary hover:underline">
            View reports
          </Link>
          {" · "}
          <Link href="/parent/letters" className="text-primary hover:underline">
            View letters
          </Link>
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Outstanding" value={formatZAR(totalOutstanding)} icon={TrendingDown} />
        <StatCard title="Paid to Date" value={formatZAR(totalPaid)} icon={CreditCard} />
      </div>
      {payInvoice ? (
        <PayOnlineButton
          invoiceId={payInvoice.id}
          outstanding={getOutstandingBalance(Number(payInvoice.total), Number(payInvoice.amountPaid))}
        />
      ) : null}

      <InstalmentSchedule
        title="Upcoming instalments"
        instalments={instalments.map((row) => ({
          id: row.id,
          sequence: row.sequence,
          dueDate: row.dueDate,
          amount: Number(row.amount),
          amountPaid: Number(row.amountPaid),
          status: row.status,
          description: row.charge.description,
        }))}
      />

      <InvoiceList
        invoices={mapped}
        detailHref={(id) => `/parent/fees/${id}`}
      />
    </div>
  );
}
