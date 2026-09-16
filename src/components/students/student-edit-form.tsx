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
  middleName: string | null;
  lastName: string;
  preferredName: string | null;
  saIdNumber: string | null;
  passportNumber: string | null;
  alternativeId: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  homeLanguage: string | null;
  campusId: string | null;
  studentNumber: string;
  enrolledAt: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  postalAddress: string | null;
  medicalNotes: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelationship: string | null;
  notes: string | null;
  status: string;
}

export function StudentEditForm({
  studentId,
  student,
  campuses,
}: {
  studentId: string;
  student: StudentEditValues;
  grades?: Option[];
  classes?: Option[];
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
    <form id="edit-student" onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Personal details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="firstName" label="First name *" defaultValue={student.firstName} error={errors.firstName} required />
          <Field id="middleName" label="Middle name" defaultValue={student.middleName} />
          <Field id="lastName" label="Surname *" defaultValue={student.lastName} error={errors.lastName} required />
          <Field id="preferredName" label="Preferred name" defaultValue={student.preferredName} />
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
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
          <Field id="nationality" label="Nationality" defaultValue={student.nationality} />
          <Field id="homeLanguage" label="Home language" defaultValue={student.homeLanguage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Identification</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="saIdNumber" label="SA ID" defaultValue={student.saIdNumber} maxLength={13} error={errors.saIdNumber} />
          <Field id="passportNumber" label="Passport number" defaultValue={student.passportNumber} />
          <Field id="alternativeId" label="Alternative ID" defaultValue={student.alternativeId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="email" label="Email" type="email" defaultValue={student.email} error={errors.email} />
          <Field id="phone" label="Mobile" defaultValue={student.phone} error={errors.phone} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Residential address</Label>
            <Input id="address" name="address" defaultValue={student.address ?? ""} />
          </div>
          <Field id="city" label="City" defaultValue={student.city} />
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Select id="province" name="province" defaultValue={student.province ?? ""}>
              <option value="">Select province...</option>
              {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <Field id="postalCode" label="Postal code" defaultValue={student.postalCode} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="postalAddress">Postal address</Label>
            <Input id="postalAddress" name="postalAddress" defaultValue={student.postalAddress ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">School information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="studentNumber" label="Admission number" defaultValue={student.studentNumber} />
          <div className="space-y-2">
            <Label htmlFor="enrolledAt">Admission date</Label>
            <Input id="enrolledAt" name="enrolledAt" type="date" defaultValue={student.enrolledAt ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Enrolment status</Label>
            <Select id="status" name="status" defaultValue={student.status}>
              <option value="ACTIVE">Active</option>
              <option value="APPLICANT">Applicant</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="GRADUATED">Graduated</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campusId">Campus</Label>
            <Select id="campusId" name="campusId" defaultValue={student.campusId ?? ""}>
              <option value="">Select campus...</option>
              {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <p className="sm:col-span-2 text-sm text-muted">
            Grade and class are changed through Promotion & Progression so previous years stay on record.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Emergency and additional information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="emergencyName" label="Emergency contact" defaultValue={student.emergencyName} />
          <Field id="emergencyRelationship" label="Relationship" defaultValue={student.emergencyRelationship} />
          <Field id="emergencyPhone" label="Emergency phone" defaultValue={student.emergencyPhone} error={errors.emergencyPhone} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="medicalNotes">Medical notes</Label>
            <Input id="medicalNotes" name="medicalNotes" defaultValue={student.medicalNotes ?? ""} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={student.notes ?? ""} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  defaultValue,
  error,
  required,
  type,
  maxLength,
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} defaultValue={defaultValue ?? ""} error={error} required={required} maxLength={maxLength} />
    </div>
  );
}
