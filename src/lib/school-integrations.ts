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
  paypal: {
    enabled: boolean;
    clientId: string | null;
    secret: string | null;
    sandbox: boolean;
    currency: string;
  };
  sms: {
    provider: string;
    restUrl: string | null;
    restMethod: string;
    restApiKey: string | null;
    restFrom: string | null;
    restBodyTemplate: string | null;
    restAuthHeader: string | null;
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
  paypal: {
    enabled: boolean;
    clientId: string;
    sandbox: boolean;
    currency: string;
    secretSet: boolean;
  };
  sms: {
    provider: string;
    restUrl: string;
    restMethod: string;
    restFrom: string;
    restBodyTemplate: string;
    restAuthHeader: string;
    restApiKeySet: boolean;
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
    paypal: {
      enabled: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET),
      clientId: process.env.PAYPAL_CLIENT_ID ?? null,
      secret: process.env.PAYPAL_SECRET ?? null,
      sandbox: process.env.PAYPAL_SANDBOX !== "false",
      currency: process.env.PAYPAL_CURRENCY ?? "ZAR",
    },
    sms: {
      provider: process.env.SMS_PROVIDER ?? "TWILIO",
      restUrl: process.env.SMS_REST_URL ?? null,
      restMethod: process.env.SMS_REST_METHOD ?? "POST",
      restApiKey: process.env.SMS_REST_API_KEY ?? null,
      restFrom: process.env.SMS_REST_FROM ?? null,
      restBodyTemplate: process.env.SMS_REST_BODY_TEMPLATE ?? null,
      restAuthHeader: process.env.SMS_REST_AUTH_HEADER ?? null,
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
    paypal: {
      enabled: row.paypalEnabled,
      clientId: row.paypalClientId,
      secret: decryptSecret(row.paypalSecret),
      sandbox: row.paypalSandbox,
      currency: row.paypalCurrency || "ZAR",
    },
    sms: {
      provider: row.smsProvider || "TWILIO",
      restUrl: row.smsRestUrl,
      restMethod: row.smsRestMethod || "POST",
      restApiKey: decryptSecret(row.smsRestApiKey),
      restFrom: row.smsRestFrom,
      restBodyTemplate: row.smsRestBodyTemplate,
      restAuthHeader: row.smsRestAuthHeader,
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
      paypal: {
        enabled: false,
        clientId: "",
        sandbox: true,
        currency: env.paypal.currency,
        secretSet: maskSecret(env.paypal.secret),
      },
      sms: {
        provider: env.sms.provider,
        restUrl: env.sms.restUrl ?? "",
        restMethod: env.sms.restMethod,
        restFrom: env.sms.restFrom ?? "",
        restBodyTemplate: env.sms.restBodyTemplate ?? "",
        restAuthHeader: env.sms.restAuthHeader ?? "",
        restApiKeySet: maskSecret(env.sms.restApiKey),
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
    paypal: {
      enabled: row.paypalEnabled,
      clientId: row.paypalClientId ?? "",
      sandbox: row.paypalSandbox,
      currency: row.paypalCurrency || "ZAR",
      secretSet: maskSecret(row.paypalSecret),
    },
    sms: {
      provider: row.smsProvider || "TWILIO",
      restUrl: row.smsRestUrl ?? "",
      restMethod: row.smsRestMethod || "POST",
      restFrom: row.smsRestFrom ?? "",
      restBodyTemplate: row.smsRestBodyTemplate ?? "",
      restAuthHeader: row.smsRestAuthHeader ?? "",
      restApiKeySet: maskSecret(row.smsRestApiKey),
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
    paypal?: {
      enabled?: boolean;
      clientId?: string;
      secret?: SecretUpdate;
      sandbox?: boolean;
      currency?: string;
    };
    sms?: {
      provider?: string;
      restUrl?: string;
      restMethod?: string;
      restApiKey?: SecretUpdate;
      restFrom?: string;
      restBodyTemplate?: string;
      restAuthHeader?: string;
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

    paypalEnabled: input.paypal?.enabled ?? existing?.paypalEnabled ?? false,
    paypalClientId: input.paypal?.clientId ?? existing?.paypalClientId ?? null,
    paypalSecret:
      input.paypal?.secret !== undefined
        ? resolveSecretUpdate(existing?.paypalSecret ?? null, input.paypal.secret)
        : existing?.paypalSecret ?? null,
    paypalSandbox: input.paypal?.sandbox ?? existing?.paypalSandbox ?? true,
    paypalCurrency: input.paypal?.currency ?? existing?.paypalCurrency ?? "ZAR",

    smsProvider: input.sms?.provider ?? existing?.smsProvider ?? "TWILIO",
    smsRestUrl: input.sms?.restUrl ?? existing?.smsRestUrl ?? null,
    smsRestMethod: input.sms?.restMethod ?? existing?.smsRestMethod ?? "POST",
    smsRestApiKey:
      input.sms?.restApiKey !== undefined
        ? resolveSecretUpdate(existing?.smsRestApiKey ?? null, input.sms.restApiKey)
        : existing?.smsRestApiKey ?? null,
    smsRestFrom: input.sms?.restFrom ?? existing?.smsRestFrom ?? null,
    smsRestBodyTemplate: input.sms?.restBodyTemplate ?? existing?.smsRestBodyTemplate ?? null,
    smsRestAuthHeader: input.sms?.restAuthHeader ?? existing?.smsRestAuthHeader ?? null,
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

export function isPayPalReady(config: ResolvedIntegrations) {
  return Boolean(config.paypal.enabled && config.paypal.clientId && config.paypal.secret);
}

export function isSmsGatewayReady(config: ResolvedIntegrations) {
  if ((config.sms.provider || "TWILIO") === "GENERIC_REST") {
    return Boolean(config.sms.restUrl && config.sms.restApiKey);
  }
  return isTwilioReady(config);
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
  if (isPayPalReady(config)) options.push("PayPal online");
  if (isYocoReady(config)) options.push("Yoco card payments");

  options.push("Payment plans available on request");
  return options;
}
