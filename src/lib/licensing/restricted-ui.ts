import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { EvaluatedLicense } from "./types";
import { isRestrictedPathAllowed } from "./restricted-paths";

const PATHNAME_HEADER = "x-schoolhub-pathname";

export function restrictedPathnameHeaderName() {
  return PATHNAME_HEADER;
}

/**
 * When a school licence is restricted, keep staff on allowed management surfaces
 * (licence, backup, account) rather than operational write UIs.
 * Read-only list pages are still reachable — this only redirects clearly operational
 * admin write hubs when the path is not allowlisted.
 */
export async function redirectIfRestrictedUi(
  license: EvaluatedLicense | null | undefined,
  fallback = "/admin/settings/licence"
) {
  if (!license?.restricted) return;
  const headerStore = await headers();
  const pathname = headerStore.get(PATHNAME_HEADER) ?? "";
  if (!pathname) return;
  if (isRestrictedPathAllowed(pathname, "GET")) return;
  // Allow ordinary GET browsing of records; only bounce known write/management hubs
  // that are not on the allowlist when the user is deep in create/edit flows.
  const writeHubs = [
    "/admin/students/new",
    "/admin/finance/",
    "/admin/payroll/",
    "/admin/hr/",
    "/admin/modules",
    "/finance/",
    "/hr/",
  ];
  if (writeHubs.some((hub) => pathname === hub || pathname.startsWith(hub))) {
    redirect(fallback);
  }
}
