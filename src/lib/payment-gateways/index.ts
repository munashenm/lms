import type { ResolvedIntegrations } from "../school-integrations";
import { isOzowConfigured as ozowReady } from "./ozow";
import { isPayFastConfigured as payfastReady } from "./payfast";
import { isPaystackConfigured as paystackReady } from "./paystack";
import { isYocoConfigured as yocoReady } from "./yoco";

export type PaymentGatewayId = "payfast" | "paystack" | "ozow" | "yoco";

export interface PaymentGatewayOption {
  id: PaymentGatewayId;
  label: string;
}

export function getAvailablePaymentGateways(config: ResolvedIntegrations): PaymentGatewayOption[] {
  const gateways: PaymentGatewayOption[] = [];
  if (payfastReady(config)) gateways.push({ id: "payfast", label: "PayFast" });
  if (paystackReady(config)) gateways.push({ id: "paystack", label: "Paystack" });
  if (ozowReady(config)) gateways.push({ id: "ozow", label: "Ozow (Instant EFT)" });
  if (yocoReady(config)) gateways.push({ id: "yoco", label: "Yoco (Card)" });
  return gateways;
}
