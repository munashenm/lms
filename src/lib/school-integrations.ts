import { UserRole } from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./auth";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-crypto";

export interface ResolvedIntegrations {
  sendgrid: {
    enabled: boolean;
    apiKey: string | null;
    fromEmail: string;
    fromName: string;
  };
  twilio: {
    enabled: boolean;
    accountSid: string | null;
    authToken: string | null;
    fromNumber: string | null;
  };
  payfast: {
    enabled: boolean;
    merchantId: string | null;
    merchantKey: string | null;
    passphrase: string | null;
    sandbox: boolean;
  };
  ozow: {
    enabled: boolean;
    siteCode: string | null;
    privateKey: string | null;
    sandbox: boolean;
  };
  yoco: {
    enabled: boolean;
    secretKey: string | null;
    webhookSecret: string | null;
  };
}

export interface PublicIntegrationSettings {
  sendgrid: {
    enabled: boolean;
    fromEmail: string;
    fromName: string;
    apiKeySet: boolean;
  };
  twilio: {
    enabled: boolean;
    fromNumber: string;
    accountSidSet: boolean;
    authTokenSet: boolean;
  };
  payfast: {
    enabled: boolean;
    merchantId: string;
    sandbox: boolean;
    merchantKeySet: boolean;
    passphraseSet: boolean;
  };
  ozow: {
    enabled: boolean;
    siteCode: string;
    sandbox: boolean;
    privateKeySet: boolean;
  };
  yoco: {
    enabled: boolean;
    secretKeySet: boolean;
    webhookSecretSet: boolean;
  };
}

function envFallback(): ResolvedIntegrations {
  return {
    sendgrid: {
      enabled: Boolean(process.env.SENDGRID_API_KEY),
      apiKey: process.env.SENDGRID_API_KEY ?? null,
      fromEmail: process.env.SENDGRID_FROM_EMAIL ?? "noreply@schoolhub.local",
      fromName: process.env.SENDGRID_FROM_NAME ?? "SchoolHub SA",
    },
    twilio: {
      enabled: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? null,
      authToken: process.env.TWILIO_AUTH_TOKEN ?? null,
      fromNumber: process.env.TWILIO_FROM_NUMBER ?? null,
    },
    payfast: {
      enabled: Boolean(
        process.env.PAYFAST_MERCHANT_ID &&
          process.env.PAYFAST_MERCHANT_KEY &&
          process.env.PAYFAST_PASSPHRASE
      ),
      merchantId: process.env.PAYFAST_MERCHANT_ID ?? null,
      merchantKey: process.env.PAYFAST_MERCHANT_KEY ?? null,
      passphrase: process.env.PAYFAST_PASSPHRASE ?? null,
      sandbox: process.env.PAYFAST_SANDBOX !== "false",
    },
    ozow: {
      enabled: Boolean(process.env.OZOW_SITE_CODE && process.env.OZOW_PRIVATE_KEY),
      siteCode: process.env.OZOW_SITE_CODE ?? null,
      privateKey: process.env.OZOW_PRIVATE_KEY ?? null,
      sandbox: process.env.OZOW_SANDBOX !== "false",
    },
    yoco: {
      enabled: Boolean(process.env.YOCO_SECRET_KEY),
      secretKey: process.env.YOCO_SECRET_KEY ?? null,
      webhookSecret: process.env.YOCO_WEBHOOK_SECRET ?? null,
    },
  };
}

function rowToResolved(row: NonNullable<Awaited<ReturnType<typeof loadRow>>>): ResolvedIntegrations {
  return {
    sendgrid: {
      enabled: row.sendgridEnabled,
      apiKey: decryptSecret(row.sendgridApiKey),
      fromEmail: row.sendgridFromEmail ?? "noreply@schoolhub.local",
      fromName: row.sendgridFromName ?? "SchoolHub SA",
    },
    twilio: {
      enabled: row.twilioEnabled,
      accountSid: decryptSecret(row.twilioAccountSid),
      authToken: decryptSecret(row.twilioAuthToken),
      fromNumber: row.twilioFromNumber,
    },
    payfast: {
      enabled: row.payfastEnabled,
      merchantId: row.payfastMerchantId,
      merchantKey: decryptSecret(row.payfastMerchantKey),
      passphrase: decryptSecret(row.payfastPassphrase),
      sandbox: row.payfastSandbox,
    },
    ozow: {
      enabled: row.ozowEnabled,
      siteCode: row.ozowSiteCode,
      privateKey: decryptSecret(row.ozowPrivateKey),
      sandbox: row.ozowSandbox,
    },
    yoco: {
      enabled: row.yocoEnabled,
      secretKey: decryptSecret(row.yocoSecretKey),
      webhookSecret: decryptSecret(row.yocoWebhookSecret),
    },
  };
}

