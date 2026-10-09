const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /SG\.[A-Za-z0-9._-]{8,}/g, replacement: "[redacted]" },
  { pattern: /re_[A-Za-z0-9_-]{6,}/g, replacement: "[redacted]" },
  { pattern: /Bearer\s+\S+/gi, replacement: "Bearer [redacted]" },
  { pattern: /SHSA-[A-Z0-9-]{6,}/gi, replacement: "[redacted]" },
];

/** Remove provider keys and licence keys before anything is logged or stored. */
export function sanitizeEmailDetail(detail: string, secrets: Array<string | null | undefined> = []): string {
  let value = detail;
  for (const secret of secrets) {
    const token = secret?.trim();
    if (!token || token.length < 8) continue;
    value = value.split(token).join("[redacted]");
  }
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    value = value.replace(pattern, replacement);
  }
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}
