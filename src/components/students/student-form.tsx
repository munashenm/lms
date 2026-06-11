"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SA_PROVINCES } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface Option {
  id: string;
  name: string;
}

interface StudentFormProps {
  grades: Option[];
  classes: Option[];
  campuses: Option[];
}

export function StudentForm({ grades, classes, campuses }: StudentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [popiaConsent, setPopiaConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form.entries());

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, popiaConsent }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.errors) setErrors(result.errors);
        else toast.error(result.message || "Failed to create student");
        return;
      }

      toast.success("Student created successfully");
      router.push("/admin/students");
      router.refresh();
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input id="firstName" name="firstName" error={errors.firstName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input id="lastName" name="lastName" error={errors.lastName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="studentNumber">Student Number *</Label>
            <Input id="studentNumber" name="studentNumber" placeholder="e.g. STD2026001" error={errors.studentNumber} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saIdNumber">SA ID Number</Label>
            <Input id="saIdNumber" name="saIdNumber" placeholder="13-digit ID" maxLength={13} error={errors.saIdNumber} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" error={errors.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile Phone</Label>
            <Input id="phone" name="phone" placeholder="082 123 4567" error={errors.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select id="gender" name="gender">
              <option value="">Select...</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Academic Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gradeId">Grade</Label>
            <Select id="gradeId" name="gradeId">
              <option value="">Select grade...</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="classId">Class</Label>
            <Select id="classId" name="classId">
              <option value="">Select class...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campusId">Campus</Label>
            <Select id="campusId" name="campusId">
              <option value="">Select campus...</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Active</option>
              <option value="APPLICANT">Applicant</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Street Address</Label>
            <Input id="address" name="address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Select id="province" name="province">
              <option value="">Select province...</option>
              {SA_PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input id="postalCode" name="postalCode" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={popiaConsent}
              onChange={(e) => setPopiaConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <div>
              <p className="text-sm font-medium">POPIA Consent</p>
              <p className="text-xs text-muted mt-1">
                I confirm that consent has been obtained to collect and process this student&apos;s
                personal information in accordance with the Protection of Personal Information Act (POPIA).
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Create Student"
          )}
        </Button>
      </div>
    </form>
  );
}
