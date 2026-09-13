import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { DocumentsFeeHoldBadge } from "@/components/documents/documents-fee-hold-badge";

export function OfficialDocumentActions({
  released,
  href,
  feesHref,
  label = "PDF",
}: {
  released: boolean;
  href: string;
  feesHref: string;
  label?: string;
}) {
  if (released) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={href}>
          <Download className="h-4 w-4" />
          {label}
        </a>
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <DocumentsFeeHoldBadge released={false} />
      <Link href={feesHref} className="text-xs text-primary hover:underline">
        Pay fees to download
      </Link>
    </div>
  );
}
