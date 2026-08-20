import { Badge } from "@/components/ui/badge";

export function DocumentsFeeHoldBadge({ released }: { released: boolean }) {
  if (released) return null;
  return <Badge variant="warning">Fees outstanding</Badge>;
}
