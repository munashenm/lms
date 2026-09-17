/** Returns a same-origin path, or null if the value could redirect off-site. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
  if (trimmed.includes("://") || trimmed.includes("\\")) return null;
  if (trimmed.includes("\0")) return null;
  return trimmed;
}
