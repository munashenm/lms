import { prisma } from "@/lib/db";
import { asInputJson } from "@/lib/json";

export async function logLicenseServerAudit(entry: {
  action: string;
  licenseKey?: string | null;
  actor?: string | null;
  result: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await prisma.licenseServerAudit.create({
    data: {
      action: entry.action,
      licenseKey: entry.licenseKey ?? undefined,
      actor: entry.actor ?? undefined,
      result: entry.result,
      metadata: entry.metadata ? asInputJson(entry.metadata) : undefined,
      ipAddress: entry.ipAddress,
    },
  });
}
