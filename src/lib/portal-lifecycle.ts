export function learnerPortalShouldBeActive(status: string): boolean {
  return status === "ACTIVE";
}

export function staffPortalShouldBeActive(status: string): boolean {
  return status !== "TERMINATED";
}

export function nextSelfAttendanceAction(record: {
  checkIn?: string | null;
  checkOut?: string | null;
} | null): "checkin" | "checkout" | "done" {
  if (!record?.checkIn) return "checkin";
  if (!record.checkOut) return "checkout";
  return "done";
}
