import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DocumentsReleasedNotice({
  reportsHref,
  lettersHref,
}: {
  reportsHref: string;
  lettersHref: string;
}) {
  return (
    <Card>
      <CardContent className="py-8 space-y-3 text-center">
        <p className="font-medium">School fees are paid in full</p>
        <p className="text-sm text-muted">
          Report cards, certificates, transfer letters and transcripts are available to download.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={reportsHref}>View reports</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={lettersHref}>View letters</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
