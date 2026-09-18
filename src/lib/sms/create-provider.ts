import type { ResolvedIntegrations } from "../school-integrations";
import { createTwilioSmsProvider } from "./twilio-provider";
import { createRestSmsProvider } from "./rest-provider";
import type { SmsProvider } from "./provider";

export function createSmsProvider(config: ResolvedIntegrations): SmsProvider {
  if ((config.sms.provider || "TWILIO") === "GENERIC_REST") {
    return createRestSmsProvider(config);
  }
  return createTwilioSmsProvider(config);
}
