import type { CardFact } from "@/lib/pdf-student-card";

type CardStudent = {
  firstName: string;
  lastName: string;
  studentNumber: string;
  photoUrl?: string | null;
  grade?: { name: string } | null;
  class?: { name: string } | null;
} | null;

type CardEmployee = {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  position?: string | null;
  department?: string | null;
} | null;

type CardUser = {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  employee?: { employeeNumber: string; position?: string | null; department?: string | null } | null;
  teacher?: { employeeNumber: string; department?: string | null } | null;
} | null;

export function accessCardCopy(input: {
  student: CardStudent;
  employee: CardEmployee;
  user: CardUser;
  validYear?: string | null;
}): {
  studentName: string;
  studentNumber: string;
  studentNumberLabel: string;
  cardTitle: string;
  photoUrl: string | null;
  facts: CardFact[];
} {
  const student = input.student;
  const employee = input.employee ?? (input.user?.employee
    ? {
        firstName: input.user.firstName,
        lastName: input.user.lastName,
        employeeNumber: input.user.employee.employeeNumber,
        position: input.user.employee.position,
        department: input.user.employee.department,
      }
    : null);
  const user = input.user;

  if (student) {
    const facts: CardFact[] = [{ label: "Learner No", value: student.studentNumber }];
    if (student.grade?.name) facts.push({ label: "Grade", value: student.grade.name });
    if (student.class?.name) facts.push({ label: "Class", value: student.class.name });
    if (input.validYear) facts.push({ label: "Valid", value: input.validYear });
    return {
      studentName: `${student.firstName} ${student.lastName}`,
      studentNumber: student.studentNumber,
      studentNumberLabel: "Learner No",
      cardTitle: "LEARNER IDENTITY CARD",
      photoUrl: student.photoUrl ?? null,
      facts,
    };
  }

  const staffNo = employee?.employeeNumber ?? user?.teacher?.employeeNumber ?? "—";
  const position = employee?.position ?? null;
  const department = employee?.department ?? user?.teacher?.department ?? null;
  const facts: CardFact[] = [];
  if (staffNo !== "—") facts.push({ label: "Staff No", value: staffNo });
  if (position) facts.push({ label: "Position", value: position });
  if (department) facts.push({ label: "Department", value: department });
  if (input.validYear) facts.push({ label: "Valid", value: input.validYear });
  const name = employee
    ? `${employee.firstName} ${employee.lastName}`
    : user
      ? `${user.firstName} ${user.lastName}`
      : "Card holder";
  return {
    studentName: name,
    studentNumber: staffNo,
    studentNumberLabel: "Staff No",
    cardTitle: "STAFF IDENTITY CARD",
    photoUrl: user?.avatarUrl ?? null,
    facts,
  };
}