async function loadRow(schoolId: string) {
  return prisma.schoolIntegrationConfig.findUnique({ where: { schoolId } });
}

export async function getResolvedIntegrations(
  schoolId: string | null | undefined
): Promise<ResolvedIntegrations> {
  if (!schoolId) return envFallback();
  const row = await loadRow(schoolId);
  if (!row) return envFallback();
  return rowToResolved(row);
}

export async function getPublicIntegrationSettings(
  schoolId: string
): Promise<PublicIntegrationSettings> {
  const row = await loadRow(schoolId);
  if (!row) {
    const env = envFallback();
    return {
      sendgrid: {
        enabled: false,
        fromEmail: env.sendgrid.fromEmail,
        fromName: env.sendgrid.fromName,
        apiKeySet: maskSecret(env.sendgrid.apiKey),
      },
      twilio: {
        enabled: false,
        fromNumber: env.twilio.fromNumber ?? "",
        accountSidSet: maskSecret(env.twilio.accountSid),
        authTokenSet: maskSecret(env.twilio.authToken),
      },
      payfast: {
        enabled: false,
        merchantId: "",
        sandbox: true,
        merchantKeySet: false,
        passphraseSet: false,
      },
      ozow: {
        enabled: false,
        siteCode: "",
        sandbox: true,
        privateKeySet: false,
      },
      yoco: {
        enabled: false,
        secretKeySet: false,
        webhookSecretSet: false,
      },
    };
  }

  return {
    sendgrid: {
      enabled: row.sendgridEnabled,
      fromEmail: row.sendgridFromEmail ?? "",
      fromName: row.sendgridFromName ?? "",
      apiKeySet: maskSecret(row.sendgridApiKey),
    },
    twilio: {
      enabled: row.twilioEnabled,
      fromNumber: row.twilioFromNumber ?? "",
      accountSidSet: maskSecret(row.twilioAccountSid),
      authTokenSet: maskSecret(row.twilioAuthToken),
    },
    payfast: {
      enabled: row.payfastEnabled,
      merchantId: row.payfastMerchantId ?? "",
      sandbox: row.payfastSandbox,
      merchantKeySet: maskSecret(row.payfastMerchantKey),
      passphraseSet: maskSecret(row.payfastPassphrase),
    },
    ozow: {
      enabled: row.ozowEnabled,
      siteCode: row.ozowSiteCode ?? "",
      sandbox: row.ozowSandbox,
      privateKeySet: maskSecret(row.ozowPrivateKey),
    },
    yoco: {
      enabled: row.yocoEnabled,
      secretKeySet: maskSecret(row.yocoSecretKey),
      webhookSecretSet: maskSecret(row.yocoWebhookSecret),
    },
  };
}

type SecretUpdate = string | undefined | null;

function resolveSecretUpdate(current: string | null, incoming: SecretUpdate): string | null {
  if (incoming === undefined) return current;
  if (incoming === null || incoming === "") return null;
  return encryptSecret(incoming);
}

