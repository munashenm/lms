export interface AttendanceOccupancyRow {
  studentId: string;
  name: string;
  status: string;
}

/** Learners whose gate presence and today's attendance do not agree. */
export function attendanceOccupancyGaps(params: {
  onSiteStudentIds: string[];
  attendance: AttendanceOccupancyRow[];
}) {
  const onSite = new Set(params.onSiteStudentIds);
  const presentNotOnSite: AttendanceOccupancyRow[] = [];
  const absentButOnSite: AttendanceOccupancyRow[] = [];
  const seen = new Set<string>();

  for (const row of params.attendance) {
    if (seen.has(row.studentId)) continue;
    seen.add(row.studentId);
    if ((row.status === "PRESENT" || row.status === "LATE") && !onSite.has(row.studentId)) {
      presentNotOnSite.push(row);
    }
    if ((row.status === "ABSENT" || row.status === "SICK") && onSite.has(row.studentId)) {
      absentButOnSite.push(row);
    }
  }

  return { presentNotOnSite, absentButOnSite };
}
