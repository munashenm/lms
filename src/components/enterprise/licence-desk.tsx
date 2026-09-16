"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  LICENSE_FEATURE_KEYS,
  LICENSE_FEATURE_LABELS,
  LICENSE_FEATURE_NOTES,
  DEFAULT_LICENSE_FEATURES,
  isFutureLicenseFeature,
} from "@/lib/licensing/features";
import { formatDate } from "@/lib/utils";
import { heartbeatFreshness, type VendorLicenseAction } from "@/lib/license-server/desk-shared";

type Customer = { id: string; name: string; email: string | null };
type School = { id: string; name: string };
type Plan = { id: string; code: string; name: string; productId: string };
type Issued = {
  id: string;
  licenseKey: string;
  status: string;
  institutionName: string | null;
  institutionId: string | null;
  expiresAt: string | null;
  issuedAt: string;
  lastHeartbeatAt: string | null;
  customer: Customer | null;
  product: { code: string; name: string };
  plan: { code: string; name: string } | null;
  activations: { installationId: string; isActive: boolean; lastSeenAt: string; domain: string | null }[];
};

function statusVariant(status: string): "success" | "warning" | "danger" | "secondary" {
  if (status === "ACTIVE" || status === "TRIAL") return "success";
  if (status === "GRACE") return "warning";
  if (status === "EXPIRED" || status === "SUSPENDED" || status === "REVOKED") return "danger";
  return "secondary";
}

export function LicenceDesk() {
  const [enabled, setEnabled] = useState(false);
  const [licences, setLicences] = useState<Issued[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [customerForm, setCustomerForm] = useState({ name: "", email: "" });
  const [form, setForm] = useState({
    productCode: "lms",
    planCode: "standard",
    customerId: "",
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
    setCustomers(json.customers ?? []);
    setSchools(json.schools ?? []);
    setPlans(json.plans ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return licences.filter((row) => {
      if (customerFilter === "none" && row.customer) return false;
      if (customerFilter && customerFilter !== "none" && row.customer?.id !== customerFilter) return false;
      if (!q) return true;
      const haystack = [
        row.licenseKey,
        row.institutionName,
        row.customer?.name,
        row.customer?.email,
        row.plan?.name,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [licences, query, customerFilter]);

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    setLoading("customer");
    try {
      const res = await fetch("/api/license-server/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not save customer");
        return;
      }
      toast.success("Customer added");
      setCustomerForm({ name: "", email: "" });
      setForm((current) => ({ ...current, customerId: json.customer.id }));
      await load();
    } finally {
      setLoading(null);
    }
  }

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setLoading("issue");
    try {
      const res = await fetch("/api/license-server/v1/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: form.productCode,
          planCode: form.planCode,
          customerId: form.customerId || undefined,
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
      setLoading(null);
    }
  }

  async function act(row: Issued, action: VendorLicenseAction) {
    if (action === "revoke" && !window.confirm(`Revoke ${row.licenseKey}? The school will be restricted on the next heartbeat.`)) {
      return;
    }
    if (action === "suspend" && !window.confirm(`Suspend ${row.licenseKey}?`)) {
      return;
    }
    setLoading(`${row.id}-${action}`);
    try {
      const res = await fetch(`/api/license-server/v1/licenses/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not update licence");
        return;
      }
      toast.success(
        action === "renew"
          ? "Licence renewed for 12 months"
          : action === "suspend"
            ? "Licence suspended"
            : action === "revoke"
              ? "Licence revoked"
              : "Licence reactivated"
      );
      await load();
    } finally {
      setLoading(null);
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
          <CardTitle className="text-base">Customers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createCustomer} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Label htmlFor="customerName">School / customer</Label>
              <Input
                id="customerName"
                required
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                placeholder="ABC Primary School"
              />
            </div>
            <div>
              <Label htmlFor="customerEmail">Billing email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading === "customer"} className="w-full">
                Add customer
              </Button>
            </div>
          </form>
          {customers.length === 0 ? (
            <p className="text-sm text-muted">No customers yet. Add the school you are selling to, then issue a key.</p>
          ) : (
            <p className="text-sm text-muted">{customers.length} customer(s) on the vendor desk.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue a licence</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={issue} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="customerId">Customer</Label>
                <Select
                  id="customerId"
                  value={form.customerId}
                  onChange={(e) => {
                    const customer = customers.find((item) => item.id === e.target.value);
                    setForm({
                      ...form,
                      customerId: e.target.value,
                      institutionName: form.institutionName || customer?.name || "",
                    });
                  }}
                >
                  <option value="">Unassigned</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </Select>
              </div>
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
                    <option key={p.code} value={p.code}>{p.name}</option>
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
                </Select>
              </div>
              <div>
                <Label htmlFor="institutionId">Bind to school on this LMS</Label>
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
                    <option key={s.id} value={s.id}>{s.name}</option>
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
                Reserved in the licence catalogue. Leave off until the module ships.
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
            <Button type="submit" disabled={loading === "issue" || !enabled}>
              Issue signed licence
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Licences</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by school, customer, or key"
            />
            <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
              <option value="">All customers</option>
              <option value="none">Unassigned</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Customer</th>
                <th>Institution</th>
                <th>Key</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expiry</th>
                <th>Last heartbeat</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const freshness = heartbeatFreshness(row.lastHeartbeatAt);
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="py-3">
                      <p className="font-medium">{row.customer?.name ?? "Unassigned"}</p>
                      <p className="text-xs text-muted">{row.customer?.email ?? ""}</p>
                    </td>
                    <td>{row.institutionName ?? row.institutionId ?? "—"}</td>
                    <td className="font-mono text-xs">{row.licenseKey}</td>
                    <td>{row.plan?.name ?? "—"}</td>
                    <td>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td>{row.expiresAt ? formatDate(row.expiresAt) : "—"}</td>
                    <td>
                      {row.lastHeartbeatAt ? (
                        <span>
                          {formatDate(row.lastHeartbeatAt)}
                          <span className="block text-xs text-muted">
                            {freshness === "live" ? "Live" : "Stale"}
                            {row.activations[0]?.domain ? ` · ${row.activations[0].domain}` : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">Never</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!enabled || loading === `${row.id}-renew`}
                          onClick={() => void act(row, "renew")}
                        >
                          Renew
                        </Button>
                        {row.status === "SUSPENDED" || row.status === "REVOKED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!enabled || loading === `${row.id}-reactivate`}
                            onClick={() => void act(row, "reactivate")}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!enabled || loading === `${row.id}-suspend`}
                            onClick={() => void act(row, "suspend")}
                          >
                            Suspend
                          </Button>
                        )}
                        {row.status !== "REVOKED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!enabled || loading === `${row.id}-revoke`}
                            onClick={() => void act(row, "revoke")}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted">
                    No licences match.
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
