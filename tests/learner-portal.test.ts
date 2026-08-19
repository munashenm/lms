import { describe, expect, it } from "vitest";
import {
  assignmentLearnerStatus,
  canLearnerResubmit,
  curriculumProgress,
  documentVisibleToLearner,
  examWindow,
  maskIdentityNumber,
  nextAbsenceStatus,
  teacherTeachesLearner,
} from "@/lib/learner-portal";
import { paymentBelongsToStudent } from "@/lib/refund-payment";
import { filterNavByLicense, navHrefFeature } from "@/lib/licensing/portal";
import { studentNav } from "@/lib/navigation";
import { DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";
import { evaluateLicense } from "@/lib/licensing/evaluate";

describe("assignment learner status", () => {
  const due = new Date("2026-08-10T12:00:00Z");

  it("marks overdue work that was never submitted", () => {
    expect(
      assignmentLearnerStatus({
        submitted: false,
        dueDate: due,
        now: new Date("2026-08-11T12:00:00Z"),
      })
    ).toBe("OVERDUE");
  });

  it("keeps late submissions distinct from on-time ones", () => {
    expect(
      assignmentLearnerStatus({
        submitted: true,
        submittedAt: new Date("2026-08-11T12:00:00Z"),
        dueDate: due,
        now: new Date("2026-08-12T12:00:00Z"),
      })
    ).toBe("LATE");
  });

  it("blocks edits after the deadline unless late work is allowed", () => {
    expect(canLearnerResubmit({ dueDate: due, allowLate: false, now: new Date("2026-08-11T12:00:00Z") })).toBe(false);
    expect(canLearnerResubmit({ dueDate: due, allowLate: true, now: new Date("2026-08-11T12:00:00Z") })).toBe(true);
  });
});

describe("teacher reviews", () => {
  it("only allows reviews of teachers assigned to the learner class", () => {
    expect(
      teacherTeachesLearner({
        learnerClassId: "c1",
        teacherId: "t1",
        classTeachers: [{ classId: "c1", teacherId: "t1" }],
        classSubjects: [],
      })
    ).toBe(true);
    expect(
      teacherTeachesLearner({
        learnerClassId: "c1",
        teacherId: "t2",
        classTeachers: [{ classId: "c1", teacherId: "t1" }],
        classSubjects: [{ classId: "c1", teacherId: "t9" }],
      })
    ).toBe(false);
  });
});

describe("learner documents", () => {
  const learner = {
    id: "s1",
    gradeId: "g10",
    classId: "c1",
    campusId: "camp1",
    courseIds: ["course-a"],
  };

  it("hides files that are not released to learners", () => {
    expect(documentVisibleToLearner({ isPublic: false, learnerVisible: false }, learner)).toBe(false);
  });

  it("scopes targeted files to the matching class", () => {
    expect(
      documentVisibleToLearner(
        { isPublic: true, targetClassId: "c1" },
        learner
      )
    ).toBe(true);
    expect(
      documentVisibleToLearner(
        { isPublic: true, targetClassId: "c2" },
        learner
      )
    ).toBe(false);
  });
});

describe("absence workflow", () => {
  it("only transitions pending requests", () => {
    expect(nextAbsenceStatus("PENDING", "approve")).toBe("APPROVED");
    expect(nextAbsenceStatus("APPROVED", "reject")).toBeNull();
  });
});

describe("exams and curriculum", () => {
  it("does not treat future exams as available", () => {
    expect(
      examWindow({
        availableFrom: new Date("2026-09-01T08:00:00Z"),
        dueDate: new Date("2026-09-01T10:00:00Z"),
        completed: false,
        now: new Date("2026-08-19T08:00:00Z"),
      })
    ).toBe("UPCOMING");
  });

  it("computes topic completion", () => {
    expect(
      curriculumProgress([{ status: "COMPLETED" }, { status: "COMPLETED" }, { status: "PLANNED" }])
    ).toEqual({ completed: 2, current: 0, upcoming: 1, total: 3, percentage: 67 });
  });
});

describe("refunds", () => {
  it("rejects a payment that belongs to another learner", () => {
    expect(
      paymentBelongsToStudent({
        payment: {
          reversedAt: null,
          invoice: { studentId: "s2", schoolId: "sch" },
        },
        studentId: "s1",
        schoolId: "sch",
      })
    ).toBe(false);
  });
});

describe("identity masking", () => {
  it("does not return a full SA ID", () => {
    expect(maskIdentityNumber("8001015009087")).toBe("8001••••87");
  });
});

describe("learner licence mapping", () => {
  it("maps learner modules to licence features", () => {
    expect(navHrefFeature("/student/fees")).toBe("finance");
    expect(navHrefFeature("/student/exams")).toBe("assessments");
    expect(navHrefFeature("/student/reviews")).toBe("teacher_reviews");
    expect(navHrefFeature("/student/downloads")).toBe("download_centre");
    expect(navHrefFeature("/student/leave")).toBe("student_leave");
    expect(navHrefFeature("/student/dashboard")).toBeNull();
  });

  it("hides unlicensed learner modules", () => {
    const evaluation = evaluateLicense({
      now: new Date("2026-06-15T00:00:00Z"),
      claims: {
        iss: "test",
        sub: "sch",
        product: "lms",
        licenseKey: "k",
        issuedAt: "2026-01-01T00:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        gracePeriodDays: 14,
        status: "ACTIVE",
        features: {
          ...DEFAULT_LICENSE_FEATURES,
          finance: false,
          teacher_reviews: false,
          visitor_management: false,
          messaging: false,
        },
        limits: {
          maxLearners: null,
          maxEducators: null,
          maxAdministrators: null,
          maxCampuses: null,
          storageLimitBytes: null,
        },
      },
      signatureValid: true,
      lastVerifiedAt: new Date(),
      storedStatus: "ACTIVE",
      offlineGraceDays: 14,
    });
    const nav = filterNavByLicense(studentNav, evaluation);
    expect(nav.some((item) => item.href === "/student/fees")).toBe(false);
    expect(nav.some((item) => item.href === "/student/reviews")).toBe(false);
    expect(nav.some((item) => item.href === "/student/dashboard")).toBe(true);
    expect(nav.some((item) => item.href === "/student/profile")).toBe(true);
    expect(nav.some((item) => item.href.includes("visitor"))).toBe(false);
    expect(nav.some((item) => item.href.includes("messages"))).toBe(false);
  });
});
