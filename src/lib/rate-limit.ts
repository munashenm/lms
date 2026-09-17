type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): { ok: true; remaining: number } | { ok: false; retryAfterSec: number } {
  const now = opts.now ?? Date.now();
  prune(now);
  const current = buckets.get(opts.key);
  if (!current || current.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1 };
  }
  if (current.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true, remaining: opts.limit - current.count };
}

const idempotency = new Map<string, number>();

/** Returns false when the same key was consumed inside the TTL window. */
export function consumeIdempotency(key: string, ttlMs: number, now = Date.now()): boolean {
  const expires = idempotency.get(key);
  if (expires && expires > now) return false;
  idempotency.set(key, now + ttlMs);
  if (idempotency.size > 2000) {
    for (const [k, exp] of idempotency) {
      if (exp <= now) idempotency.delete(k);
    }
  }
  return true;
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function rateLimitedJson(retryAfterSec: number) {
  return {
    body: { message: "Too many requests. Please try again shortly." },
    status: 429 as const,
    headers: { "Retry-After": String(retryAfterSec) },
  };
}
