import { UserRole } from "@prisma/client";

export const TEACHER_ANNOUNCEMENT_AUDIENCES = ["STUDENTS", "PARENTS", "TEACHERS", "STAFF"] as const;

export type TeacherAnnouncementAudience = (typeof TEACHER_ANNOUNCEMENT_AUDIENCES)[number];

export function canPublishAnnouncementAudience(role: UserRole, audience: string): boolean {
  if (role !== UserRole.TEACHER) return true;
  return (TEACHER_ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(audience);
}
