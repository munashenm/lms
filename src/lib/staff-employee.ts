import type { SessionPayload } from "./auth";
import { prisma } from "./db";

/** Resolve the signed-in staff member's employee row (portal user or linked teacher). */
export async function employeeForSession(session: SessionPayload) {
  return prisma.employee.findFirst({
    where: {
      ...(session.schoolId ? { schoolId: session.schoolId } : {}),
      OR: [{ userId: session.userId }, { teacher: { is: { userId: session.userId } } }],
    },
  });
}
