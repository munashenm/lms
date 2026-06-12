import Link from "next/link";
import { getFeaturedSchool } from "@/lib/public-site";
import { getPublicPaymentOptions } from "@/lib/school-integrations";
import { publicPageMetadata } from "@/lib/site-metadata";

export const metadata = publicPageMetadata("Fees & Funding", "Fee schedule, payment options and bursary information.");
import { formatZAR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const FEE_ITEMS = [
  { item: "Registration Fee", amount: 1500, note: "Once-off, non-refundable" },
  { item: "Tuition — NQF Level 4 (per term)", amount: 12500, note: "Payable per term" },
  { item: "Materials & Lab Fee", amount: 2500, note: "Per year" },
  { item: "Examination Fee", amount: 1800, note: "Per exam sitting" },
];

export default async function FeesPage() {
  const school = await getFeaturedSchool();
  const paymentOptions = school?.id
    ? await getPublicPaymentOptions(school.id)
    : [
        "EFT / bank transfer",
        "Cash at finance office",
        "Payment plans available on request",
      ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Fees & Funding</h1>
        <p className="text-muted mt-3 max-w-2xl">
          Transparent fee structure for {school?.name ?? "our institution"}. All amounts in South African Rand (ZAR).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2026 Fee Schedule (indicative)</CardTitle>
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
              {FEE_ITEMS.map((row) => (
                <tr key={row.item} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{row.item}</td>
                  <td className="px-4 py-3 text-right">{formatZAR(row.amount)}</td>
                  <td className="px-4 py-3 text-muted hidden sm:table-cell">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
              Enrolled students can pay invoices online from the student portal when gateways are enabled.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">Bursaries & discounts</h2>
            <p className="text-sm text-muted">
              Merit bursaries and sibling discounts may be available. Contact the finance
              office after acceptance for scholarship applications.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/contact">Enquire about funding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Button asChild>
          <Link href="/apply">Apply Now</Link>
        </Button>
      </div>
    </div>
  );
}
