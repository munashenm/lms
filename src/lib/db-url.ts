const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SECURE_SSLMODES = new Set(["require", "verify-ca", "verify-full"]);

export function isLocalDatabaseHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname);
}

/** Production talks to Postgres over TLS unless the operator already set sslmode. */
export function resolveDatabaseUrl(
  raw: string | undefined = process.env.DATABASE_URL,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string {
  if (!raw?.trim()) {
    throw new Error("DATABASE_URL is not set");
  }
  const url = raw.trim();
  if (nodeEnv !== "production") return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is invalid");
  }

  if (isLocalDatabaseHost(parsed.hostname)) return url;

  const sslmode = parsed.searchParams.get("sslmode")?.toLowerCase();
  if (sslmode && SECURE_SSLMODES.has(sslmode)) return url;
  if (sslmode === "disable" || sslmode === "allow" || sslmode === "prefer") {
    parsed.searchParams.set("sslmode", "require");
    return parsed.toString();
  }
  parsed.searchParams.set("sslmode", "require");
  return parsed.toString();
}
