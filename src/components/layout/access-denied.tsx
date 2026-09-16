import { FORBIDDEN_MESSAGE } from "@/lib/http";

export function AccessDenied() {
  return (
    <div className="max-w-lg space-y-2">
      <h1 className="text-2xl font-bold">403</h1>
      <p className="text-muted">{FORBIDDEN_MESSAGE}</p>
    </div>
  );
}
