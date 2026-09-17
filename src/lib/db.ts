import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./db-url";
import { withIdentityEncryption } from "./pii-prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrisma> | undefined;
};

function createPrisma() {
  process.env.DATABASE_URL = resolveDatabaseUrl(process.env.DATABASE_URL);
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  return withIdentityEncryption(client);
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
