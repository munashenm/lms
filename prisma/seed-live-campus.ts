import "dotenv/config";
import {
  PrismaClient,
  UserRole,
  EmployeeCategory,
  DayOfWeek,
  AssessmentType,
  AttendanceStatus,
  StaffAttendanceStatus,
  InvoiceStatus,
  PaymentMethod,
  VisitorIdentityType,
  VisitorHostKind,
  VisitorPurpose,
  VisitorStatus,
  AssignmentSubmissionStatus,
  CertificateType,
  IssuedLetterType,
  LeaveType,
  LeaveStatus,
  StudentAbsenceType,
  StudentLedgerType,
  CurriculumTopicStatus,
  Gender,
  PayrollRunStatus,
  type Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Campus@2026";
const MARKER = "STU-LIVE-001";

const LEARNERS: Array<{
  number: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  language: string;
  suburb: string;
  city: string;
  guardianFirst: string;
  guardianLast: string;
  relationship: string;
  phone: string;
  portal?: boolean;
}> = [
  { number: "STU-LIVE-001", firstName: "Karabo", lastName: "Mokoena", gender: Gender.MALE, language: "Sesotho", suburb: "Orlando East", city: "Soweto", guardianFirst: "Dineo", guardianLast: "Mokoena", relationship: "Mother", phone: "071 482 1190", portal: true },
  { number: "STU-LIVE-002", firstName: "Anele", lastName: "Dlamini", gender: Gender.FEMALE, language: "isiZulu", suburb: "Alexandra", city: "Johannesburg", guardianFirst: "Thuli", guardianLast: "Dlamini", relationship: "Mother", phone: "082 661 3044", portal: true },
  { number: "STU-LIVE-003", firstName: "Pieter", lastName: "van der Merwe", gender: Gender.MALE, language: "Afrikaans", suburb: "Randburg", city: "Johannesburg", guardianFirst: "Elsa", guardianLast: "van der Merwe", relationship: "Mother", phone: "083 220 9188" },
  { number: "STU-LIVE-004", firstName: "Naledi", lastName: "Khumalo", gender: Gender.FEMALE, language: "isiZulu", suburb: "Tembisa", city: "Kempton Park", guardianFirst: "Sipho", guardianLast: "Khumalo", relationship: "Father", phone: "072 553 4410", portal: true },
  { number: "STU-LIVE-005", firstName: "Yusuf", lastName: "Essop", gender: Gender.MALE, language: "English", suburb: "Lenasia", city: "Johannesburg", guardianFirst: "Fatima", guardianLast: "Essop", relationship: "Mother", phone: "084 119 6621" },
  { number: "STU-LIVE-006", firstName: "Boitumelo", lastName: "Modise", gender: Gender.FEMALE, language: "Setswana", suburb: "Mabopane", city: "Pretoria", guardianFirst: "Kagiso", guardianLast: "Modise", relationship: "Father", phone: "073 880 2254" },
  { number: "STU-LIVE-007", firstName: "Liyema", lastName: "Mbewu", gender: Gender.MALE, language: "isiXhosa", suburb: "Midrand", city: "Johannesburg", guardianFirst: "Nomonde", guardianLast: "Mbewu", relationship: "Mother", phone: "081 334 7702" },
  { number: "STU-LIVE-008", firstName: "Anke", lastName: "Botha", gender: Gender.FEMALE, language: "Afrikaans", suburb: "Centurion", city: "Pretoria", guardianFirst: "Hennie", guardianLast: "Botha", relationship: "Father", phone: "082 447 1093" },
  { number: "STU-LIVE-009", firstName: "Refiloe", lastName: "Tau", gender: Gender.FEMALE, language: "Sesotho", suburb: "Vereeniging", city: "Vereeniging", guardianFirst: "Mpho", guardianLast: "Tau", relationship: "Aunt", phone: "071 902 3381" },
  { number: "STU-LIVE-010", firstName: "Siyabonga", lastName: "Ngcobo", gender: Gender.MALE, language: "isiZulu", suburb: "Springs", city: "Springs", guardianFirst: "Zanele", guardianLast: "Ngcobo", relationship: "Mother", phone: "076 221 8450" },
  { number: "STU-LIVE-011", firstName: "Mia", lastName: "Jacobs", gender: Gender.FEMALE, language: "English", suburb: "Benoni", city: "Benoni", guardianFirst: "Charlene", guardianLast: "Jacobs", relationship: "Mother", phone: "083 556 2017" },
  { number: "STU-LIVE-012", firstName: "Tshepo", lastName: "Mahlangu", gender: Gender.MALE, language: "isiNdebele", suburb: "Soshanguve", city: "Pretoria", guardianFirst: "Busisiwe", guardianLast: "Mahlangu", relationship: "Mother", phone: "072 118 6649" },
  { number: "STU-LIVE-013", firstName: "Amina", lastName: "Patel", gender: Gender.FEMALE, language: "English", suburb: "Fordsburg", city: "Johannesburg", guardianFirst: "Rashid", guardianLast: "Patel", relationship: "Father", phone: "084 773 2208" },
  { number: "STU-LIVE-014", firstName: "Lwazi", lastName: "Cele", gender: Gender.MALE, language: "isiZulu", suburb: "Daveyton", city: "Benoni", guardianFirst: "Ntombi", guardianLast: "Cele", relationship: "Mother", phone: "071 640 8823" },
  { number: "STU-LIVE-015", firstName: "Henk", lastName: "Venter", gender: Gender.MALE, language: "Afrikaans", suburb: "Krugersdorp", city: "Krugersdorp", guardianFirst: "Marlize", guardianLast: "Venter", relationship: "Mother", phone: "082 309 5512" },
  { number: "STU-LIVE-016", firstName: "Palesa", lastName: "Molefe", gender: Gender.FEMALE, language: "Sesotho", suburb: "Katlehong", city: "Germiston", guardianFirst: "Thabo", guardianLast: "Molefe", relationship: "Father", phone: "073 441 9086", portal: true },
];

function day(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function main() {
  const school =
    (await prisma.school.findFirst({ where: { slug: "cyber-college", isActive: true } })) ??
    (await prisma.school.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
  if (!school) {
    throw new Error("No school found. Sign in and create the institution, or run npm run db:seed first.");
  }

  const already = await prisma.student.findFirst({
    where: { schoolId: school.id, studentNumber: MARKER },
  });
  if (already) {
    console.log(`Live campus data is already loaded for ${school.name}.`);
    return;
  }

  console.log(`Loading a live campus into ${school.name}...`);
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const domain = school.email?.split("@")[1] || "college.co.za";

  const campus =
    (await prisma.campus.findFirst({ where: { schoolId: school.id }, orderBy: { isMain: "desc" } })) ??
    (await prisma.campus.create({
      data: {
        schoolId: school.id,
        name: "Main Campus",
        code: "MAIN",
        address: school.address,
        city: school.city,
        province: school.province,
        isMain: true,
      },
    }));

  const academicYear =
    (await prisma.academicYear.findFirst({
      where: { schoolId: school.id, isCurrent: true },
    })) ??
    (await prisma.academicYear.findFirst({
      where: { schoolId: school.id },
      orderBy: { startDate: "desc" },
    }));
  if (!academicYear) throw new Error("The school has no academic year yet.");

  const term =
    (await prisma.term.findFirst({ where: { academicYearId: academicYear.id, isCurrent: true } })) ??
    (await prisma.term.findFirst({
      where: { academicYearId: academicYear.id },
      orderBy: { termNumber: "desc" },
    }));

  const grade =
    (await prisma.grade.findFirst({ where: { schoolId: school.id }, orderBy: { sortOrder: "desc" } })) ??
    (await prisma.grade.create({
      data: { schoolId: school.id, name: "NQF Level 4", level: 4, sortOrder: 4 },
    }));

  const course = await prisma.course.findFirst({
    where: { schoolId: school.id },
    orderBy: { createdAt: "asc" },
  });

  let classes = await prisma.class.findMany({
    where: { schoolId: school.id, academicYearId: academicYear.id },
    orderBy: { name: "asc" },
  });
  if (classes.length === 0) {
    classes = [
      await prisma.class.create({
        data: {
          schoolId: school.id,
          campusId: campus.id,
          gradeId: grade.id,
          academicYearId: academicYear.id,
          name: "IT-4A",
          capacity: 30,
          room: "Lab 101",
        },
      }),
    ];
  }

  const schoolId = school.id;
  const gradeId = grade.id;
  async function ensureSubject(code: string, name: string) {
    return (
      (await prisma.subject.findFirst({ where: { schoolId, code } })) ??
      prisma.subject.create({
        data: { schoolId, gradeId, code, name, credits: 10 },
      })
    );
  }

  const maths = await ensureSubject("MATH", "Mathematics");
  const english = await ensureSubject("ENG", "English Communication");
  const programming = await ensureSubject("IT-PRG", "Programming");
  const accounting = await ensureSubject("ACC", "Accounting");
  const subjects = [maths, english, programming, accounting];

  const actor =
    (await prisma.user.findFirst({
      where: { schoolId: school.id, role: { in: [UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL] }, isActive: true },
    })) ??
    (await prisma.user.findFirst({ where: { schoolId: school.id, isActive: true } }));
  if (!actor) throw new Error("The school has no staff user to record visitors and finance.");

  const staffPlan = [
    { key: "ayesha.patel", firstName: "Ayesha", lastName: "Patel", emp: "EMP-LIVE-01", dept: "Mathematics", qual: "BEd Mathematics, University of Johannesburg", position: "Mathematics lecturer", role: UserRole.TEACHER, category: EmployeeCategory.EDUCATOR, salary: 31200 },
    { key: "johan.pretorius", firstName: "Johan", lastName: "Pretorius", emp: "EMP-LIVE-02", dept: "Languages", qual: "BA Languages, University of Pretoria", position: "English lecturer", role: UserRole.TEACHER, category: EmployeeCategory.EDUCATOR, salary: 29800 },
    { key: "naledi.maseko", firstName: "Naledi", lastName: "Maseko", emp: "EMP-LIVE-03", dept: "Student Support", qual: "BEd Life Orientation, Wits", position: "Student support lecturer", role: UserRole.TEACHER, category: EmployeeCategory.EDUCATOR, salary: 28600 },
    { key: "themba.dube", firstName: "Themba", lastName: "Dube", emp: "EMP-LIVE-04", dept: "Business", qual: "BCom Accounting, UNISA", position: "Accounting lecturer", role: UserRole.TEACHER, category: EmployeeCategory.EDUCATOR, salary: 33400 },
    { key: "bongani.radebe", firstName: "Bongani", lastName: "Radebe", emp: "EMP-LIVE-05", dept: "Campus Security", qual: "PSIRA Grade B", position: "Security officer", role: UserRole.STAFF, category: EmployeeCategory.SECURITY, salary: 9800 },
    { key: "charlene.jacobs", firstName: "Charlene", lastName: "Jacobs", emp: "EMP-LIVE-06", dept: "Reception", qual: "Office administration", position: "Receptionist", role: UserRole.STAFF, category: EmployeeCategory.ADMINISTRATION, salary: 14500 },
  ];

  const staffRecords: Array<{ userId: string; teacherId?: string; employeeId: string; firstName: string; lastName: string; salary: number }> = [];
  for (const person of staffPlan) {
    const email = `${person.key}@${domain}`;
    const user =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({
        data: {
          schoolId: school.id,
          campusId: campus.id,
          email,
          passwordHash,
          firstName: person.firstName,
          lastName: person.lastName,
          phone: "010 020 0300",
          role: person.role,
        },
      }));
    let teacherId: string | undefined;
    if (person.role === UserRole.TEACHER) {
      const teacher =
        (await prisma.teacher.findFirst({ where: { schoolId: school.id, employeeNumber: person.emp } })) ??
        (await prisma.teacher.create({
          data: {
            schoolId: school.id,
            userId: user.id,
            campusId: campus.id,
            employeeNumber: person.emp,
            firstName: person.firstName,
            lastName: person.lastName,
            email,
            qualification: person.qual,
            department: person.dept,
            hiredAt: new Date("2024-01-15"),
          },
        }));
      teacherId = teacher.id;
    }
    const employee =
      (await prisma.employee.findFirst({ where: { schoolId: school.id, employeeNumber: person.emp } })) ??
      (await prisma.employee.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          teacherId,
          campusId: campus.id,
          employeeNumber: person.emp,
          firstName: person.firstName,
          lastName: person.lastName,
          email,
          category: person.category,
          department: person.dept,
          position: person.position,
          startDate: new Date("2024-01-15"),
          bankName: "First National Bank",
          bankAccountLast4: "4421",
          branchCode: "250655",
        },
      }));
    const salary = await prisma.salaryStructure.findFirst({ where: { employeeId: employee.id } });
    if (!salary) {
      await prisma.salaryStructure.create({
        data: {
          employeeId: employee.id,
          effectiveFrom: new Date("2026-01-01"),
          baseSalary: person.salary,
          allowancesJson: person.role === UserRole.TEACHER ? [{ name: "Housing allowance", amount: 1800 }] : [],
          deductionsJson: [],
        },
      });
    }
    staffRecords.push({ userId: user.id, teacherId, employeeId: employee.id, firstName: person.firstName, lastName: person.lastName, salary: person.salary });
  }

  const lecturers = staffRecords.filter((s) => s.teacherId);
  const primaryTeacherId = lecturers[0]?.teacherId ?? (await prisma.teacher.findFirst({ where: { schoolId: school.id } }))?.id;
  if (!primaryTeacherId) throw new Error("No lecturer is available for the timetable.");

  for (const [index, cls] of classes.entries()) {
    const teacherId = lecturers[index % Math.max(lecturers.length, 1)]?.teacherId ?? primaryTeacherId;
    const linked = await prisma.classTeacher.findFirst({ where: { classId: cls.id, teacherId } });
    if (!linked) {
      await prisma.classTeacher.create({ data: { classId: cls.id, teacherId, isPrimary: index === 0 } });
    }
    for (const subject of subjects) {
      const row = await prisma.classSubject.findFirst({ where: { classId: cls.id, subjectId: subject.id } });
      if (!row) {
        await prisma.classSubject.create({ data: { classId: cls.id, subjectId: subject.id, teacherId } });
      }
    }
  }

  const week: Array<{ day: DayOfWeek; start: string; end: string; subjectId: string; room: string }> = [
    { day: DayOfWeek.MONDAY, start: "08:00", end: "09:30", subjectId: programming.id, room: "Lab 101" },
    { day: DayOfWeek.MONDAY, start: "10:00", end: "11:30", subjectId: maths.id, room: "Room 201" },
    { day: DayOfWeek.TUESDAY, start: "08:00", end: "09:30", subjectId: english.id, room: "Room 201" },
    { day: DayOfWeek.TUESDAY, start: "12:00", end: "13:30", subjectId: accounting.id, room: "Room 104" },
    { day: DayOfWeek.WEDNESDAY, start: "08:00", end: "09:30", subjectId: maths.id, room: "Room 201" },
    { day: DayOfWeek.WEDNESDAY, start: "10:00", end: "11:30", subjectId: programming.id, room: "Lab 101" },
    { day: DayOfWeek.THURSDAY, start: "08:00", end: "09:30", subjectId: accounting.id, room: "Room 104" },
    { day: DayOfWeek.FRIDAY, start: "08:00", end: "09:30", subjectId: english.id, room: "Room 201" },
    { day: DayOfWeek.FRIDAY, start: "10:00", end: "11:30", subjectId: programming.id, room: "Lab 102" },
  ];
  for (const cls of classes) {
    for (const slot of week) {
      const exists = await prisma.timetableSlot.findFirst({
        where: { classId: cls.id, dayOfWeek: slot.day, startTime: slot.start },
      });
      if (!exists) {
        await prisma.timetableSlot.create({
          data: {
            schoolId: school.id,
            classId: cls.id,
            subjectId: slot.subjectId,
            teacherId: primaryTeacherId,
            dayOfWeek: slot.day,
            startTime: slot.start,
            endTime: slot.end,
            room: cls.room || slot.room,
          },
        });
      }
    }
  }

  const createdStudents = [];
  for (let i = 0; i < LEARNERS.length; i++) {
    const row = LEARNERS[i];
    const cls = classes[i % classes.length];
    const email = `${row.firstName}.${row.lastName}`.toLowerCase().replace(/[^a-z.]+/g, "") + `@student.${domain}`;
    let userId: string | undefined;
    if (row.portal) {
      const user =
        (await prisma.user.findUnique({ where: { email } })) ??
        (await prisma.user.create({
          data: {
            schoolId: school.id,
            email,
            passwordHash,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            role: UserRole.STUDENT,
          },
        }));
      userId = user.id;
    }
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        campusId: campus.id,
        gradeId: grade.id,
        classId: cls.id,
        userId,
        studentNumber: row.number,
        firstName: row.firstName,
        lastName: row.lastName,
        gender: row.gender,
        dateOfBirth: day(`2007-${String((i % 12) + 1).padStart(2, "0")}-14`),
        nationality: "South African",
        homeLanguage: row.language,
        email,
        phone: row.phone,
        address: `${12 + i} ${row.suburb} Street`,
        city: row.city,
        province: "Gauteng",
        postalCode: "2001",
        emergencyName: `${row.guardianFirst} ${row.guardianLast}`,
        emergencyPhone: row.phone,
        emergencyRelationship: row.relationship,
        status: "ACTIVE",
        popiaConsentAt: new Date("2026-01-15"),
        enrolledAt: new Date("2026-01-15"),
      },
    });
    const guardianEmail = `${row.guardianFirst}.${row.guardianLast}`.toLowerCase().replace(/[^a-z.]+/g, "") + `@parent.${domain}`;
    let guardianUserId: string | undefined;
    if (row.portal) {
      const parent =
        (await prisma.user.findUnique({ where: { email: guardianEmail } })) ??
        (await prisma.user.create({
          data: {
            schoolId: school.id,
            email: guardianEmail,
            passwordHash,
            firstName: row.guardianFirst,
            lastName: row.guardianLast,
            phone: row.phone,
            role: UserRole.PARENT,
          },
        }));
      guardianUserId = parent.id;
    }
    const guardian = await prisma.guardian.create({
      data: {
        schoolId: school.id,
        userId: guardianUserId,
        firstName: row.guardianFirst,
        lastName: row.guardianLast,
        email: guardianEmail,
        phone: row.phone,
        relationship: row.relationship,
      },
    });
    await prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: row.relationship,
        isPrimary: true,
      },
    });
    await prisma.enrolment.create({
      data: {
        studentId: student.id,
        courseId: course?.id,
        academicYearId: academicYear.id,
        gradeId: grade.id,
        classId: cls.id,
        status: "ENROLLED",
        enrolledAt: new Date("2026-01-15"),
      },
    });
    createdStudents.push(student);
  }

  const schoolDays = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-21"];
  const attendanceCycle: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.SICK,
    AttendanceStatus.PRESENT,
  ];
  for (const [index, student] of createdStudents.entries()) {
    for (const [dayIndex, iso] of schoolDays.entries()) {
      const status = attendanceCycle[(index + dayIndex) % attendanceCycle.length];
      await prisma.attendanceRecord.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          classId: student.classId,
          termId: term?.id,
          date: day(iso),
          status,
          notes: status === AttendanceStatus.LATE ? "Arrived during first period" : status === AttendanceStatus.SICK ? "Parent reported flu" : undefined,
          markedBy: primaryTeacherId,
        },
      });
    }
  }

  const task = await prisma.assessment.create({
    data: {
      schoolId: school.id,
      subjectId: programming.id,
      termId: term?.id,
      teacherId: primaryTeacherId,
      title: "Task: student registration system",
      description: "Build a small registration form that captures a South African learner number, home language and guardian phone.",
      type: AssessmentType.ASSIGNMENT,
      maxMarks: 50,
      weight: 20,
      dueDate: new Date("2026-09-25T15:00:00.000Z"),
      isPublished: true,
      assignment: {
        create: {
          instructions: "Submit a short explanation and sample input. Late work is accepted until Monday with a 10% penalty.",
          allowLate: true,
          maxSubmissions: 1,
        },
      },
    },
    include: { assignment: true },
  });
  const test = await prisma.assessment.create({
    data: {
      schoolId: school.id,
      subjectId: maths.id,
      termId: term?.id,
      teacherId: lecturers[0]?.teacherId ?? primaryTeacherId,
      title: "Mathematics controlled test 2",
      description: "Algebra, percentages and simple interest. Written under test conditions.",
      type: AssessmentType.TEST,
      maxMarks: 100,
      weight: 30,
      dueDate: new Date("2026-09-16T08:00:00.000Z"),
      isPublished: true,
    },
  });
  await prisma.examQuestion.createMany({
    data: [
      { assessmentId: test.id, prompt: "A learner pays 15% VAT on a R2 400 textbook. How much VAT is charged?", type: "SHORT_ANSWER", points: 5, sortOrder: 1 },
      { assessmentId: test.id, prompt: "Solve for x: 3x + 6 = 21", type: "SHORT_ANSWER", points: 5, sortOrder: 2 },
      { assessmentId: test.id, prompt: "Simple interest on R5 000 at 8% per year for 2 years is R800.", type: "TRUE_FALSE", points: 2, correctAnswer: "true", sortOrder: 3 },
    ],
  });

  for (let i = 0; i < createdStudents.length; i++) {
    const student = createdStudents[i];
    const score = 48 + ((i * 7) % 48);
    await prisma.mark.create({
      data: {
        assessmentId: test.id,
        studentId: student.id,
        score,
        gradeSymbol: score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "E",
        comments: score >= 70 ? "Secure working. Keep the finance examples." : "Revise percentages and show the substitution step.",
      },
    });
    if (i < 10 && task.assignment) {
      await prisma.assignmentSubmission.create({
        data: {
          assignmentId: task.assignment.id,
          studentId: student.id,
          content: "Registration form stores the learner number, home language and guardian cellphone. Sample learner STU-LIVE used in the test.",
          submittedAt: new Date("2026-09-20T14:10:00.000Z"),
          status: i < 6 ? AssignmentSubmissionStatus.GRADED : AssignmentSubmissionStatus.SUBMITTED,
          grade: i < 6 ? 34 + (i % 12) : undefined,
          feedback: i < 6 ? "Clear test data. Add validation for an empty guardian number." : undefined,
          returnedAt: i < 6 ? new Date("2026-09-21T09:00:00.000Z") : undefined,
        },
      });
    }
  }

  if (term) {
    await prisma.lessonPlan.create({
      data: {
        schoolId: school.id,
        subjectId: programming.id,
        teacherId: primaryTeacherId,
        classId: classes[0].id,
        termId: term.id,
        weekNumber: 37,
        title: "Validating South African contact details",
        topic: "Input validation",
        objective: "Learners check a cellphone number and reject an empty guardian field before saving a registration.",
        resources: "Lab 101, learner laptops, sample registration brief",
        lessonDate: day("2026-09-21"),
        isPublished: true,
        relatedAssessmentId: task.id,
      },
    });
    await prisma.curriculumTopic.createMany({
      data: [
        { schoolId: school.id, subjectId: programming.id, classId: classes[0].id, termId: term.id, title: "Variables and decisions", status: CurriculumTopicStatus.COMPLETED, sortOrder: 1 },
        { schoolId: school.id, subjectId: programming.id, classId: classes[0].id, termId: term.id, title: "Forms and validation", status: CurriculumTopicStatus.CURRENT, sortOrder: 2 },
        { schoolId: school.id, subjectId: maths.id, classId: classes[0].id, termId: term.id, title: "Percentages, VAT and simple interest", status: CurriculumTopicStatus.CURRENT, sortOrder: 3 },
      ],
    });
  }

  for (let i = 0; i < createdStudents.length; i++) {
    const student = createdStudents[i];
    const tuition = 12500;
    const materials = 2300;
    const total = tuition + materials;
    const pattern = i % 4;
    const paid = pattern === 0 ? total : pattern === 1 ? 7400 : pattern === 2 ? 0 : total;
    const due = pattern === 2 ? day("2026-08-31") : day("2026-09-30");
    const status = paid >= total ? InvoiceStatus.PAID : paid > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.OVERDUE;
    const invoiceNumber = `INV-LIVE-2026-${String(i + 1).padStart(4, "0")}`;
    const invoice = await prisma.invoice.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        invoiceNumber,
        description: "Semester 2 tuition and learning materials",
        subtotal: total,
        total,
        amountPaid: paid,
        status,
        dueDate: due,
        issuedAt: new Date("2026-07-15"),
        lineItems: {
          create: [
            { description: "Semester 2 tuition", quantity: 1, unitPrice: tuition, amount: tuition },
            { description: "Learning materials and lab levy", quantity: 1, unitPrice: materials, amount: materials },
          ],
        },
      },
    });
    await prisma.studentLedgerEntry.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        academicYearId: academicYear.id,
        type: StudentLedgerType.CHARGE,
        description: "Semester 2 tuition and materials",
        signedAmount: total,
        reference: invoiceNumber,
        invoiceId: invoice.id,
        entryDate: new Date("2026-07-15"),
        recordedById: actor.id,
      },
    });
    if (paid > 0) {
      const methods = [PaymentMethod.EFT, PaymentMethod.BANK_DEPOSIT, PaymentMethod.CARD, PaymentMethod.PAYSTACK];
      const payment = await prisma.payment.create({
        data: {
          schoolId: school.id,
          invoiceId: invoice.id,
          amount: paid,
          method: methods[i % methods.length],
          reference: pattern === 3 ? `PAYSTACK-LIVE-${1000 + i}` : `FNB${20260900 + i}`,
          bankReference: `Semester 2 ${student.studentNumber}`,
          notes: "Captured from the campus finance desk",
          paidAt: new Date("2026-09-12"),
          receiptNumber: `RCP-LIVE-${String(i + 1).padStart(5, "0")}`,
          recordedById: actor.id,
          feeType: "Tuition",
          academicYearId: academicYear.id,
        },
      });
      await prisma.studentLedgerEntry.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          academicYearId: academicYear.id,
          type: StudentLedgerType.PAYMENT,
          description: "Fee payment received",
          signedAmount: -paid,
          reference: payment.receiptNumber,
          invoiceId: invoice.id,
          paymentId: payment.id,
          entryDate: new Date("2026-09-12"),
          recordedById: actor.id,
        },
      });
    }
  }

  await prisma.certificate.create({
    data: {
      schoolId: school.id,
      studentId: createdStudents[0].id,
      courseId: course?.id,
      academicYearId: academicYear.id,
      certificateNo: "CERT-LIVE-2026-001",
      type: CertificateType.MERIT,
      title: "Merit award — Programming",
      description: "Awarded for consistent practical work during Semester 2.",
      issuedAt: new Date("2026-09-18"),
      issuedById: actor.id,
    },
  });
  await prisma.issuedLetter.create({
    data: {
      schoolId: school.id,
      studentId: createdStudents[1].id,
      type: IssuedLetterType.TESTIMONIAL,
      letterNo: "LET-LIVE-2026-001",
      title: "Testimonial",
      bodyText: "Anele Dlamini is enrolled for the 2026 academic year, attends regularly and is in good financial standing for the current semester.",
      effectiveDate: day("2026-09-18"),
      issuedAt: new Date("2026-09-18"),
      issuedById: actor.id,
    },
  });

  const closedTerm = await prisma.term.findFirst({
    where: { academicYearId: academicYear.id, isCurrent: false },
    orderBy: { termNumber: "asc" },
  });
  if (closedTerm) {
    for (const student of createdStudents.slice(0, 8)) {
      await prisma.reportCard.create({
        data: {
          studentId: student.id,
          academicYearId: academicYear.id,
          termId: closedTerm.id,
          overallAverage: 68,
          comments: "A steady semester. Keep submitting practical work on time.",
          publishedAt: new Date("2026-07-10"),
          snapshot: {
            kind: "report",
            data: {
              brand: {
                name: school.name,
                email: school.email,
                phone: school.phone,
                address: school.address,
                city: school.city,
                province: school.province,
                postalCode: school.postalCode,
              },
              studentName: `${student.firstName} ${student.lastName}`,
              studentNumber: student.studentNumber,
              grade: grade.name,
              className: classes.find((item) => item.id === student.classId)?.name ?? "—",
              academicYear: academicYear.name,
              term: closedTerm.name,
              subjects: [
                { name: "Mathematics", score: 72, maxMarks: 100, percentage: 72, symbol: "6" },
                { name: "English Communication", score: 68, maxMarks: 100, percentage: 68, symbol: "5" },
                { name: "Programming", score: 81, maxMarks: 100, percentage: 81, symbol: "7" },
                { name: "Accounting", score: 64, maxMarks: 100, percentage: 64, symbol: "5" },
              ],
              overallAverage: 68,
              overallSymbol: "5",
              comments: "A steady semester. Keep submitting practical work on time.",
            },
          },
        },
      });
    }
  }

  await prisma.visitorEntry.createMany({
    data: [
      {
        schoolId: school.id,
        campusId: campus.id,
        firstName: "Dineo",
        lastName: "Mokoena",
        organisation: "Parent",
        phone: "071 482 1190",
        identityType: VisitorIdentityType.SA_ID,
        hostKind: VisitorHostKind.LEARNER,
        hostName: "Karabo Mokoena",
        department: "Reception",
        purpose: VisitorPurpose.PARENT_GUARDIAN,
        purposeDetail: "Collect a printed statement of account",
        badgeNumber: "V-014",
        status: VisitorStatus.CHECKED_IN,
        signedInAt: new Date("2026-09-21T07:40:00.000Z"),
        signedInById: actor.id,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        firstName: "Mandla",
        lastName: "Sibiya",
        organisation: "BrightSpark Electrical",
        phone: "082 700 1145",
        identityType: VisitorIdentityType.DRIVERS_LICENCE,
        hostKind: VisitorHostKind.STAFF,
        hostName: "Campus maintenance",
        department: "Facilities",
        purpose: VisitorPurpose.CONTRACTOR,
        purposeDetail: "Repair the Lab 101 distribution board",
        vehicleRegistration: "JB 44 LT GP",
        itemsBrought: "Toolbox and multimeter",
        badgeNumber: "V-015",
        status: VisitorStatus.CHECKED_IN,
        signedInAt: new Date("2026-09-21T08:05:00.000Z"),
        signedInById: actor.id,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        firstName: "Lindiwe",
        lastName: "Maseko",
        organisation: "Gauteng Department of Education",
        phone: "011 355 0000",
        identityType: VisitorIdentityType.SA_ID,
        hostKind: VisitorHostKind.STAFF,
        hostName: school.principalName || "Campus Director",
        department: "Management",
        purpose: VisitorPurpose.OFFICIAL,
        purposeDetail: "Curriculum support visit",
        badgeNumber: "V-009",
        status: VisitorStatus.CHECKED_OUT,
        signedInAt: new Date("2026-09-18T09:00:00.000Z"),
        signedOutAt: new Date("2026-09-18T11:20:00.000Z"),
        signedInById: actor.id,
        signedOutById: actor.id,
      },
      {
        schoolId: school.id,
        campusId: campus.id,
        firstName: "Courier",
        lastName: "Desk",
        organisation: "The Courier Guy",
        phone: "010 286 0000",
        hostKind: VisitorHostKind.STAFF,
        hostName: "Reception",
        department: "Administration",
        purpose: VisitorPurpose.DELIVERY,
        purposeDetail: "Textbook delivery for Accounting",
        vehicleRegistration: "ND 392 118",
        badgeNumber: "V-011",
        status: VisitorStatus.CHECKED_OUT,
        signedInAt: new Date("2026-09-17T10:15:00.000Z"),
        signedOutAt: new Date("2026-09-17T10:28:00.000Z"),
        signedInById: actor.id,
        signedOutById: actor.id,
      },
    ],
  });

  await prisma.schoolEvent.createMany({
    data: [
      {
        schoolId: school.id,
        title: "Heritage Day — campus closed",
        description: "Thursday 24 September is a public holiday. Classes resume on Friday 25 September.",
        startsAt: new Date("2026-09-24T06:00:00.000Z"),
        endsAt: new Date("2026-09-24T16:00:00.000Z"),
        isPublic: true,
      },
      {
        schoolId: school.id,
        title: "Parent evening — fees and progress",
        description: "Guardians can collect statements, view Semester 2 progress and speak to lecturers. Reception opens at 16:30.",
        startsAt: new Date("2026-10-01T14:30:00.000Z"),
        endsAt: new Date("2026-10-01T17:00:00.000Z"),
        isPublic: true,
      },
      {
        schoolId: school.id,
        title: "Semester 2 controlled tests",
        description: "Mathematics and Accounting tests run in Room 201. Learners need their student cards.",
        startsAt: new Date("2026-10-12T06:00:00.000Z"),
        endsAt: new Date("2026-10-16T14:00:00.000Z"),
        isPublic: true,
      },
    ],
  });

  await prisma.announcement.createMany({
    data: [
      {
        schoolId: school.id,
        authorId: actor.id,
        title: "Student cards must be worn on campus",
        content: "From this week every learner wears a student card on campus. Cards are printed from the learner profile. Report a lost card at reception.",
        audience: "ALL",
        isPinned: true,
      },
      {
        schoolId: school.id,
        authorId: actor.id,
        title: "Semester 2 fees",
        content: "Statements are available in the parent portal. EFT payments must use the learner number as the reference. The finance desk is open until 15:30.",
        audience: "PARENTS",
      },
      {
        schoolId: school.id,
        authorId: actor.id,
        title: "Programming task due Friday",
        content: "The student registration task is due on Friday 25 September at 17:00. Submit it in the learner portal.",
        audience: "STUDENTS",
      },
    ],
  });

  const message = await prisma.internalMessage.create({
    data: {
      schoolId: school.id,
      senderId: actor.id,
      subject: "Register and visitor book for Monday",
      body: "Please submit today's register before 09:45. Reception still has a parent and an electrician signed in. Heritage Day on Thursday is a campus closure.",
    },
  });
  await prisma.messageRecipient.createMany({
    data: lecturers.slice(0, 4).map((person) => ({ messageId: message.id, userId: person.userId })),
  });

  const staffDays = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-21"];
  for (const person of staffRecords) {
    for (const [index, iso] of staffDays.entries()) {
      await prisma.staffAttendanceRecord.create({
        data: {
          schoolId: school.id,
          userId: person.userId,
          employeeId: person.employeeId,
          date: day(iso),
          status: index === 2 && person.firstName === "Johan" ? StaffAttendanceStatus.LATE : StaffAttendanceStatus.PRESENT,
          checkIn: index === 2 && person.firstName === "Johan" ? "08:20" : "07:35",
          checkOut: "16:05",
          markedById: actor.id,
        },
      });
    }
  }

  const leaveTeacher = lecturers[1];
  if (leaveTeacher) {
    await prisma.leaveRequest.create({
      data: {
        schoolId: school.id,
        userId: leaveTeacher.userId,
        teacherId: leaveTeacher.teacherId,
        employeeId: leaveTeacher.employeeId,
        type: LeaveType.ANNUAL,
        status: LeaveStatus.APPROVED,
        startDate: day("2026-10-06"),
        endDate: day("2026-10-08"),
        days: 3,
        reason: "Family travel after the controlled tests",
        reviewedById: actor.id,
        reviewedAt: new Date("2026-09-19"),
      },
    });
  }
  await prisma.studentAbsenceRequest.create({
    data: {
      schoolId: school.id,
      studentId: createdStudents[6].id,
      type: StudentAbsenceType.SICK,
      fromDate: day("2026-09-16"),
      toDate: day("2026-09-16"),
      reason: "Flu. Guardian phoned reception before first period.",
      status: LeaveStatus.APPROVED,
      reviewedById: actor.id,
      reviewedAt: new Date("2026-09-16T08:30:00.000Z"),
      reviewNote: "Register updated to sick.",
    },
  });

  const payrollNotes = "LIVE-CAMPUS September 2026";
  const payrollItems = staffRecords.map((person, index) => {
    const housing = person.salary >= 20000 ? 1800 : 0;
    const gross = person.salary + housing;
    const uif = Math.min(177.12, Math.round(gross * 0.01 * 100) / 100);
    const paye = person.salary >= 20000 ? Math.round(gross * 0.14) : 0;
    const deductions = uif + paye;
    return {
      person,
      gross,
      deductions,
      net: Math.round((gross - deductions) * 100) / 100,
      uif,
      paye,
      housing,
      number: `PS-LIVE-2026-09-${String(index + 1).padStart(3, "0")}`,
    };
  });
  const payroll = await prisma.payrollRun.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      periodStart: day("2026-09-01"),
      periodEnd: day("2026-09-30"),
      paymentDate: day("2026-09-25"),
      status: PayrollRunStatus.CALCULATED,
      notes: payrollNotes,
      totalGross: payrollItems.reduce((sum, row) => sum + row.gross, 0),
      totalDeductions: payrollItems.reduce((sum, row) => sum + row.deductions, 0),
      totalEmployer: payrollItems.reduce((sum, row) => sum + row.uif, 0),
      totalNet: payrollItems.reduce((sum, row) => sum + row.net, 0),
      createdById: actor.id,
      items: {
        create: payrollItems.map((row) => ({
          employeeId: row.person.employeeId,
          grossPay: row.gross,
          totalDeductions: row.deductions,
          employerContributions: row.uif,
          netPay: row.net,
          earningsJson: [
            { name: "Basic salary", amount: row.person.salary },
            ...(row.housing ? [{ name: "Housing allowance", amount: row.housing }] : []),
          ] as Prisma.InputJsonValue,
          deductionsJson: [
            ...(row.paye ? [{ name: "PAYE", amount: row.paye }] : []),
            { name: "UIF", amount: row.uif },
          ] as Prisma.InputJsonValue,
          employerJson: [{ name: "UIF employer", amount: row.uif }] as Prisma.InputJsonValue,
        })),
      },
    },
    include: { items: true },
  });
  for (const [index, item] of payroll.items.entries()) {
    await prisma.payslip.create({
      data: { payrollItemId: item.id, number: payrollItems[index].number },
    });
  }

  await prisma.notification.create({
    data: {
      schoolId: school.id,
      userId: actor.id,
      title: "Campus data is ready",
      message: "Learners, registers, fees, visitors and the September payroll run are loaded for the live campus.",
      type: "SUCCESS",
      link: "/admin/dashboard",
    },
  });

  console.log(`Live campus loaded for ${school.name}.`);
  console.log(`New staff and learner portal password: ${PASSWORD}`);
  console.log(`Example lecturer: ayesha.patel@${domain}`);
  console.log(`Example learner:  karabo.mokoena@student.${domain}`);
  console.log(`Example parent:   dineo.mokoena@parent.${domain}`);
  console.log(`Student cards can be printed from any learner profile. Numbers start at ${MARKER}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
