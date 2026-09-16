export const DIRECTORY_GROUPS = ["staff", "students", "parents"] as const;
export type DirectoryGroup = (typeof DIRECTORY_GROUPS)[number];

export const DIRECTORY_GROUP_LABELS: Record<DirectoryGroup, string> = {
  staff: "Staff",
  students: "Students",
  parents: "Parents",
};

export type DirectoryUserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | Date | null;
  schoolName: string | null;
  studentNumber: string | null;
  employeeNumber: string | null;
  linkedStudents: Array<{ name: string; studentNumber: string }>;
};

export function directoryGroupForRole(role: string): DirectoryGroup {
  if (role === "STUDENT") return "students";
  if (role === "PARENT") return "parents";
  return "staff";
}

export function groupDirectoryUsers(users: DirectoryUserRecord[]) {
  const groups: Record<DirectoryGroup, DirectoryUserRecord[]> = {
    staff: [],
    students: [],
    parents: [],
  };
  for (const user of users) {
    groups[directoryGroupForRole(user.role)].push(user);
  }
  return groups;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function compact(value: string): string {
  return normalize(value).replace(/[\s-]/g, "");
}

function matchesText(haystack: string | null | undefined, query: string): boolean {
  if (!haystack) return false;
  const needle = normalize(query);
  const compactNeedle = compact(query);
  return normalize(haystack).includes(needle) || compact(haystack).includes(compactNeedle);
}

export function matchesDirectorySearch(
  user: DirectoryUserRecord,
  query: string,
  group: DirectoryGroup
): boolean {
  const q = query.trim();
  if (!q) return true;

  const fullName = `${user.firstName} ${user.lastName}`;
  if (matchesText(fullName, q) || matchesText(user.firstName, q) || matchesText(user.lastName, q)) {
    return true;
  }

  if (group === "staff") {
    return matchesText(user.employeeNumber, q);
  }

  if (group === "students") {
    return matchesText(user.studentNumber, q);
  }

  return user.linkedStudents.some(
    (student) => matchesText(student.name, q) || matchesText(student.studentNumber, q)
  );
}

export function filterDirectoryUsers(
  users: DirectoryUserRecord[],
  group: DirectoryGroup,
  query: string
): DirectoryUserRecord[] {
  return users.filter(
    (user) => directoryGroupForRole(user.role) === group && matchesDirectorySearch(user, query, group)
  );
}
