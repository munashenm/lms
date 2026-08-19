import type { ResolvedIntegrations } from "../school-integrations";
import { getAvailablePaymentGateways, type PaymentGatewayId } from "./index";

export interface InitiatePaymentInput {
  schoolId: string;
  invoiceId: string;
  amount: number;
  studentName: string;
  studentEmail?: string | null;
  reference: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface InitiatePaymentResult {
  provider: string;
  redirectUrl?: string;
  checkoutId?: string;
  htmlForm?: string;
}

export interface PaymentProvider {
  id: string;
  label: string;
  /** Providers such as Paystack, PayFast or Ozow implement this without changing finance APIs. */
  isConfigured(config: ResolvedIntegrations): boolean;
  initiate?(input: InitiatePaymentInput, config: ResolvedIntegrations): Promise<InitiatePaymentResult>;
}

const BUILTIN: PaymentProvider[] = [
  {
    id: "payfast",
    label: "PayFast",
    isConfigured: (config) => Boolean(config.payfast.enabled && config.payfast.merchantId),
  },
  {
    id: "ozow",
    label: "Ozow",
    isConfigured: (config) => Boolean(config.ozow.enabled && config.ozow.siteCode),
  },
  {
    id: "yoco",
    label: "Yoco",
    isConfigured: (config) => Boolean(config.yoco.enabled && config.yoco.secretKey),
  },
  {
    id: "paystack",
    label: "Paystack",
    isConfigured: () => false,
  },
];

const extraProviders: PaymentProvider[] = [];

export function registerPaymentProvider(provider: PaymentProvider) {
  extraProviders.push(provider);
}

export function listPaymentProviders(config: ResolvedIntegrations): PaymentProvider[] {
  const available = new Set(getAvailablePaymentGateways(config).map((g) => g.id as string));
  return [...BUILTIN, ...extraProviders].filter(
    (p) => p.isConfigured(config) || available.has(p.id as PaymentGatewayId)
  );
}

export function getPaymentProvider(id: string): PaymentProvider | undefined {
  return [...BUILTIN, ...extraProviders].find((p) => p.id === id);
}
