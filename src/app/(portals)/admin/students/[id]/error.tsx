"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function StudentProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg space-y-3">
      <h1 className="text-2xl font-bold">This learner profile could not be loaded</h1>
      <p className="text-sm text-muted">
        The page hit an error while opening this record. Try again, or go back to the learners list.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/students">Back to learners</Link>
        </Button>
      </div>
    </div>
  );
}
