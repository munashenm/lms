"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface SchoolData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  registrationNo: string | null;
  popiaConsentText: string | null;
  institutionType: string;
  curriculumType: string;
}

interface SchoolSettingsFormProps {
  school: SchoolData;
  manageSchoolId?: string;
}

export function SchoolSettingsForm({ school, manageSchoolId }: SchoolSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(
        manageSchoolId
          ? `/api/school?schoolId=${encodeURIComponent(manageSchoolId)}`
          : "/api/school",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(manageSchoolId ? { schoolId: manageSchoolId } : {}),
            name: form.get("name"),
            email: form.get("email") || "",
            phone: form.get("phone") || undefined,
            website: form.get("website") || "",
            address: form.get("address") || undefined,
            city: form.get("city") || undefined,
            province: form.get("province") || undefined,
            postalCode: form.get("postalCode") || undefined,
            registrationNo: form.get("registrationNo") || undefined,
            popiaConsentText: form.get("popiaConsentText") || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success("Settings saved");
      router.refresh();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">School Profile</CardTitle>
          <p className="text-sm text-muted">
            {school.institutionType.replace("_", " ")} · {school.curriculumType}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>School Name</Label>
            <Input name="name" defaultValue={school.name} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input name="email" type="email" defaultValue={school.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input name="phone" defaultValue={school.phone ?? ""} placeholder="0821234567" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Website</Label>
            <Input name="website" defaultValue={school.website ?? ""} placeholder="https://" />
          </div>
          <div className="space-y-2">
            <Label>Registration No.</Label>
            <Input name="registrationNo" defaultValue={school.registrationNo ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Street Address</Label>
            <Input name="address" defaultValue={school.address ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input name="city" defaultValue={school.city ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Province</Label>
            <Input name="province" defaultValue={school.province ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Postal Code</Label>
            <Input name="postalCode" defaultValue={school.postalCode ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">POPIA Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Consent Text (shown on application forms)</Label>
            <textarea
              name="popiaConsentText"
              defaultValue={school.popiaConsentText ?? ""}
              rows={4}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="I consent to the processing of personal information in accordance with POPIA..."
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Settings
      </Button>
    </form>
  );
}
