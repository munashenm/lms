"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { documentLabel } from "@/lib/admissions";
import { REGISTRATION_DOC_ACCEPT } from "@/lib/registration-docs";
import { SA_PROVINCES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type StepId =
  | "intake"
  | "applicant"
  | "guardian"
  | "education"
  | "documents"
  | "additional"
  | "popia"
  | "review";

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "intake", label: "Intake" },
  { id: "applicant", label: "Applicant" },
  { id: "guardian", label: "Parent / Guardian" },
  { id: "education", label: "Previous education" },
  { id: "documents", label: "Documents" },
  { id: "additional", label: "Additional" },
  { id: "popia", label: "POPIA" },
  { id: "review", label: "Review" },
];

export interface ApplyWizardSchool {
  slug: string;
  name: string;
  college: boolean;
  popiaConsentText: string | null;
  yearLabel: string;
  gradeLabel: string;
  programmeLabel: string;
  guardianLabel: string;
  grades: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
  campuses: Array<{ id: string; name: string }>;
  requiredDocuments: string[];
  instructions?: string | null;
}

interface FormState {
  campusId: string;
  gradeApplied: string;
  courseApplied: string;
  firstName: string;
  lastName: string;
  saIdNumber: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianRelationship: string;
  previousSchool: string;
  previousGrade: string;
  additionalInfo: string;
  notes: string;
  popiaAccepted: boolean;
}

const EMPTY: FormState = {
  campusId: "",
  gradeApplied: "",
  courseApplied: "",
  firstName: "",
  lastName: "",
  saIdNumber: "",
  dateOfBirth: "",
  gender: "",
  nationality: "South African",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  guardianFirstName: "",
  guardianLastName: "",
  guardianEmail: "",
  guardianPhone: "",
  guardianRelationship: "",
  previousSchool: "",
  previousGrade: "",
  additionalInfo: "",
  notes: "",
  popiaAccepted: false,
};

