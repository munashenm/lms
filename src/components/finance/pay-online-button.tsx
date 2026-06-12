"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import type { PaymentGatewayId } from "@/lib/payment-gateways";

interface GatewayOption {
  id: PaymentGatewayId;
  label: string;
}

interface PayOnlineButtonProps {
  invoiceId: string;
  outstanding: number;
}

const GATEWAY_ENDPOINTS: Record<PaymentGatewayId, string> = {
  payfast: "/api/payments/gateway/payfast",
  ozow: "/api/payments/gateway/ozow",
  yoco: "/api/payments/gateway/yoco",
};

export function PayOnlineButton({ invoiceId, outstanding }: PayOnlineButtonProps) {
  const [loading, setLoading] = useState(false);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [selected, setSelected] = useState<PaymentGatewayId>("payfast");

  useEffect(() => {
    fetch("/api/payments/gateways")
      .then((res) => res.json())
      .then((data: { gateways?: GatewayOption[] }) => {
        const list = data.gateways ?? [];
        setGateways(list);
        if (list[0]) setSelected(list[0].id);
      })
      .catch(() => setGateways([]));
  }, []);

  if (outstanding <= 0) return null;

  async function handlePay() {
    if (gateways.length === 0) {
      toast.info(
        "Online payments are not configured yet. Contact the finance office."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(GATEWAY_ENDPOINTS[selected], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!data.configured) {
        toast.info(data.message ?? "Online payments not configured yet");
        return;
      }
      if (!data.paymentUrl) {
        toast.error("Could not initiate payment");
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      toast.error("Could not initiate payment");
    } finally {
      setLoading(false);
    }
  }

  if (gateways.length === 0) {
    return (
      <Button variant="outline" disabled>
        <CreditCard className="h-4 w-4 mr-2" />
        Pay Online (not configured)
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {gateways.length > 1 && (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as PaymentGatewayId)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
          disabled={loading}
        >
          {gateways.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      )}
      <Button onClick={handlePay} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4 mr-2" />
        )}
        Pay Online
        {gateways.length === 1 ? ` (${gateways[0].label})` : ""}
      </Button>
    </div>
  );
}
