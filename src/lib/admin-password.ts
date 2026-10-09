import { UserRole } from "@prisma/client";

export interface PasswordActor {
  role: UserRole;
  schoolId: string | null;
}

export interface PasswordTarget {
  role: UserRole;
  schoolId: string | null;
}

export type PasswordAuthority =
  | { ok: true }
  | { ok: false; message: string };

/** Super Admin can set any password. School Admin can set passwords at their own school. */
export function canSetUserPassword(actor: PasswordActor, target: PasswordTarget): PasswordAuthority {
  if (actor.role === UserRole.SUPER_ADMIN) return { ok: true };

  if (actor.role !== UserRole.SCHOOL_ADMIN) {
    return { ok: false, message: "Only a Super Admin or School Admin can set a user password." };
  }

  if (target.role === UserRole.SUPER_ADMIN) {
    return { ok: false, message: "A School Admin cannot change a Super Admin password." };
  }

  if (!actor.schoolId || actor.schoolId !== target.schoolId) {
    return { ok: false, message: "You can only set passwords for users at your school." };
  }

  return { ok: true };
}
