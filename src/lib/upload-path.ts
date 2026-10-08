export function parseUploadPath(pathname: string): { schoolId: string; rest: string } | null {
  if (pathname.includes("..") || pathname.includes("\\") || pathname.includes("\0")) return null;
  const match = pathname.match(/^\/uploads\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { schoolId: match[1], rest: match[2] };
}

/** Public website artwork only — learner files stay authenticated. */
export function isPublicUploadPath(pathname: string): boolean {
  const parsed = parseUploadPath(pathname);
  if (!parsed) return false;
  return parsed.rest.startsWith("branding/");
}

export function topUploadFolder(rest: string): string {
  return rest.split("/")[0] ?? "";
}

export function uploadPathSegments(rest: string): string[] {
  return rest.split("/").filter(Boolean);
}

/** Heuristic: cuid/entity ids do not contain a file extension dot. */
export function looksLikeEntityId(segment: string | undefined): boolean {
  if (!segment) return false;
  return !segment.includes(".");
}
