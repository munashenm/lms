import Link from "next/link";
import { getFeaturedSchool } from "@/lib/public-site";
import { getPublicPaymentOptions } from "@/lib/school-integrations";
import { getPublicFeeSchedule } from "@/lib/fee-schedule";
import { publicPageMetadata } from "@/lib/site-metadata";
import { formatZAR } from "@/lib/utils";
import { getTerminology } from "@/lib/terminology";
import { admissionYearLabel } from "@/lib/admissions";
import { CtaBand, EmptyNote, PageHero, SiteSection } from "@/components/public/site-ui";

export const metadata = publicPageMetadata("Fees", "Fee schedule, payment options and bursary information.");
export const dynamic = "force-dynamic";

export default async function FeesPage() {
  const school = await getFeaturedSchool();
  const terms = getTerminology(school?.institutionType);
  const yearLabel = admissionYearLabel(school?.admissionYear);
  const [paymentOptions, feeItems] = await Promise.all([
    school?.id
      ? getPublicPaymentOptions(school.id)
      : Promise.resolve(["EFT / bank transfer", "Cash at finance office"]),
    school?.id ? getPublicFeeSchedule(school.id) : Promise.resolve([]),
  ]);

  const rows = feeItems.map((item) => ({
    name: item.name,
    amount: Number(item.amount),
    notes: item.notes,
  }));

  return (
    <>
      <PageHero
        eyebrow="Fees"
        title="Clear, published fee information."
        description={`Fee information for ${school?.name ?? "this institution"}. Amounts are in South African Rand (ZAR).`}
        imageUrl={school?.heroImageUrl}
      />

      <SiteSection>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-9">
          <h2 className="section-title">{yearLabel} fee schedule</h2>
          <p className="text-[var(--site-muted)] max-w-[26em] md:text-right">
            Annual and itemised fees as published by the finance office.
          </p>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="site-fees">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Amount</th>
                  <th className="hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td className="font-semibold text-primary">{row.name}</td>
                    <td>{formatZAR(row.amount)}</td>
                    <td className="hidden sm:table-cell text-[var(--site-muted)]">{row.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyNote>A public fee schedule has not been published yet. Please contact the finance office.</EmptyNote>
        )}
      </SiteSection>

      <SiteSection alt>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
            <h3 className="mb-3">Payment options</h3>
            <ul className="space-y-2 text-[var(--site-muted)]">
              {paymentOptions.map((option) => (
                <li key={option} className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-[var(--accent-dark)] before:font-bold">
                  {option}
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--site-muted)] mt-4">
              Enrolled {terms.students.toLowerCase()} can pay invoices from the {terms.portal.toLowerCase()} when
              gateways are enabled.
            </p>
          </div>
          <div className="bg-white border border-[var(--site-line)] rounded-[14px] p-7">
            <h3 className="mb-3">Bursaries & discounts</h3>
            <p className="text-[var(--site-muted)]">
              Contact the finance office after acceptance for bursary or discount enquiries.
            </p>
            <Link href="/contact" className="site-read inline-block mt-5">
              Enquire about funding →
            </Link>
          </div>
        </div>
      </SiteSection>

      <CtaBand
        title="Ready to apply?"
        description="Start an online application or speak to the admissions office."
        primaryHref="/apply"
        primaryLabel="Apply online"
        secondaryHref="/admissions"
        secondaryLabel="Admissions"
      />
    </>
  );
}
