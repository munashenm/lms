"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  CURRICULUM_TYPE_LABELS,
  INSTITUTION_TYPE_LABELS,
  INSTITUTION_TYPE_OPTIONS,
  PERIOD_STRUCTURE_LABELS,
  getTerminology,
} from "@/lib/terminology";
import type { InstitutionType } from "@prisma/client";

interface SchoolData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  registrationNo: string | null;
  popiaConsentText: string | null;
  institutionType: string;
  curriculumType: string;
  periodStructure: string;
  absenceNotifyEnabled?: boolean;
}

interface SchoolSettingsFormProps {
  school: SchoolData;
  manageSchoolId?: string;
}

export function SchoolSettingsForm({ school, manageSchoolId }: SchoolSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(school.logoUrl);
  const [institutionType, setInstitutionType] = useState(school.institutionType);

  const typeOptions = Array.from(
    new Set([...INSTITUTION_TYPE_OPTIONS, school.institutionType as InstitutionType])
  );
  const previewTerms = getTerminology(institutionType as InstitutionType);

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
            logoUrl: form.get("logoUrl") || "",
            address: form.get("address") || undefined,
            city: form.get("city") || undefined,
            province: form.get("province") || undefined,
            postalCode: form.get("postalCode") || undefined,
            registrationNo: form.get("registrationNo") || undefined,
            popiaConsentText: form.get("popiaConsentText") || undefined,
            institutionType: form.get("institutionType"),
            curriculumType: form.get("curriculumType"),
            periodStructure: form.get("periodStructure"),
            absenceNotifyEnabled: form.get("absenceNotifyEnabled") === "on",
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

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setLogoUploading(true);
    try {
      const body = new FormData();
      body.append("logo", file);
      if (manageSchoolId) body.append("schoolId", manageSchoolId);
      const res = await fetch(
        manageSchoolId
          ? `/api/school/logo?schoolId=${encodeURIComponent(manageSchoolId)}`
          : "/api/school/logo",
        { method: "POST", body }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Upload failed");
      }
      const data = await res.json();
      setLogoPreview(data.logoUrl);
      toast.success("Logo uploaded");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Institution Profile</CardTitle>
          <p className="text-sm text-muted">
            Terminology preview: {previewTerms.students}, {previewTerms.periods},{" "}
            {previewTerms.teachers}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Institution Name</Label>
            <Input name="name" defaultValue={school.name} required />
          </div>
          <div className="space-y-2">
            <Label>Institution Type</Label>
            <Select
              name="institutionType"
              value={institutionType}
              onChange={(e) => setInstitutionType(e.target.value)}
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {INSTITUTION_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Curriculum</Label>
            <Select name="curriculumType" defaultValue={school.curriculumType}>
              {Object.entries(CURRICULUM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Academic Calendar Structure</Label>
            <Select name="periodStructure" defaultValue={school.periodStructure}>
              {Object.entries(PERIOD_STRUCTURE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted">
              Used when creating default {previewTerms.periods.toLowerCase()} for a new academic session.
            </p>
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
            <Label>Registration / EMIS No.</Label>
            <Input name="registrationNo" defaultValue={school.registrationNo ?? ""} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>School Logo</Label>
            <p className="text-xs text-muted">
              Appears on student cards, report cards, certificates, fee statements and reports.
              Prefer PNG/JPEG under 2MB.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="School logo"
                  className="h-16 w-auto max-w-[140px] object-contain rounded border border-border bg-background p-1"
                />
              ) : (
                <div className="h-16 w-24 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted">
                  No logo
                </div>
              )}
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={logoUploading}
                onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
              />
            </div>
            <Input
              name="logoUrl"
              defaultValue={school.logoUrl ?? ""}
              placeholder="Or paste logo URL /uploads/..."
              className="mt-2"
            />
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
          <CardTitle className="text-base">Absence notifications</CardTitle>
          <p className="text-sm text-muted">
            When enabled, primary guardians with a phone number receive an SMS if a learner is
            marked absent or sick (requires Twilio in Integrations).
          </p>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="absenceNotifyEnabled"
              defaultChecked={school.absenceNotifyEnabled ?? false}
              className="rounded"
            />
            Send automatic absence SMS to parents/guardians
          </label>
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