export function ApplyWizard({
  school,
  initialCourse,
}: {
  school: ApplyWizardSchool;
  initialCourse?: string;
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [referenceNo, setReferenceNo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    courseApplied: initialCourse ?? "",
    campusId: school.campuses[0]?.id ?? "",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const current = STEPS[step];

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateStep(index: number): Record<string, string> {
    const next: Record<string, string> = {};
    const id = STEPS[index].id;
    if (id === "intake") {
      if (!school.college && !form.gradeApplied) next.gradeApplied = `${school.gradeLabel} is required`;
      if (school.college && !form.courseApplied) next.courseApplied = `${school.programmeLabel} is required`;
    }
    if (id === "applicant") {
      if (!form.firstName.trim()) next.firstName = "First name is required";
      if (!form.lastName.trim()) next.lastName = "Last name is required";
      if (!form.email.trim() && !form.phone.trim()) next.email = "Provide an email or phone number";
    }
    if (id === "guardian" && !school.college) {
      if (!form.guardianFirstName.trim()) next.guardianFirstName = "Guardian first name is required";
      if (!form.guardianLastName.trim()) next.guardianLastName = "Guardian last name is required";
      if (!form.guardianEmail.trim() && !form.guardianPhone.trim()) {
        next.guardianPhone = "Provide a guardian email or phone number";
      }
    }
    if (id === "documents") {
      for (const type of school.requiredDocuments) {
        if (!files[type]) next[`doc_${type}`] = `${documentLabel(type)} is required`;
      }
    }
    if (id === "popia" && !form.popiaAccepted) {
      next.popiaAccepted = "You must accept the POPIA declaration";
    }
    return next;
  }

  function goNext() {
    const nextErrors = validateStep(step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("Please complete the required fields on this step.");
      return;
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  async function submit() {
    const allErrors = STEPS.reduce((acc, _, index) => ({ ...acc, ...validateStep(index) }), {} as Record<string, string>);
    setErrors(allErrors);
    if (Object.keys(allErrors).length) {
      toast.error("Please complete all required steps before submitting.");
      const first = STEPS.findIndex((_, index) => Object.keys(validateStep(index)).length);
      if (first >= 0) setStep(first);
      return;
    }
    setLoading(true);
    try {
      const body = new FormData();
      body.set("schoolSlug", school.slug);
      Object.entries(form).forEach(([key, value]) => {
        if (typeof value === "boolean") body.set(key, value ? "true" : "false");
        else if (value) body.set(key, value);
      });
      school.requiredDocuments.forEach((type) => {
        const file = files[type];
        if (file) {
          body.append("documents", file);
          body.append("documentTypes", type);
        }
      });
      const res = await fetch("/api/applications", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        toast.error(data.message || "Submission failed");
        return;
      }
      setReferenceNo(data.referenceNo);
      toast.success("Application submitted");
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(
    () => [
      ["Intake", school.yearLabel],
      [school.gradeLabel, form.gradeApplied || "—"],
      [school.programmeLabel, form.courseApplied || "—"],
      ["Applicant", `${form.firstName} ${form.lastName}`.trim()],
      ["Contact", form.email || form.phone || "—"],
      [school.guardianLabel, `${form.guardianFirstName} ${form.guardianLastName}`.trim() || "—"],
    ],
    [form, school]
  );

  if (referenceNo) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-success mx-auto" />
          <div>
            <p className="font-semibold text-lg">Application submitted</p>
            <p className="text-muted text-sm mt-2">Your reference number is:</p>
            <p className="font-mono text-xl font-bold text-primary mt-2">{referenceNo}</p>
            <p className="text-xs text-muted mt-4">Keep this number to track your application.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href={`/apply/status?ref=${encodeURIComponent(referenceNo)}`}>Track application</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application for {school.yearLabel}</CardTitle>
        <ol className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-4">
          {STEPS.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "w-full rounded-lg px-1 py-2 text-[11px] sm:text-xs font-medium",
                  index === step ? "bg-primary text-white" : index < step ? "bg-primary/10 text-primary" : "bg-background text-muted"
                )}
              >
                {index + 1}. {item.label}
              </button>
            </li>
          ))}
        </ol>
      </CardHeader>
      <CardContent className="space-y-5">
        {school.instructions && step === 0 ? (
          <p className="text-sm text-muted whitespace-pre-wrap">{school.instructions}</p>
        ) : null}

        {current.id === "intake" && (
          <div className="space-y-4">
            {school.campuses.length > 1 ? (
              <div className="space-y-2">
                <Label>Campus</Label>
                <Select value={form.campusId} onChange={(e) => setField("campusId", e.target.value)}>
                  {school.campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {school.grades.length ? (
              <div className="space-y-2">
                <Label>{school.gradeLabel} {school.college ? "" : "*"}</Label>
                <Select value={form.gradeApplied} onChange={(e) => setField("gradeApplied", e.target.value)} error={errors.gradeApplied}>
                  <option value="">Select {school.gradeLabel.toLowerCase()}...</option>
                  {school.grades.map((grade) => (
                    <option key={grade.id} value={grade.name}>
                      {grade.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {school.courses.length ? (
              <div className="space-y-2">
                <Label>{school.programmeLabel} {school.college ? "*" : ""}</Label>
                <Select value={form.courseApplied} onChange={(e) => setField("courseApplied", e.target.value)} error={errors.courseApplied}>
                  <option value="">Select {school.programmeLabel.toLowerCase()}...</option>
                  {school.courses.map((course) => (
                    <option key={course.id} value={course.name}>
                      {course.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              !school.college ? null : (
                <div className="space-y-2">
                  <Label>{school.programmeLabel} *</Label>
                  <Input value={form.courseApplied} onChange={(e) => setField("courseApplied", e.target.value)} error={errors.courseApplied} />
                </div>
              )
            )}
          </div>
        )}

        {current.id === "applicant" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First name *</Label>
                <Input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} error={errors.firstName} />
              </div>
              <div className="space-y-2">
                <Label>Last name *</Label>
                <Input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} error={errors.lastName} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SA ID number</Label>
                <Input value={form.saIdNumber} maxLength={13} onChange={(e) => setField("saIdNumber", e.target.value)} error={errors.saIdNumber} />
              </div>
              <div className="space-y-2">
                <Label>Date of birth</Label>
                <Input type="date" value={form.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.gender} onChange={(e) => setField("gender", e.target.value)}>
                  <option value="">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => setField("nationality", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} error={errors.email} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} error={errors.phone} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setField("address", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setField("city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Select value={form.province} onChange={(e) => setField("province", e.target.value)}>
                  <option value="">Select...</option>
                  {SA_PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Postal code</Label>
                <Input value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {current.id === "guardian" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {school.college
                ? "Optional unless a parent or sponsor should receive application updates."
                : `Required for school ${school.gradeLabel.toLowerCase()} applications.`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First name {school.college ? "" : "*"}</Label>
                <Input value={form.guardianFirstName} onChange={(e) => setField("guardianFirstName", e.target.value)} error={errors.guardianFirstName} />
              </div>
              <div className="space-y-2">
                <Label>Last name {school.college ? "" : "*"}</Label>
                <Input value={form.guardianLastName} onChange={(e) => setField("guardianLastName", e.target.value)} error={errors.guardianLastName} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.guardianEmail} onChange={(e) => setField("guardianEmail", e.target.value)} error={errors.guardianEmail} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.guardianPhone} onChange={(e) => setField("guardianPhone", e.target.value)} error={errors.guardianPhone} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Input value={form.guardianRelationship} onChange={(e) => setField("guardianRelationship", e.target.value)} placeholder="Mother, Father, Guardian" />
            </div>
          </div>
        )}

        {current.id === "education" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Previous school / college</Label>
              <Input value={form.previousSchool} onChange={(e) => setField("previousSchool", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Previous {school.gradeLabel.toLowerCase()} / qualification</Label>
              <Input value={form.previousGrade} onChange={(e) => setField("previousGrade", e.target.value)} />
            </div>
          </div>
        )}

        {current.id === "documents" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Upload PDF or image files. Maximum 10 MB each.</p>
            {school.requiredDocuments.map((type) => (
              <div key={type} className="space-y-2">
                <Label>{documentLabel(type)} *</Label>
                <Input
                  type="file"
                  accept={REGISTRATION_DOC_ACCEPT}
                  error={errors[`doc_${type}`]}
                  onChange={(e) => setFiles((prev) => ({ ...prev, [type]: e.target.files?.[0] ?? null }))}
                />
                {files[type] ? <p className="text-xs text-muted">{files[type]?.name}</p> : null}
              </div>
            ))}
          </div>
        )}

        {current.id === "additional" && (
          <div className="space-y-2">
            <Label>Additional information</Label>
            <textarea
              rows={5}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={form.additionalInfo}
              onChange={(e) => setField("additionalInfo", e.target.value)}
              placeholder="Medical notes, learning support, or anything the admissions office should know"
            />
          </div>
        )}

        {current.id === "popia" && (
          <div className="space-y-4">
            <p className="text-sm text-muted whitespace-pre-wrap">
              {school.popiaConsentText ||
                "I consent to the collection and processing of personal information for admissions and enrolment in accordance with POPIA."}
            </p>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.popiaAccepted}
                onChange={(e) => setField("popiaAccepted", e.target.checked)}
              />
              <span>I confirm the information is accurate and I accept the POPIA declaration.</span>
            </label>
            {errors.popiaAccepted ? <p className="text-xs text-danger">{errors.popiaAccepted}</p> : null}
          </div>
        )}

        {current.id === "review" && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {summary.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-muted">Documents</dt>
              <dd>{school.requiredDocuments.filter((type) => files[type]).map(documentLabel).join(", ") || "None"}</dd>
            </div>
          </dl>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <Button type="button" variant="outline" disabled={step === 0 || loading} onClick={() => setStep((value) => Math.max(0, value - 1))}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {current.id === "review" ? (
            <Button type="button" className="sm:ml-auto" disabled={loading} onClick={() => void submit()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit application"}
            </Button>
          ) : (
            <Button type="button" className="sm:ml-auto" onClick={goNext}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
