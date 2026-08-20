import { describe, expect, it } from "vitest";
import { classIdsForTeacher } from "@/lib/portal-data";
import { getTeacherNav } from "@/lib/navigation";

describe("teacher class assignments", () => {
  it("includes homeroom and subject classes without duplicates", () => {
    expect(
      classIdsForTeacher({
        classTeachers: [{ classId: "c1" }, { classId: "c2" }],
        classSubjects: [{ classId: "c2" }, { classId: "c3" }],
      }).sort()
    ).toEqual(["c1", "c2", "c3"]);
  });

  it("returns no classes when the teacher has no assignments", () => {
    expect(classIdsForTeacher(null)).toEqual([]);
    expect(classIdsForTeacher({ classTeachers: [], classSubjects: [] })).toEqual([]);
  });
});

describe("educator portal classroom tools", () => {
  it("keeps attendance, marks, timetable and notices in Teaching", () => {
    const nav = getTeacherNav();
    expect(nav.find((item) => item.href === "/teacher/attendance")?.group).toBe("Classwork");
    expect(nav.find((item) => item.href === "/teacher/assessments")?.group).toBe("Classwork");
    expect(nav.find((item) => item.href === "/teacher/timetable")?.group).toBe("Classwork");
    expect(nav.find((item) => item.href === "/teacher/announcements")?.group).toBe("Campus");
    expect(nav.find((item) => item.href === "/teacher/classes")?.section).toBe("Teaching");
  });
});
