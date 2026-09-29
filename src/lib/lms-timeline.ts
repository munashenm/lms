/** Lightweight LMS student timeline helpers for subject / assignment polish. */

export type LmsTimelineItem = {
  id: string;
  kind: "material" | "assignment" | "assessment" | "exam" | "result";
  title: string;
  status?: string;
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  href?: string;
};

export function sortLmsTimeline(items: LmsTimelineItem[]): LmsTimelineItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.dueAt ? new Date(a.dueAt).getTime() : a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.dueAt ? new Date(b.dueAt).getTime() : b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return aTime - bTime;
  });
}

export function assignmentStatusLabel(input: {
  submitted: boolean;
  graded: boolean;
  late?: boolean;
  dueAt?: Date | string | null;
  now?: Date;
}): "Not submitted" | "Submitted" | "Graded" | "Late" | "Overdue" {
  if (input.graded) return "Graded";
  if (input.submitted && input.late) return "Late";
  if (input.submitted) return "Submitted";
  if (input.dueAt) {
    const due = typeof input.dueAt === "string" ? new Date(input.dueAt) : input.dueAt;
    const now = input.now ?? new Date();
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) return "Overdue";
  }
  return "Not submitted";
}