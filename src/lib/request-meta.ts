import type { NextRequest } from "next/server";

export function requestMeta(request: NextRequest): {
  ipAddress?: string;
  userAgent?: string;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  return {
    ipAddress,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
