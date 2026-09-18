import type { ResolvedIntegrations } from "../school-integrations";
import { isOzowConfigured as ozowReady } from "./ozow";
import { isPayFastConfigured as payfastReady } from "./payfast";
import { isPayPalConfigured as paypalReady } from "./paypal";
import { isYocoConfigured as yocoReady } from "./yoco";

export type PaymentGatewayId = "payfast" | "ozow" | "yoco" | "paypal";

export interface PaymentGatewayOption {
  id: PaymentGatewayId;
  label: string;
}

export function getAvailablePaymentGateways(config: ResolvedIntegrations): PaymentGatewayOption[] {
  const gateways: PaymentGatewayOption[] = [];
  if (payfastReady(config)) gateways.push({ id: "payfast", label: "PayFast" });
  if (ozowReady(config)) gateways.push({ id: "ozow", label: "Ozow (Instant EFT)" });
  if (yocoReady(config)) gateways.push({ id: "yoco", label: "Yoco (Card)" });
  if (paypalReady(config)) gateways.push({ id: "paypal", label: "PayPal" });
  return gateways;
}