export async function saveIntegrationSettings(
  schoolId: string,
  input: {
    sendgrid?: {
      enabled?: boolean;
      apiKey?: SecretUpdate;
      fromEmail?: string;
      fromName?: string;
    };
    twilio?: {
      enabled?: boolean;
      accountSid?: SecretUpdate;
      authToken?: SecretUpdate;
      fromNumber?: string;
    };
    payfast?: {
      enabled?: boolean;
      merchantId?: string;
      merchantKey?: SecretUpdate;
      passphrase?: SecretUpdate;
      sandbox?: boolean;
    };
    ozow?: {
      enabled?: boolean;
      siteCode?: string;
      privateKey?: SecretUpdate;
      sandbox?: boolean;
    };
    yoco?: {
      enabled?: boolean;
      secretKey?: SecretUpdate;
      webhookSecret?: SecretUpdate;
    };
  }
) {
  const existing = await loadRow(schoolId);

  const data = {
    sendgridEnabled: input.sendgrid?.enabled ?? existing?.sendgridEnabled ?? false,
    sendgridApiKey:
      input.sendgrid?.apiKey !== undefined
        ? resolveSecretUpdate(existing?.sendgridApiKey ?? null, input.sendgrid.apiKey)
        : existing?.sendgridApiKey ?? null,
    sendgridFromEmail: input.sendgrid?.fromEmail ?? existing?.sendgridFromEmail ?? null,
    sendgridFromName: input.sendgrid?.fromName ?? existing?.sendgridFromName ?? null,

    twilioEnabled: input.twilio?.enabled ?? existing?.twilioEnabled ?? false,
    twilioAccountSid:
      input.twilio?.accountSid !== undefined
        ? resolveSecretUpdate(existing?.twilioAccountSid ?? null, input.twilio.accountSid)
        : existing?.twilioAccountSid ?? null,
    twilioAuthToken:
      input.twilio?.authToken !== undefined
        ? resolveSecretUpdate(existing?.twilioAuthToken ?? null, input.twilio.authToken)
        : existing?.twilioAuthToken ?? null,
    twilioFromNumber: input.twilio?.fromNumber ?? existing?.twilioFromNumber ?? null,

    payfastEnabled: input.payfast?.enabled ?? existing?.payfastEnabled ?? false,
    payfastMerchantId: input.payfast?.merchantId ?? existing?.payfastMerchantId ?? null,
    payfastMerchantKey:
      input.payfast?.merchantKey !== undefined
        ? resolveSecretUpdate(existing?.payfastMerchantKey ?? null, input.payfast.merchantKey)
        : existing?.payfastMerchantKey ?? null,
    payfastPassphrase:
      input.payfast?.passphrase !== undefined
        ? resolveSecretUpdate(existing?.payfastPassphrase ?? null, input.payfast.passphrase)
        : existing?.payfastPassphrase ?? null,
    payfastSandbox: input.payfast?.sandbox ?? existing?.payfastSandbox ?? true,

    ozowEnabled: input.ozow?.enabled ?? existing?.ozowEnabled ?? false,
    ozowSiteCode: input.ozow?.siteCode ?? existing?.ozowSiteCode ?? null,
    ozowPrivateKey:
      input.ozow?.privateKey !== undefined
        ? resolveSecretUpdate(existing?.ozowPrivateKey ?? null, input.ozow.privateKey)
        : existing?.ozowPrivateKey ?? null,
    ozowSandbox: input.ozow?.sandbox ?? existing?.ozowSandbox ?? true,

    yocoEnabled: input.yoco?.enabled ?? existing?.yocoEnabled ?? false,
    yocoSecretKey:
      input.yoco?.secretKey !== undefined
        ? resolveSecretUpdate(existing?.yocoSecretKey ?? null, input.yoco.secretKey)
        : existing?.yocoSecretKey ?? null,
    yocoWebhookSecret:
      input.yoco?.webhookSecret !== undefined
        ? resolveSecretUpdate(existing?.yocoWebhookSecret ?? null, input.yoco.webhookSecret)
        : existing?.yocoWebhookSecret ?? null,
  };

  await prisma.schoolIntegrationConfig.upsert({
    where: { schoolId },
    create: { schoolId, ...data },
    update: data,
  });
}

export function resolveSettingsSchoolId(
  session: SessionPayload,
  schoolIdParam?: string | null
): string | null {
  if (session.role === UserRole.SUPER_ADMIN && schoolIdParam) {
    return schoolIdParam;
  }
  return session.schoolId;
}

export async function resolveSessionSchoolId(
  session: SessionPayload
): Promise<string | null> {
  if (session.schoolId) return session.schoolId;
  const student = await prisma.student.findFirst({
    where: { userId: session.userId },
    select: { schoolId: true },
  });
  return student?.schoolId ?? null;
}

export function isPayFastReady(config: ResolvedIntegrations) {
  return Boolean(
    config.payfast.enabled &&
      config.payfast.merchantId &&
      config.payfast.merchantKey &&
      config.payfast.passphrase
  );
}

export function isOzowReady(config: ResolvedIntegrations) {
  return Boolean(config.ozow.enabled && config.ozow.siteCode && config.ozow.privateKey);
}

export function isYocoReady(config: ResolvedIntegrations) {
  return Boolean(config.yoco.enabled && config.yoco.secretKey);
}

export function isSendGridReady(config: ResolvedIntegrations) {
  return Boolean(config.sendgrid.enabled && config.sendgrid.apiKey);
}

export function isTwilioReady(config: ResolvedIntegrations) {
  return Boolean(
    config.twilio.enabled &&
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.fromNumber
  );
}

export async function getPublicPaymentOptions(schoolId: string): Promise<string[]> {
  const config = await getResolvedIntegrations(schoolId);
  const options = ["EFT / bank transfer", "Cash at finance office"];

  if (isPayFastReady(config)) options.push("PayFast online");
  if (isOzowReady(config)) options.push("Ozow instant EFT");
  if (isYocoReady(config)) options.push("Yoco card payments");

  options.push("Payment plans available on request");
  return options;
}
