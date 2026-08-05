import {
  AcademicPeriodStructure,
  InstitutionType,
  type School,
} from "@prisma/client";

export type Terminology = {
  student: string;
  students: string;
  grade: string;
  grades: string;
  classLabel: string;
  classes: string;
  subject: string;
  subjects: string;
  teacher: string;
  teachers: string;
  period: string;
  periods: string;
  guardian: string;
  guardians: string;
  academicSession: string;
  programme: string;
  programmes: string;
  module: string;
  modules: string;
};

const SCHOOL_TERMS: Terminology = {
  student: "Learner",
  students: "Learners",
  grade: "Grade",
  grades: "Grades",
  classLabel: "Class",
  classes: "Classes",
  subject: "Subject",
  subjects: "Subjects",
  teacher: "Class Teacher",
  teachers: "Teachers",
  period: "Term",
  periods: "Terms",
  guardian: "Parent / Guardian",
  guardians: "Parents / Guardians",
  academicSession: "Academic Session",
  programme: "Programme",
  programmes: "Programmes",
  module: "Module",
  modules: "Modules",
};

const COLLEGE_TERMS: Terminology = {
  student: "Student",
  students: "Students",
  grade: "Year of Study",
  grades: "Years of Study",
  classLabel: "Group",
  classes: "Groups",
  subject: "Module",
  subjects: "Modules",
  teacher: "Lecturer",
  teachers: "Lecturers",
  period: "Semester",
  periods: "Semesters",
  guardian: "Sponsor",
  guardians: "Sponsors",
  academicSession: "Academic Session",
  programme: "Programme",
  programmes: "Programmes",
  module: "Module",
  modules: "Modules",
};

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  SCHOOL: "School (legacy)",
  PRIMARY_SCHOOL: "Primary School",
  HIGH_SCHOOL: "High School / Secondary School",
  COMBINED_SCHOOL: "Combined School",
  COLLEGE: "College",
  TVET: "TVET College",
  TRAINING_CENTRE: "Training Centre (legacy)",
  TRAINING_INSTITUTION: "Training Institution",
};

export const INSTITUTION_TYPE_OPTIONS: InstitutionType[] = [
  InstitutionType.PRIMARY_SCHOOL,
  InstitutionType.HIGH_SCHOOL,
  InstitutionType.COMBINED_SCHOOL,
  InstitutionType.COLLEGE,
  InstitutionType.TRAINING_INSTITUTION,
];

export const PERIOD_STRUCTURE_LABELS: Record<AcademicPeriodStructure, string> = {
  TERMS_4: "4 Terms (schools)",
  SEMESTERS_2: "2 Semesters (colleges)",
  CUSTOM: "Custom periods",
};

export const CURRICULUM_TYPE_LABELS: Record<string, string> = {
  CAPS: "CAPS",
  NSC: "NSC",
  TVET_NQF: "TVET / NQF",
  CUSTOM: "Custom",
};

export function isCollegeLike(type: InstitutionType): boolean {
  return (
    type === InstitutionType.COLLEGE ||
    type === InstitutionType.TVET ||
    type === InstitutionType.TRAINING_CENTRE ||
    type === InstitutionType.TRAINING_INSTITUTION
  );
}

export function getTerminology(type: InstitutionType): Terminology {
  return isCollegeLike(type) ? COLLEGE_TERMS : SCHOOL_TERMS;
}

export function getTerminologyForSchool(
  school: Pick<School, "institutionType">
): Terminology {
  return getTerminology(school.institutionType);
}

export function defaultPeriodStructure(
  type: InstitutionType
): AcademicPeriodStructure {
  return isCollegeLike(type)
    ? AcademicPeriodStructure.SEMESTERS_2
    : AcademicPeriodStructure.TERMS_4;
}

export function defaultPeriodNames(
  structure: AcademicPeriodStructure
): { name: string; termNumber: number }[] {
  if (structure === AcademicPeriodStructure.SEMESTERS_2) {
    return [
      { name: "Semester 1", termNumber: 1 },
      { name: "Semester 2", termNumber: 2 },
    ];
  }
  return [
    { name: "Term 1", termNumber: 1 },
    { name: "Term 2", termNumber: 2 },
    { name: "Term 3", termNumber: 3 },
    { name: "Term 4", termNumber: 4 },
  ];
}
