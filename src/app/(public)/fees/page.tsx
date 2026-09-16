import Link from "next/link";
import { getFeaturedSchool } from "@/lib/public-site";
import { getPublicPaymentOptions } from "@/lib/school-integrations";
import { getPublicFeeSchedule } from "@/lib/fee-schedule";
import { publicPageMetadata } from "@/lib/site-metadata";
import { formatZAR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTerminology } from "@/lib/terminology";
import { admissionYearLabel } from "@/lib/admissions";

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
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Fees</h1>
        <p className="text-muted mt-3 max-w-2xl">
          Fee information for {school?.name ?? "this institution"}. Amounts are in South African Rand (ZAR).
        </p>
      </div>

      {rows.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{yearLabel} fee schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium text-muted">Item</th>
                  <th className="text-right px-4 py-3 font-medium text-muted">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-right">{formatZAR(row.amount)}</td>
                    <td className="px-4 py-3 text-muted hidden sm:table-cell">{row.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">
            A public fee schedule has not been published yet. Please contact the finance office.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Payment options</h2>
            <ul className="text-sm text-muted space-y-2 list-disc list-inside">
              {paymentOptions.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
            <p className="text-xs text-muted pt-1">
              Enrolled {terms.students.toLowerCase()} can pay invoices from the {terms.portal.toLowerCase()} when
              gateways are enabled.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Bursaries & discounts</h2>
            <p className="text-sm text-muted">
              Contact the finance office after acceptance for bursary or discount enquiries.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/contact">Enquire about funding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Button asChild>
          <Link href="/apply">Apply Online</Link>
        </Button>
      </div>
    </div>
  );
}
