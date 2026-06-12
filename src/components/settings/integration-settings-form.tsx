"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { PublicIntegrationSettings } from "@/lib/school-integrations";

interface IntegrationSettingsFormProps {
  schoolId: string;
  schoolName: string;
}

function SecretField({
  id,
  label,
  isSet,
  placeholder,
}: {
  id: string;
  label: string;
  isSet: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {isSet && (
          <span className="ml-2 text-xs font-normal text-success">Saved</span>
        )}
      </Label>
      <Input
        id={id}
        name={id}
        type="password"
        autoComplete="off"
        placeholder={isSet ? "Leave blank to keep existing" : placeholder}
      />
    </div>
  );
}

function Toggle({
  id,
  label,
  defaultChecked,
}: {
  id: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
      <input
        id={id}
        name={id}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-border"
      />
      {label}
    </label>
  );
}

export function IntegrationSettingsForm({
  schoolId,
  schoolName,
}: IntegrationSettingsFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PublicIntegrationSettings | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    fetch(`/api/school/integrations?schoolId=${encodeURIComponent(schoolId)}`)
      .then((res) => res.json())
      .then((data) => setSettings(data.integrations ?? null))
      .catch(() => toast.error("Could not load integration settings"))
      .finally(() => setLoading(false));
  }, [schoolId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    const str = (key: string) => {
      const v = form.get(key)?.toString() ?? "";
      return v.length > 0 ? v : undefined;
    };

    const payload = {
      schoolId,
      sendgrid: {
        enabled: form.get("sendgridEnabled") === "on",
        apiKey: str("sendgridApiKey"),
        fromEmail: form.get("sendgridFromEmail")?.toString() ?? "",
        fromName: form.get("sendgridFromName")?.toString() ?? "",
      },
      twilio: {
        enabled: form.get("twilioEnabled") === "on",
        accountSid: str("twilioAccountSid"),
        authToken: str("twilioAuthToken"),
        fromNumber: form.get("twilioFromNumber")?.toString() ?? "",
      },
      payfast: {
        enabled: form.get("payfastEnabled") === "on",
        merchantId: form.get("payfastMerchantId")?.toString() ?? "",
        merchantKey: str("payfastMerchantKey"),
        passphrase: str("payfastPassphrase"),
        sandbox: form.get("payfastSandbox") === "on",
      },
      ozow: {
        enabled: form.get("ozowEnabled") === "on",
        siteCode: form.get("ozowSiteCode")?.toString() ?? "",
        privateKey: str("ozowPrivateKey"),
        sandbox: form.get("ozowSandbox") === "on",
      },
      yoco: {
        enabled: form.get("yocoEnabled") === "on",
        secretKey: str("yocoSecretKey"),
        webhookSecret: str("yocoWebhookSecret"),
      },
    };

    try {
      const res = await fetch(
        `/api/school/integrations?schoolId=${encodeURIComponent(schoolId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSettings(data.integrations);
      setFormKey((k) => k + 1);
      toast.success("Integration settings saved");
    } catch {
      toast.error("Failed to save integration settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted mt-1">
          Email, SMS and payment gateways for {schoolName}. Secrets are encrypted at rest.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email (SendGrid)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle id="sendgridEnabled" label="Enable SendGrid" defaultChecked={settings.sendgrid.enabled} />
          <SecretField id="sendgridApiKey" label="API Key" isSet={settings.sendgrid.apiKeySet} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sendgridFromEmail">From Email</Label>
              <Input
                id="sendgridFromEmail"
                name="sendgridFromEmail"
                type="email"
                defaultValue={settings.sendgrid.fromEmail}
                placeholder="noreply@school.co.za"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sendgridFromName">From Name</Label>
              <Input
                id="sendgridFromName"
                name="sendgridFromName"
                defaultValue={settings.sendgrid.fromName}
                placeholder={schoolName}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMS (Twilio)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle id="twilioEnabled" label="Enable Twilio SMS" defaultChecked={settings.twilio.enabled} />
          <SecretField id="twilioAccountSid" label="Account SID" isSet={settings.twilio.accountSidSet} />
          <SecretField id="twilioAuthToken" label="Auth Token" isSet={settings.twilio.authTokenSet} />
          <div className="space-y-2">
            <Label htmlFor="twilioFromNumber">From Number</Label>
            <Input
              id="twilioFromNumber"
              name="twilioFromNumber"
              defaultValue={settings.twilio.fromNumber}
              placeholder="+27821234567"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PayFast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle id="payfastEnabled" label="Enable PayFast" defaultChecked={settings.payfast.enabled} />
          <div className="space-y-2">
            <Label htmlFor="payfastMerchantId">Merchant ID</Label>
            <Input
              id="payfastMerchantId"
              name="payfastMerchantId"
              defaultValue={settings.payfast.merchantId}
            />
          </div>
          <SecretField id="payfastMerchantKey" label="Merchant Key" isSet={settings.payfast.merchantKeySet} />
          <SecretField id="payfastPassphrase" label="Passphrase" isSet={settings.payfast.passphraseSet} />
          <Toggle id="payfastSandbox" label="Sandbox mode" defaultChecked={settings.payfast.sandbox} />
          <p className="text-xs text-muted">Webhook: {appUrl}/api/webhooks/payfast</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ozow (Instant EFT)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle id="ozowEnabled" label="Enable Ozow" defaultChecked={settings.ozow.enabled} />
          <div className="space-y-2">
            <Label htmlFor="ozowSiteCode">Site Code</Label>
            <Input id="ozowSiteCode" name="ozowSiteCode" defaultValue={settings.ozow.siteCode} />
          </div>
          <SecretField id="ozowPrivateKey" label="Private Key" isSet={settings.ozow.privateKeySet} />
          <Toggle id="ozowSandbox" label="Test mode" defaultChecked={settings.ozow.sandbox} />
          <p className="text-xs text-muted">Notify URL: {appUrl}/api/webhooks/ozow</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yoco (Card)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle id="yocoEnabled" label="Enable Yoco" defaultChecked={settings.yoco.enabled} />
          <SecretField id="yocoSecretKey" label="Secret Key" isSet={settings.yoco.secretKeySet} placeholder="sk_live_..." />
          <SecretField
            id="yocoWebhookSecret"
            label="Webhook Secret"
            isSet={settings.yoco.webhookSecretSet}
            placeholder="whsec_..."
          />
          <p className="text-xs text-muted">Webhook URL: {appUrl}/api/webhooks/yoco</p>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Integrations
      </Button>
    </form>
  );
}
