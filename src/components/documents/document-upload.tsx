"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload } from "lucide-react";

export function DocumentUpload() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/documents", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      toast.success("Document uploaded");
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" /> Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input name="title" required placeholder="Chapter 1 Notes" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input name="description" placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select name="type" defaultValue="LEARNING_MATERIAL">
                <option value="LEARNING_MATERIAL">Learning Material</option>
                <option value="ASSIGNMENT">Assignment</option>
                <option value="REPORT_CARD">Report Card</option>
                <option value="CERTIFICATE">Certificate</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="isPublic" value="true" defaultChecked className="h-4 w-4 rounded" />
                Visible to students
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>File *</Label>
            <Input name="file" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip" />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
