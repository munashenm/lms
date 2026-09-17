const REQUEST_ID_HEADER = "x-request-id";

export function readOrCreateRequestId(existing: string | null | undefined): string {
  const trimmed = existing?.trim();
  if (trimmed && /^[A-Za-z0-9_-]{6,64}$/.test(trimmed)) return trimmed;
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `REQ-${id}`;
}

export function requestIdHeaderName() {
  return REQUEST_ID_HEADER;
}
