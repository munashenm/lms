"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LICENSE_FEATURE_KEYS, LICENSE_FEATURE_LABELS, LICENSE_FEATURE_NOTES, DEFAULT_LICENSE_FEATURES, isFutureLicenseFeature } from "@/lib/licensing/features";
import { formatDate } from "@/lib/utils";

type Issued = {
  id: string;
  licenseKey: string;
  status: string;
  institutionName: string | null;
  institutionId: string | null;
  expiresAt: string | null;
  issuedAt: string;
  product: { code: string; name: string };
  plan: { code: string; name: string } | null;
  activations: { installationId: string; isActive: boolean }[];
};

export function LicenceIssuer() {
  const [enabled, setEnabled] = useState(false);
  const [licences, setLicences] = useState<Issued[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [plans, setPlans] = useState<{ id: string; code: string; name: string; productId: string }[]>([]);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    productCode: "lms",
    planCode: "standard",
    institutionId: "",
    institutionName: "",
    status: "ACTIVE",
    expiresAt: "",
    maxLearners: "1000",
    maxEducators: "80",
    maxAdministrators: "20",
    maxCampuses: "3",
    features: { ...DEFAULT_LICENSE_FEATURES },
  });

  async function load() {
    const res = await fetch("/api/license-server/v1/licenses");
    if (!res.ok) {
      toast.error("Unable to load vendor licences");
      return;
    }
    const json = await res.json();
    setEnabled(Boolean(json.enabled));
    setLicences(json.licences ?? []);
    setSchools(json.schools ?? []);
    setPlans(json.plans ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load vendor catalogue on mount
    void load();
  }, []);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/license-server/v1/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: form.productCode,
          planCode: form.planCode,
          institutionId: form.institutionId || undefined,
          institutionName: form.institutionName || undefined,
          status: form.status,
          expiresAt: form.expiresAt || null,
          limits: {
            maxLearners: Number(form.maxLearners) || null,
            maxEducators: Number(form.maxEducators) || null,
            maxAdministrators: Number(form.maxAdministrators) || null,
            maxCampuses: Number(form.maxCampuses) || null,
          },
          features: form.features,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Could not issue licence");
        return;
      }
      setIssuedKey(json.licenseKey);
      toast.success("Licence issued");
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!enabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Licence signing is not enabled on this installation. Set LICENSE_SERVER_ENABLED=true and
          LICENSE_SIGNING_PRIVATE_KEY on the vendor server only — never on a customer LMS.
        </div>
      )}

      {issuedKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
          Issued key: <span className="font-mono font-semibold">{issuedKey}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue a licence</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={issue} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="planCode">Plan</Label>
                <Select
                  id="planCode"
                  value={form.planCode}
                  onChange={(e) => setForm({ ...form, planCode: e.target.value })}
                >
                  {(plans.length ? plans : [
                    { id: "trial", code: "trial", name: "Trial", productId: "" },
                    { id: "standard", code: "standard", name: "Standard", productId: "" },
                  ]).map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="institutionId">Bind to school</Label>
                <Select
                  id="institutionId"
                  value={form.institutionId}
                  onChange={(e) => {
                    const school = schools.find((s) => s.id === e.target.value);
                    setForm({
                      ...form,
                      institutionId: e.target.value,
                      institutionName: school?.name ?? form.institutionName,
                    });
                  }}
                >
                  <option value="">Unbound / later</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="institutionName">Institution name</Label>
                <Input
                  id="institutionName"
                  value={form.institutionName}
                  onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expiry date</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="maxLearners">Max active learners</Label>
                <Input
                  id="maxLearners"
                  type="number"
                  min={1}
                  value={form.maxLearners}
                  onChange={(e) => setForm({ ...form, maxLearners: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="maxEducators">Max educators</Label>
                <Input
                  id="maxEducators"
                  type="number"
                  min={1}
                  value={form.maxEducators}
                  onChange={(e) => setForm({ ...form, maxEducators: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="maxCampuses">Max campuses</Label>
                <Input
                  id="maxCampuses"
                  type="number"
                  min={1}
                  value={form.maxCampuses}
                  onChange={(e) => setForm({ ...form, maxCampuses: e.target.value })}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Modules</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {LICENSE_FEATURE_KEYS.filter((key) => !isFutureLicenseFeature(key)).map((key) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.features[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          features: { ...form.features, [key]: e.target.checked },
                        })
                      }
                    />
                    {LICENSE_FEATURE_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Future modules</p>
              <p className="text-xs text-muted mb-2">
                Reserved in the licence catalogue. Leave off until the module ships — enabling it
                now does not unlock a player or question bank.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {LICENSE_FEATURE_KEYS.filter((key) => isFutureLicenseFeature(key)).map((key) => (
                  <label key={key} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={form.features[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          features: { ...form.features, [key]: e.target.checked },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">{LICENSE_FEATURE_LABELS[key]}</span>
                      {LICENSE_FEATURE_NOTES[key] ? (
                        <span className="block text-xs text-muted">{LICENSE_FEATURE_NOTES[key]}</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={loading || !enabled}>
              Issue signed licence
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issued licences</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Key</th>
                <th>Institution</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expiry</th>
                <th>Activations</th>
              </tr>
            </thead>
            <tbody>
              {licences.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-2 font-mono text-xs">{row.licenseKey}</td>
                  <td>{row.institutionName ?? row.institutionId ?? "—"}</td>
                  <td>{row.plan?.name ?? "—"}</td>
                  <td>
                    <Badge>{row.status}</Badge>
                  </td>
                  <td>{row.expiresAt ? formatDate(row.expiresAt) : "—"}</td>
                  <td>{row.activations.filter((a) => a.isActive).length}</td>
                </tr>
              ))}
              {licences.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted">
                    No licences issued yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
