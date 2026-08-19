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

export interface StudentEditValues {
  firstName: string;
  lastName: string;
  saIdNumber: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  gradeId: string | null;
  classId: string | null;
  campusId: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}

export function StudentEditForm({
  studentId,
  student,
  grades,
  classes,
  campuses,
}: {
  studentId: string;
  student: StudentEditValues;
  grades: Option[];
  classes: Option[];
  campuses: Option[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form.entries());

    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (result.errors) setErrors(result.errors);
        else toast.error(result.message || "Failed to update student");
        return;
      }
      toast.success("Student record updated");
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
          <CardTitle className="text-base">Edit student record</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input id="firstName" name="firstName" defaultValue={student.firstName} error={errors.firstName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input id="lastName" name="lastName" defaultValue={student.lastName} error={errors.lastName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saIdNumber">SA ID Number</Label>
            <Input
              id="saIdNumber"
              name="saIdNumber"
              defaultValue={student.saIdNumber ?? ""}
              maxLength={13}
              error={errors.saIdNumber}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={student.email ?? ""} error={errors.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile Phone</Label>
            <Input id="phone" name="phone" defaultValue={student.phone ?? ""} error={errors.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={student.dateOfBirth ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select id="gender" name="gender" defaultValue={student.gender ?? ""}>
              <option value="">Select...</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gradeId">Grade</Label>
            <Select id="gradeId" name="gradeId" defaultValue={student.gradeId ?? ""}>
              <option value="">Select grade...</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="classId">Class</Label>
            <Select id="classId" name="classId" defaultValue={student.classId ?? ""}>
              <option value="">Select class...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campusId">Campus</Label>
            <Select id="campusId" name="campusId" defaultValue={student.campusId ?? ""}>
              <option value="">Select campus...</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
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
            <Input id="address" name="address" defaultValue={student.address ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={student.city ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Select id="province" name="province" defaultValue={student.province ?? ""}>
              <option value="">Select province...</option>
              {SA_PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input id="postalCode" name="postalCode" defaultValue={student.postalCode ?? ""} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
