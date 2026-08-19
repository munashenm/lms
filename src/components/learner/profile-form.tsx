"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function LearnerProfileForm({
  email,
  phone,
  address,
  city,
  province,
  postalCode,
}: {
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          phone: form.get("phone"),
          address: form.get("address"),
          city: form.get("city"),
          province: form.get("province"),
          postalCode: form.get("postalCode"),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Contact details updated");
      router.refresh();
    } catch {
      toast.error("Could not update profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input name="email" type="email" defaultValue={email} />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input name="phone" defaultValue={phone} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Address</Label>
        <Input name="address" defaultValue={address} />
      </div>
      <div className="space-y-2">
        <Label>City</Label>
        <Input name="city" defaultValue={city} />
      </div>
      <div className="space-y-2">
        <Label>Province</Label>
        <Input name="province" defaultValue={province} />
      </div>
      <div className="space-y-2">
        <Label>Postal code</Label>
        <Input name="postalCode" defaultValue={postalCode} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save contact details
        </Button>
      </div>
    </form>
  );
}
