"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface ClassFilterProps {
  classes: { id: string; name: string }[];
  selectedClassId?: string;
  preserveParams?: string[];
}

export function ClassFilter({ classes, selectedClassId, preserveParams = [] }: ClassFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(classId: string) {
    const params = new URLSearchParams();
    params.set("classId", classId);
    preserveParams.forEach((key) => {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <label className="text-sm font-medium">Filter by class</label>
      <select
        defaultValue={selectedClassId}
        className="mt-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm block min-w-[200px]"
        onChange={(e) => handleChange(e.target.value)}
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
