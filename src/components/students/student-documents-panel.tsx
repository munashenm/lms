"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import {
  REGISTRATION_DOC_ACCEPT,
  STUDENT_DOCUMENT_LABELS,
  STUDENT_REGISTRATION_DOC_SLOTS,
} from "@/lib/registration-docs";
import { formatDate } from "@/lib/utils";

export function StudentDocumentsPanel({
  studentId,
  documents,
  canWrite,
}: {
  studentId: string;
  documents: Array<{
    id: string;
    type: string;
    title: string;
    fileUrl: string;
    createdAt: Date | string;
  }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    try {
      const res = await fetch(`/api/students/${studentId}/documents`, {
        method: "POST",
        body: new FormData(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not upload document");
      toast.success("Document uploaded");
      form.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload document");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registration documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {canWrite ? (
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-doc-title">Title</Label>
              <Input id="student-doc-title" name="title" required placeholder="Birth certificate" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-doc-type">Type</Label>
              <Select id="student-doc-type" name="type" defaultValue="BIRTH_CERTIFICATE">
                {STUDENT_REGISTRATION_DOC_SLOTS.map((slot) => (
                  <option key={slot.type} value={slot.type}>
                    {slot.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="student-doc-file">File</Label>
              <Input
                id="student-doc-file"
                name="file"
                type="file"
                required
                accept={REGISTRATION_DOC_ACCEPT}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted">PDF, Word or image. Max 10 MB.</p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload document"}
              </Button>
            </div>
          </form>
        ) : null}
        <ul className="space-y-2 text-sm">
          {documents.length === 0 ? (
            <li className="text-muted">No registration documents yet.</li>
          ) : (
            documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  {doc.title}
                  <span className="text-muted">
                    ({STUDENT_DOCUMENT_LABELS[doc.type] ?? doc.type})
                  </span>
                </a>
                <span className="text-xs text-muted">{formatDate(doc.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
