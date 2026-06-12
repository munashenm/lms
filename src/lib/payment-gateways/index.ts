import { isPayFastConfigured } from "./payfast";
import { isOzowConfigured } from "./ozow";
import { isYocoConfigured } from "./yoco";

export type PaymentGatewayId = "payfast" | "ozow" | "yoco";

export interface PaymentGatewayOption {
  id: PaymentGatewayId;
  label: string;
}

export function getAvailablePaymentGateways(): PaymentGatewayOption[] {
  const gateways: PaymentGatewayOption[] = [];
  if (isPayFastConfigured()) gateways.push({ id: "payfast", label: "PayFast" });
  if (isOzowConfigured()) gateways.push({ id: "ozow", label: "Ozow (Instant EFT)" });
  if (isYocoConfigured()) gateways.push({ id: "yoco", label: "Yoco (Card)" });
  return gateways;
}
