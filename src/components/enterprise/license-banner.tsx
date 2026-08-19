"use client";

import Link from "next/link";
import { RESTRICTED_MODE_MESSAGE } from "@/lib/licensing/types";
import { licenseBannerTone } from "@/lib/licensing/portal";
import type { EvaluatedLicense } from "@/lib/licensing/types";

export function LicenseStatusBanner({
  evaluation,
  canManage = false,
}: {
  evaluation: EvaluatedLicense | null;
  canManage?: boolean;
}) {
  const tone = licenseBannerTone(evaluation);
  if (!tone || !evaluation) return null;

  const styles =
    tone === "restricted"
      ? "border-red-200 bg-red-50 text-red-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  const title =
    tone === "restricted"
      ? "Restricted mode"
      : tone === "grace"
        ? "Licence in grace period"
        : "Licence notice";

  const message =
    tone === "restricted"
      ? RESTRICTED_MODE_MESSAGE
      : evaluation.warnings[0] ?? "Please review the institution licence.";

  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
        {canManage && (
          <>
            <Link className="underline" href="/admin/settings/licence">
              View licence
            </Link>
            <Link className="underline" href="/admin/settings/backup">
              Backup & restore
            </Link>
          </>
        )}
        <Link className="underline" href="/contact">
          Contact support
        </Link>
      </div>
    </div>
  );
}

export function PortalUnavailable({ moduleName }: { moduleName: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface p-8 text-center">
      <h1 className="text-xl font-semibold">This portal is not included in the current licence</h1>
      <p className="mt-2 text-sm text-muted">
        {moduleName} is disabled for this institution. You can still sign in, but this module is not
        available until the LMS provider enables it.
      </p>
      <p className="mt-4 text-sm">
        <Link className="text-primary underline" href="/contact">
          Contact support
        </Link>
      </p>
    </div>
  );
}
