import type { PrismaClient } from "@prisma/client";
import { hashSaId, revealSaId, sealSaId } from "./pii-crypto";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value);
}

export function sealIdentityData(data: unknown): unknown {
  if (data == null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    data.forEach(sealIdentityData);
    return data;
  }
  if (!isPlainObject(data)) return data;
  if ("saIdNumber" in data) {
    const sealed = sealSaId(data.saIdNumber as string | null | undefined);
    data.saIdNumber = sealed.stored;
    data.saIdNumberHash = sealed.hash;
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === "object") sealIdentityData(value);
  }
  return data;
}

function saIdFilterClause(value: unknown): Record<string, unknown> {
  if (value == null) return { saIdNumber: null, saIdNumberHash: null };
  if (typeof value === "string") {
    const hash = hashSaId(value);
    return { OR: [...(hash ? [{ saIdNumberHash: hash }] : []), { saIdNumber: value }] };
  }
  if (isPlainObject(value)) {
    const raw = value.equals ?? value.contains ?? value.startsWith;
    if (typeof raw === "string") {
      const digits = raw.replace(/\D/g, "");
      const hash =
        typeof value.equals === "string"
          ? hashSaId(raw)
          : digits.length === 13
            ? hashSaId(digits)
            : null;
      return {
        OR: [...(hash ? [{ saIdNumberHash: hash }] : []), { saIdNumber: value }],
      };
    }
  }
  return { saIdNumber: value };
}

export function rewriteIdentityWhere(where: unknown): unknown {
  if (where == null || typeof where !== "object") return where;
  if (Array.isArray(where)) {
    return where.map((item) => rewriteIdentityWhere(item));
  }
  if (!isPlainObject(where)) return where;

  for (const [key, value] of Object.entries(where)) {
    if (key !== "saIdNumber") {
      where[key] = rewriteIdentityWhere(value);
    }
  }

  if ("saIdNumber" in where) {
    const clause = saIdFilterClause(where.saIdNumber);
    delete where.saIdNumber;
    if (Array.isArray(where.AND)) {
      where.AND.push(clause);
    } else if (Object.keys(where).length === 0) {
      Object.assign(where, clause);
    } else {
      const rest = { ...where };
      for (const key of Object.keys(where)) delete where[key];
      where.AND = [rest, clause];
    }
  }
  return where;
}

export function unsealIdentityResult(result: unknown): unknown {
  if (Array.isArray(result)) {
    result.forEach(unsealIdentityResult);
    return result;
  }
  if (!isPlainObject(result)) return result;
  if ("saIdNumber" in result && (typeof result.saIdNumber === "string" || result.saIdNumber == null)) {
    result.saIdNumber = revealSaId(result.saIdNumber as string | null);
  }
  for (const value of Object.values(result)) {
    if (value && typeof value === "object") unsealIdentityResult(value);
  }
  return result;
}

const RESULT_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "create",
  "createManyAndReturn",
  "update",
  "updateManyAndReturn",
  "upsert",
  "delete",
]);

type QueryArgs = { data?: unknown; where?: unknown };

export function withIdentityEncryption(client: PrismaClient) {
  const handler = async ({
    operation,
    args,
    query,
  }: {
    operation: string;
    args: QueryArgs;
    query: (args: QueryArgs) => Promise<unknown>;
  }) => {
    if (args?.data !== undefined) sealIdentityData(args.data);
    if (args?.where !== undefined) rewriteIdentityWhere(args.where);
    const result = await query(args);
    if (RESULT_OPERATIONS.has(operation)) unsealIdentityResult(result);
    return result;
  };

  return client.$extends({
    query: {
      student: { $allOperations: handler },
      teacher: { $allOperations: handler },
      guardian: { $allOperations: handler },
      application: { $allOperations: handler },
      employee: { $allOperations: handler },
    },
  });
}
