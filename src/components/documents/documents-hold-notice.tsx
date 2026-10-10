import Link from "next/link";
import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  return (
    <Card>
      <CardContent className={compact ? "space-y-2 py-4" : "py-10 space-y-3 text-center"}>
        <p className="font-medium">Documents are on hold until fees are paid</p>
        <p className="text-sm text-muted">
          Outstanding school fees: {formatZAR(fromCents(outstandingCents))}. Issued reports,
          certificates and letters stay listed. The PDF download opens when the account is clear.
        </p>
        <Button asChild size={compact ? "sm" : "default"}>
          <Link href={feesHref}>Pay school fees</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function HeldDocumentAction({ released, href }: { released: boolean; href: string }) {
  if (!released) return <Badge variant="warning">Fees outstanding</Badge>;
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href}>
        <Download className="h-4 w-4" />
        Download PDF
      </a>
    </Button>
  );
}
