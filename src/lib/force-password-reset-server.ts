import { redirect } from "next/navigation";
import type { SessionPayload } from "./auth";
import { FORCE_PASSWORD_PATH } from "./force-password-reset";

export function enforceForcedPasswordReset(session: SessionPayload) {
  if (session.mustResetPassword) {
    redirect(FORCE_PASSWORD_PATH);
  }
}
