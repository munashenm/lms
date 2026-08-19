/** Resolve a parent-portal student id against linked children. Never trust an unlinked id. */
export function resolveLinkedStudentId(
  childIds: string[],
  requestedId?: string | null
): string | null {
  if (requestedId) return childIds.includes(requestedId) ? requestedId : null;
  if (childIds.length === 1) return childIds[0];
  return null;
}

export function linkedStudentIdsOrForbidden(
  childIds: string[],
  requestedId?: string | null
): { ok: true; studentIds: string[] } | { ok: false; reason: "forbidden" | "empty" } {
  if (requestedId) {
    if (!childIds.includes(requestedId)) return { ok: false, reason: "forbidden" };
    return { ok: true, studentIds: [requestedId] };
  }
  if (childIds.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, studentIds: childIds };
}
