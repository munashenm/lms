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
import { ISSUED_LETTER_LABELS } from "@/lib/letter-labels";

interface Option {
  id: string;
  name: string;
  studentNumber?: string;
}

export function LetterForm({
  students,
  defaultStudentId,
  defaultType = "TRANSFER",
  types,
}: {
  students: Option[];
  defaultStudentId?: string;
  defaultType?: string;
  types?: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(defaultType);
  const typeOptions = Object.entries(ISSUED_LETTER_LABELS).filter(
    ([value]) => !types || types.includes(value)
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.get("studentId"),
          type,
          title: form.get("title") || undefined,
          destinationSchool: form.get("destinationSchool") || undefined,
          reason: form.get("reason") || undefined,
          bodyText: form.get("bodyText") || undefined,
          effectiveDate: form.get("effectiveDate") || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not generate letter");
      toast.success("Letter generated");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate letter");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate letter or transcript</CardTitle>
        <p className="text-sm text-muted">
          Transfer letters, testimonials, leaving letters, fee clearance and academic transcripts.
          Learners can download them once school fees are paid in full.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Learner *</Label>
            <Select name="studentId" required defaultValue={defaultStudentId ?? ""}>
              <option value="">Select learner...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.studentNumber ? `(${s.studentNumber})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Title</Label>
            <Input name="title" placeholder={ISSUED_LETTER_LABELS[type]} />
          </div>
          {type === "TRANSFER" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Receiving school</Label>
              <Input name="destinationSchool" placeholder="Name of the school they are transferring to" />
            </div>
          ) : null}
          {type === "TRANSFER" || type === "LEAVING" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Reason</Label>
              <Input name="reason" placeholder="Relocation, end of programme, …" />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Effective date</Label>
            <Input name="effectiveDate" type="date" />
          </div>
          {type !== "TRANSCRIPT" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Extra wording (optional)</Label>
              <textarea
                name="bodyText"
                rows={3}
                className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Leave blank to use the standard school letter."
              />
            </div>
          ) : null}
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate PDF"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
