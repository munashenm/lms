import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/utils";
import { fromCents } from "@/lib/money";

export function DocumentsHoldNotice({
  outstandingCents,
  feesHref,
  compact = false,
}: {
  outstandingCents: number;
  feesHref: string;
  compact?: boolean;
}) {
  const amount = formatZAR(fromCents(outstandingCents));
  if (compact) {
    return (
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm">
            <span className="font-medium">Official PDFs are on hold.</span>{" "}
            <span className="text-muted">Outstanding school fees: {amount}.</span>
          </p>
          <Button size="sm" asChild>
            <Link href={feesHref}>Pay school fees</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="py-10 space-y-3 text-center">
        <p className="font-medium">Documents are on hold until fees are paid</p>
        <p className="text-sm text-muted">
          Outstanding school fees: {amount}. Report cards, certificates, transfer letters and
          transcripts are released when the account is paid in full.
        </p>
        <Button asChild>
          <Link href={feesHref}>Pay school fees</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
