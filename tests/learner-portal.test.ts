import { describe, expect, it } from "vitest";
import {
  assignmentLearnerStatus,
  canLearnerResubmit,
  curriculumProgress,
  documentVisibleToLearner,
  examWindow,
  maskIdentityNumber,
  nextAbsenceStatus,
  absenceRangesOverlap,
  teacherTeachesLearner,
  calendarAssessmentLabel,
} from "@/lib/learner-portal";
import { paymentBelongsToStudent } from "@/lib/refund-payment";
import { filterNavByLicense, navHrefFeature } from "@/lib/licensing/portal";
import { parentNav, studentNav, getStudentNav, getParentNav } from "@/lib/navigation";
import { DEFAULT_LICENSE_FEATURES } from "@/lib/licensing/features";
import { evaluateLicense } from "@/lib/licensing/evaluate";
import { encodeCode39, sanitizeCode39 } from "@/lib/code39";
import { linkedStudentIdsOrForbidden, resolveLinkedStudentId } from "@/lib/parent-scope";
import { homeworkFileExtension, isAllowedHomeworkFile } from "@/lib/homework-upload";
import { getTerminology } from "@/lib/terminology";
import { InstitutionType } from "@prisma/client";

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
    expect(navHrefFeature("/parent/leave")).toBe("student_leave");
    expect(navHrefFeature("/parent/exams")).toBe("assessments");
    expect(navHrefFeature("/parent/downloads")).toBe("download_centre");
    expect(navHrefFeature("/parent/calendar")).toBeNull();
    expect(navHrefFeature("/staff/leave")).toBe("hr_payroll");
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

  it("hides parent leave when the learner-leave licence is off", () => {
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
          student_leave: false,
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
    const nav = filterNavByLicense(parentNav, evaluation);
    expect(nav.some((item) => item.href === "/parent/leave")).toBe(false);
    expect(nav.some((item) => item.href === "/parent/dashboard")).toBe(true);
  });

  it("hides parent examinations and downloads when those licences are off", () => {
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
          assessments: false,
          download_centre: false,
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
    const nav = filterNavByLicense(parentNav, evaluation);
    expect(nav.some((item) => item.href === "/parent/exams")).toBe(false);
    expect(nav.some((item) => item.href === "/parent/downloads")).toBe(false);
    expect(nav.some((item) => item.href === "/parent/calendar")).toBe(true);
    expect(nav.some((item) => item.href === "/parent/dashboard")).toBe(true);
  });
});

describe("parent child scope", () => {
  it("never returns an unlinked child id", () => {
    expect(resolveLinkedStudentId(["a", "b"], "c")).toBeNull();
    expect(resolveLinkedStudentId(["a", "b"], "a")).toBe("a");
    expect(resolveLinkedStudentId(["a"], undefined)).toBe("a");
    expect(resolveLinkedStudentId(["a", "b"], undefined)).toBeNull();
  });

  it("rejects a requested id that is not in the linked set", () => {
    expect(linkedStudentIdsOrForbidden(["a", "b"], "z")).toEqual({ ok: false, reason: "forbidden" });
    expect(linkedStudentIdsOrForbidden(["a", "b"], "b")).toEqual({ ok: true, studentIds: ["b"] });
    expect(linkedStudentIdsOrForbidden(["a", "b"])).toEqual({ ok: true, studentIds: ["a", "b"] });
  });
});

describe("Code 39 learner barcode", () => {
  it("wraps values with start/stop and a predictable unit width", () => {
    expect(sanitizeCode39("st-01/a")).toBe("ST-01/A");
    const { bits, display } = encodeCode39("A");
    expect(display).toBe("A");
    // * A * = 3 symbols × 15 units + 2 inter-character gaps
    expect(bits.length).toBe(47);
    expect(bits.startsWith("1")).toBe(true);
    expect(bits.endsWith("1")).toBe(true);
  });

  it("replaces characters that Code 39 cannot encode", () => {
    expect(sanitizeCode39("id#99")).toBe("ID-99");
  });
});

describe("leave overlap and homework files", () => {
  it("detects overlapping absence ranges", () => {
    expect(
      absenceRangesOverlap(
        new Date("2026-08-10"),
        new Date("2026-08-12"),
        new Date("2026-08-12"),
        new Date("2026-08-14")
      )
    ).toBe(true);
    expect(
      absenceRangesOverlap(
        new Date("2026-08-10"),
        new Date("2026-08-11"),
        new Date("2026-08-12"),
        new Date("2026-08-14")
      )
    ).toBe(false);
  });

  it("accepts common homework file extensions", () => {
    expect(homeworkFileExtension("essay.PDF")).toBe(".pdf");
    expect(homeworkFileExtension("notes.docx")).toBe(".docx");
    expect(isAllowedHomeworkFile(new File(["x"], "note.pdf", { type: "application/pdf" }))).toBe(true);
    expect(isAllowedHomeworkFile(new File(["x"], "note.exe", { type: "application/octet-stream" }))).toBe(false);
  });
});

describe("South African terminology", () => {
  it("uses learner, educator and admission number for schools", () => {
    const terms = getTerminology(InstitutionType.HIGH_SCHOOL);
    expect(terms.student).toBe("Learner");
    expect(terms.students).toBe("Learners");
    expect(terms.teacher).toBe("Educator");
    expect(terms.period).toBe("Term");
    expect(terms.admissionNumber).toBe("Admission No");
    expect(terms.homework).toBe("Homework");
    expect(terms.fees).toBe("School Fees");
    expect(terms.identityCard).toBe("Learner Card");
  });

  it("uses student and lecturer labels for TVET and colleges", () => {
    const terms = getTerminology(InstitutionType.TVET);
    expect(terms.student).toBe("Student");
    expect(terms.teacher).toBe("Lecturer");
    expect(terms.period).toBe("Semester");
    expect(terms.homework).toBe("Assignments");
    expect(terms.admissionNumber).toBe("Student No");
  });

  it("labels learner nav with school terms by default", () => {
    const nav = getStudentNav();
    expect(nav.some((item) => item.label === "Homework")).toBe(true);
    expect(nav.some((item) => item.label === "Educator Reviews")).toBe(true);
    expect(nav.some((item) => item.label === "School Fees")).toBe(true);
    expect(nav.some((item) => item.section === "Learner Services")).toBe(true);
  });

  it("labels parent nav with examinations, downloads and notice board", () => {
    const nav = getParentNav();
    expect(nav.some((item) => item.href === "/parent/exams" && item.label === "Examinations")).toBe(true);
    expect(nav.some((item) => item.href === "/parent/downloads" && item.label === "Download Centre")).toBe(true);
    expect(nav.some((item) => item.href === "/parent/calendar" && item.label === "Academic Calendar")).toBe(true);
    expect(nav.some((item) => item.href === "/parent/announcements" && item.label === "Notice Board")).toBe(true);
  });

  it("uses homework wording on calendar assessment labels", () => {
    expect(calendarAssessmentLabel({ type: "EXAM", title: "Paper 1", homeworkLabel: "Homework" })).toBe(
      "Exam: Paper 1"
    );
    expect(
      calendarAssessmentLabel({ type: "ASSIGNMENT", title: "Essay", homeworkLabel: "Homework" })
    ).toBe("Homework: Essay");
  });
});
