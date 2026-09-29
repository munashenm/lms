import { prisma } from "./db";

export type SchoolSetupStepId =
  | "school"
  | "academic"
  | "grades_classes"
  | "fees"
  | "people"
  | "applications";

export type SchoolSetupStep = {
  id: SchoolSetupStepId;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export type SchoolSetupProgress = {
  steps: SchoolSetupStep[];
  completed: number;
  total: number;
  percent: number;
  isComplete: boolean;
};

/** Live counts for the “first 10 minutes” school setup checklist. */
export async function getSchoolSetupProgress(schoolId: string): Promise<SchoolSetupProgress> {
  const [
    school,
    yearCount,
    termCount,
    gradeCount,
    classCount,
    feeCount,
    studentCount,
    teacherCount,
  ] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        city: true,
        applicationsOpen: true,
      },
    }),
    prisma.academicYear.count({ where: { schoolId } }),
    prisma.term.count({ where: { academicYear: { schoolId } } }),
    prisma.grade.count({ where: { schoolId, isActive: true } }),
    prisma.class.count({ where: { schoolId, isActive: true } }),
    prisma.feeStructure.count({ where: { schoolId } }),
    prisma.student.count({ where: { schoolId } }),
    prisma.teacher.count({ where: { schoolId } }),
  ]);

  const schoolDetailsDone = Boolean(
    school?.name && (school.address || school.phone || school.email || school.city)
  );

  const steps: SchoolSetupStep[] = [
    {
      id: "school",
      title: "School details",
      description: "Confirm name, contact details and campus basics.",
      href: "/admin/settings",
      done: schoolDetailsDone,
    },
    {
      id: "academic",
      title: "Year and terms",
      description: "Create the current academic year and at least one term.",
      href: "/admin/academic",
      done: yearCount > 0 && termCount > 0,
    },
    {
      id: "grades_classes",
      title: "Grades and classes",
      description: "Add grades and at least one class for learners.",
      href: "/admin/classes",
      done: gradeCount > 0 && classCount > 0,
    },
    {
      id: "fees",
      title: "Fee structure",
      description: "Set up at least one fee structure for billing.",
      href: "/admin/finance/structures",
      done: feeCount > 0,
    },
    {
      id: "people",
      title: "First learner and staff",
      description: "Enrol a learner and add a staff member.",
      href: "/admin/students/new",
      done: studentCount > 0 && teacherCount > 0,
    },
    {
      id: "applications",
      title: "Open applications",
      description: "Turn on online applications when you are ready for intakes.",
      href: "/admin/applications",
      done: Boolean(school?.applicationsOpen) && gradeCount > 0,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  return {
    steps,
    completed,
    total,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
    isComplete: completed === total,
  };
}
