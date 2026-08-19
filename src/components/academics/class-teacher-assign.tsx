"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function ClassTeacherAssign({
  classId,
  teachers,
  currentTeacherId,
}: {
  classId: string;
  teachers: TeacherOption[];
  currentTeacherId: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onChange(teacherId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message ?? "Could not assign teacher");
        return;
      }
      toast.success(teacherId ? "Class teacher assigned" : "Class teacher cleared");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select
      value={currentTeacherId ?? ""}
      disabled={saving}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Class teacher"
    >
      <option value="">Unassigned</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.firstName} {t.lastName}
        </option>
      ))}
    </Select>
  );
}
