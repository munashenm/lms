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
import type { Terminology } from "@/lib/terminology";
import { getTerminology } from "@/lib/terminology";
import { Loader2 } from "lucide-react";
import {
  REGISTRATION_DOC_ACCEPT,
  STUDENT_PHOTO_ACCEPT,
  STUDENT_REGISTRATION_DOC_SLOTS,
  photoFileFromForm,
  postMultipart,
  registrationFilesFromForm,
} from "@/lib/registration-docs";

interface Option {
  id: string;
  name: string;
}

interface StudentFormProps {
  grades: Option[];
  classes: Option[];
  campuses: Option[];
  terms?: Terminology;
}

export function StudentForm({
  grades,
  classes,
  campuses,
  terms = getTerminology(),
}: StudentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [popiaConsent, setPopiaConsent] = useState(false);
  const [hostel, setHostel] = useState(false);
  const [transport, setTransport] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const photo = photoFileFromForm(form);
    const documents = registrationFilesFromForm(form, STUDENT_REGISTRATION_DOC_SLOTS);
    const data = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      studentNumber: form.get("studentNumber"),
      saIdNumber: form.get("saIdNumber"),
      email: form.get("email"),
      phone: form.get("phone"),
      dateOfBirth: form.get("dateOfBirth"),
      gender: form.get("gender"),
      gradeId: form.get("gradeId"),
      classId: form.get("classId"),
      campusId: form.get("campusId"),
      status: form.get("status"),
      address: form.get("address"),
      city: form.get("city"),
      province: form.get("province"),
      postalCode: form.get("postalCode"),
    };

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, popiaConsent, hostel, transport }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.errors) setErrors(result.errors);
        else toast.error(result.message || `Failed to create ${terms.student.toLowerCase()}`);
        return;
      }

      toast.success(
        result.provision?.invitesSent
          ? `${terms.student} created. Password setup email sent.`
          : `${terms.student} created successfully`
      );

      const studentId = result.student?.id as string | undefined;
      if (studentId) {
        const uploadErrors: string[] = [];
        if (photo) {
          const photoResult = await postMultipart(`/api/students/${studentId}/photo`, { photo });
          if (!photoResult.ok) uploadErrors.push(photoResult.message || "Photo");
        }
        for (const doc of documents) {
          const docResult = await postMultipart(`/api/students/${studentId}/documents`, {
            file: doc.file,
            type: doc.type,
            title: doc.title,
          });
          if (!docResult.ok) uploadErrors.push(doc.title);
        }
        if (uploadErrors.length) {
          toast.error(`Created, but some files were not saved: ${uploadErrors.join(", ")}`);
        }
        router.push(`/admin/students/${studentId}`);
      } else {
        router.push("/admin/students");
      }
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
            <Label htmlFor="studentNumber">{terms.admissionNumber}</Label>
            <Input
              id="studentNumber"
              name="studentNumber"
              placeholder="Leave blank to auto-generate"
              error={errors.studentNumber}
            />
            <p className="text-xs text-muted">Auto format: STD{new Date().getFullYear()}0001</p>
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
          <CardTitle className="text-base">Hostel & transport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Hostel and transport fees do not auto-apply unless these flags are set on enrolment.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hostel}
              onChange={(e) => setHostel(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span className="text-sm">Hostel learner for the current academic year</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={transport}
              onChange={(e) => setTransport(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span className="text-sm">Uses school transport for the current academic year</span>
          </label>
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
        <CardHeader>
          <CardTitle className="text-base">Identity photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="photo">Photo for {terms.identityCard.toLowerCase()}</Label>
          <Input
            id="photo"
            name="photo"
            type="file"
            accept={STUDENT_PHOTO_ACCEPT}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted">
            Used on the printed {terms.identityCard.toLowerCase()} and learner portal. JPG, PNG or WebP. Max 5 MB.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registration documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Optional. Attach a birth certificate, ID, past results, or any other enrolment document.
          </p>
          {STUDENT_REGISTRATION_DOC_SLOTS.map((slot) => (
            <div key={slot.name} className="space-y-2">
              <Label htmlFor={slot.name}>{slot.title}</Label>
              {slot.type === "OTHER" ? (
                <Input
                  name={`${slot.name}_title`}
                  placeholder="Document title (optional)"
                />
              ) : null}
              <Input
                id={slot.name}
                name={slot.name}
                type="file"
                accept={REGISTRATION_DOC_ACCEPT}
                className="cursor-pointer"
              />
            </div>
          ))}
          <p className="text-xs text-muted">PDF, Word or image. Max 10 MB each.</p>
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
