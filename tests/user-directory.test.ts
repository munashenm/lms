import { describe, expect, it } from "vitest";
import {
  directoryGroupForRole,
  filterDirectoryUsers,
  groupDirectoryUsers,
  matchesDirectorySearch,
  type DirectoryUserRecord,
} from "@/lib/user-directory";

function user(partial: Partial<DirectoryUserRecord> & Pick<DirectoryUserRecord, "id" | "role">): DirectoryUserRecord {
  return {
    email: `${partial.id}@college.co.za`,
    firstName: "Test",
    lastName: "User",
    isActive: true,
    lastLoginAt: null,
    schoolName: "College",
    studentNumber: null,
    employeeNumber: null,
    linkedStudents: [],
    ...partial,
  };
}

describe("user directory groups", () => {
  it("separates staff, students and parents", () => {
    expect(directoryGroupForRole("TEACHER")).toBe("staff");
    expect(directoryGroupForRole("SCHOOL_ADMIN")).toBe("staff");
    expect(directoryGroupForRole("FINANCE_OFFICER")).toBe("staff");
    expect(directoryGroupForRole("STUDENT")).toBe("students");
    expect(directoryGroupForRole("PARENT")).toBe("parents");

    const grouped = groupDirectoryUsers([
      user({ id: "1", role: "TEACHER", firstName: "Sarah", lastName: "Ndlovu" }),
      user({ id: "2", role: "STUDENT", firstName: "Thabo", lastName: "Mahlangu" }),
      user({ id: "3", role: "PARENT", firstName: "Grace", lastName: "Mahlangu" }),
      user({ id: "4", role: "PRINCIPAL", firstName: "John", lastName: "Mokoena" }),
    ]);
    expect(grouped.staff.map((row) => row.id)).toEqual(["1", "4"]);
    expect(grouped.students.map((row) => row.id)).toEqual(["2"]);
    expect(grouped.parents.map((row) => row.id)).toEqual(["3"]);
  });

  it("searches students by name or student ID", () => {
    const thabo = user({
      id: "s1",
      role: "STUDENT",
      firstName: "Thabo",
      lastName: "Mahlangu",
      studentNumber: "STU-1042",
    });
    expect(matchesDirectorySearch(thabo, "thabo", "students")).toBe(true);
    expect(matchesDirectorySearch(thabo, "1042", "students")).toBe(true);
    expect(matchesDirectorySearch(thabo, "stu1042", "students")).toBe(true);
    expect(matchesDirectorySearch(thabo, "sarah", "students")).toBe(false);
  });

  it("searches staff by name or employee ID", () => {
    const sarah = user({
      id: "t1",
      role: "TEACHER",
      firstName: "Sarah",
      lastName: "Ndlovu",
      employeeNumber: "EMP-88",
    });
    expect(matchesDirectorySearch(sarah, "ndlovu", "staff")).toBe(true);
    expect(matchesDirectorySearch(sarah, "emp-88", "staff")).toBe(true);
    expect(matchesDirectorySearch(sarah, "EMP88", "staff")).toBe(true);
    expect(matchesDirectorySearch(sarah, "STU-1042", "staff")).toBe(false);
  });

  it("searches parents by name or linked student ID", () => {
    const grace = user({
      id: "p1",
      role: "PARENT",
      firstName: "Grace",
      lastName: "Mahlangu",
      linkedStudents: [{ name: "Thabo Mahlangu", studentNumber: "STU-1042" }],
    });
    expect(matchesDirectorySearch(grace, "grace", "parents")).toBe(true);
    expect(matchesDirectorySearch(grace, "STU-1042", "parents")).toBe(true);
    expect(matchesDirectorySearch(grace, "emp-88", "parents")).toBe(false);
  });

  it("filters only the active group", () => {
    const users = [
      user({ id: "1", role: "TEACHER", firstName: "Sarah", lastName: "Ndlovu", employeeNumber: "EMP-1" }),
      user({ id: "2", role: "STUDENT", firstName: "Sarah", lastName: "Mokoena", studentNumber: "STU-9" }),
    ];
    expect(filterDirectoryUsers(users, "staff", "sarah").map((row) => row.id)).toEqual(["1"]);
    expect(filterDirectoryUsers(users, "students", "sarah").map((row) => row.id)).toEqual(["2"]);
  });
});
