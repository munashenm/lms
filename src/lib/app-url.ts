/** Public origin used in emails, resets, callbacks, and licence domain display. */
export function publicAppUrl(fallbackOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const raw = configured || fallbackOrigin?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function appUrlUsesRailwayHostname(url: string = publicAppUrl()): boolean {
  try {
    return new URL(url).hostname.endsWith(".up.railway.app");
  } catch {
    return false;
  }
}

/**
 * Production should set NEXT_PUBLIC_APP_URL to the canonical custom domain.
 * The Railway hostname still serves the app, but invitation, reset, payment,
 * and email links should not advertise it.
 */
export function canonicalAppUrlWarning(url: string = publicAppUrl()): string | null {
  if (!appUrlUsesRailwayHostname(url)) return null;
  return "NEXT_PUBLIC_APP_URL uses the Railway hostname. Set it to the canonical custom domain so invitation, password-reset, payment, and email links match the public site.";
}
