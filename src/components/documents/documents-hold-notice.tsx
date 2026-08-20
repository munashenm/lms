import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/utils";
import { fromCents } from "@/lib/money";

export function DocumentsHoldNotice({
  outstandingCents,
  feesHref,
}: {
  outstandingCents: number;
  feesHref: string;
}) {
  return (
    <Card>
      <CardContent className="py-10 space-y-3 text-center">
        <p className="font-medium">Documents are on hold until fees are paid</p>
        <p className="text-sm text-muted">
          Outstanding school fees: {formatZAR(fromCents(outstandingCents))}. Report cards,
          certificates, transfer letters and transcripts are released when the account is paid
          in full.
        </p>
        <Button asChild>
          <Link href={feesHref}>Pay school fees</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
