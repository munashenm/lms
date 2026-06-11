import "dotenv/config";
import { PrismaClient, UserRole, InstitutionType, CurriculumType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("🌱 Seeding SchoolHub SA demo data...");

  // Clean existing data (dev only)
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.mark.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.studentGuardian.deleteMany();
  await prisma.enrolment.deleteMany();
  await prisma.application.deleteMany();
  await prisma.reportCard.deleteMany();
  await prisma.document.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.class.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.term.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.campus.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  // ── School ──────────────────────────────────────────────────────────────
  const school = await prisma.school.create({
    data: {
      name: "Cyber Developers College",
      slug: "cyber-college",
      institutionType: InstitutionType.COLLEGE,
      curriculumType: CurriculumType.TVET_NQF,
      registrationNo: "REG-2020-001",
      email: "info@college.co.za",
      phone: "087 550 1813",
      website: "https://www.cyberdevelopers.co.za",
      address: "123 Education Drive",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2001",
      popiaConsentText:
        "I consent to the collection and processing of my personal information in accordance with POPIA.",
    },
  });

  const campus = await prisma.campus.create({
    data: {
      schoolId: school.id,
      name: "Main Campus",
      code: "MAIN",
      address: "123 Education Drive",
      city: "Johannesburg",
      province: "Gauteng",
      isMain: true,
    },
  });

  // ── Academic Year & Terms ───────────────────────────────────────────────
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: "2026",
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-12-15"),
      isCurrent: true,
      terms: {
        create: [
          { name: "Term 1", termNumber: 1, startDate: new Date("2026-01-15"), endDate: new Date("2026-03-28"), isCurrent: false },
          { name: "Term 2", termNumber: 2, startDate: new Date("2026-04-08"), endDate: new Date("2026-06-27"), isCurrent: true },
          { name: "Term 3", termNumber: 3, startDate: new Date("2026-07-15"), endDate: new Date("2026-09-26"), isCurrent: false },
          { name: "Term 4", termNumber: 4, startDate: new Date("2026-10-06"), endDate: new Date("2026-12-15"), isCurrent: false },
        ],
      },
    },
    include: { terms: true },
  });

  const term2 = academicYear.terms.find((t) => t.termNumber === 2)!;

  // ── Grades ──────────────────────────────────────────────────────────────
  const grades = await Promise.all(
    ["NQF Level 2", "NQF Level 3", "NQF Level 4", "NQF Level 5"].map((name, i) =>
      prisma.grade.create({
        data: { schoolId: school.id, name, level: i + 2, sortOrder: i },
      })
    )
  );

  // ── Courses & Modules ───────────────────────────────────────────────────
  const course = await prisma.course.create({
    data: {
      schoolId: school.id,
      code: "IT-001",
      name: "Information Technology",
      description: "NQF Level 4 IT Programme",
      nqfLevel: 4,
      durationMonths: 12,
      modules: {
        create: [
          { code: "IT-M01", name: "Computer Systems", credits: 15, sortOrder: 1 },
          { code: "IT-M02", name: "Programming Fundamentals", credits: 20, sortOrder: 2 },
          { code: "IT-M03", name: "Networking Basics", credits: 15, sortOrder: 3 },
          { code: "IT-M04", name: "Database Design", credits: 20, sortOrder: 4 },
        ],
      },
    },
    include: { modules: true },
  });

  // ── Subjects ────────────────────────────────────────────────────────────
  const subjects = await Promise.all(
    [
      { code: "ENG", name: "English Communication" },
      { code: "MATH", name: "Mathematics" },
      { code: "IT-PRG", name: "Programming" },
      { code: "IT-NET", name: "Networking" },
    ].map((s) =>
      prisma.subject.create({
        data: { schoolId: school.id, gradeId: grades[2].id, ...s, credits: 10 },
      })
    )
  );

  // ── Classes ─────────────────────────────────────────────────────────────
  const classA = await prisma.class.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      gradeId: grades[2].id,
      academicYearId: academicYear.id,
      name: "IT-4A",
      capacity: 30,
      room: "Lab 101",
    },
  });

  const classB = await prisma.class.create({
    data: {
      schoolId: school.id,
      campusId: campus.id,
      gradeId: grades[2].id,
      academicYearId: academicYear.id,
      name: "IT-4B",
      capacity: 30,
      room: "Lab 102",
    },
  });

  // ── Users ───────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@cyberdevelopers.co.za",
      passwordHash: await hash("Admin@2026"),
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const schoolAdmin = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admin@college.co.za",
      passwordHash: await hash("admin123"),
      firstName: "School",
      lastName: "Administrator",
      role: UserRole.SCHOOL_ADMIN,
    },
  });

  const principal = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "principal@college.co.za",
      passwordHash: await hash("principal123"),
      firstName: "John",
      lastName: "Mokoena",
      role: UserRole.PRINCIPAL,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "lecturer@college.co.za",
      passwordHash: await hash("lecturer123"),
      firstName: "Sarah",
      lastName: "Ndlovu",
      role: UserRole.TEACHER,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "student@college.co.za",
      passwordHash: await hash("student123"),
      firstName: "Thabo",
      lastName: "Mahlangu",
      role: UserRole.STUDENT,
    },
  });

  const parentUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "parent@college.co.za",
      passwordHash: await hash("parent123"),
      firstName: "Grace",
      lastName: "Mahlangu",
      role: UserRole.PARENT,
    },
  });

  const financeUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "finance@college.co.za",
      passwordHash: await hash("finance123"),
      firstName: "Peter",
      lastName: "Van Wyk",
      role: UserRole.FINANCE_OFFICER,
    },
  });

  // ── Teacher ─────────────────────────────────────────────────────────────
  const teacher = await prisma.teacher.create({
    data: {
      schoolId: school.id,
      userId: teacherUser.id,
      campusId: campus.id,
      employeeNumber: "EMP001",
      firstName: "Sarah",
      lastName: "Ndlovu",
      email: "lecturer@college.co.za",
      qualification: "BSc Computer Science",
      department: "Information Technology",
    },
  });

  await prisma.classTeacher.create({
    data: { classId: classA.id, teacherId: teacher.id, isPrimary: true },
  });

  for (const subject of subjects) {
    await prisma.classSubject.create({
      data: { classId: classA.id, subjectId: subject.id, teacherId: teacher.id },
    });
  }

  // ── Timetable ───────────────────────────────────────────────────────────
  const timetableData = [
    { day: "MONDAY" as const, start: "08:00", end: "09:30", subjectIdx: 2, room: "Lab 101" },
    { day: "MONDAY" as const, start: "10:00", end: "11:30", subjectIdx: 3, room: "Lab 101" },
    { day: "TUESDAY" as const, start: "08:00", end: "09:30", subjectIdx: 0, room: "Room 201" },
    { day: "WEDNESDAY" as const, start: "08:00", end: "09:30", subjectIdx: 1, room: "Room 201" },
    { day: "THURSDAY" as const, start: "08:00", end: "09:30", subjectIdx: 2, room: "Lab 101" },
    { day: "FRIDAY" as const, start: "08:00", end: "09:30", subjectIdx: 3, room: "Lab 102" },
  ];

  for (const slot of timetableData) {
    await prisma.timetableSlot.create({
      data: {
        classId: classA.id,
        subjectId: subjects[slot.subjectIdx].id,
        teacherId: teacher.id,
        dayOfWeek: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        room: slot.room,
      },
    });
  }

  // ── Guardian ────────────────────────────────────────────────────────────
  const guardian = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      userId: parentUser.id,
      firstName: "Grace",
      lastName: "Mahlangu",
      email: "parent@college.co.za",
      phone: "082 345 6789",
      relationship: "Mother",
    },
  });

  // ── Students ────────────────────────────────────────────────────────────
  const studentNames = [
    { firstName: "Thabo", lastName: "Mahlangu", number: "STD2026001", userId: studentUser.id },
    { firstName: "Lerato", lastName: "Dlamini", number: "STD2026002" },
    { firstName: "Sipho", lastName: "Nkosi", number: "STD2026003" },
    { firstName: "Nomsa", lastName: "Zulu", number: "STD2026004" },
    { firstName: "David", lastName: "Botha", number: "STD2026005" },
    { firstName: "Amahle", lastName: "Mthembu", number: "STD2026006" },
    { firstName: "Kagiso", lastName: "Molefe", number: "STD2026007" },
    { firstName: "Zanele", lastName: "Khumalo", number: "STD2026008" },
    { firstName: "Mandla", lastName: "Sithole", number: "STD2026009" },
    { firstName: "Precious", lastName: "Mokoena", number: "STD2026010" },
  ];

  const students = [];
  for (let i = 0; i < studentNames.length; i++) {
    const s = studentNames[i];
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        campusId: campus.id,
        gradeId: grades[2].id,
        classId: i < 5 ? classA.id : classB.id,
        userId: s.userId ?? null,
        studentNumber: s.number,
        firstName: s.firstName,
        lastName: s.lastName,
        email: `${s.firstName.toLowerCase()}@student.college.co.za`,
        phone: `082 ${100 + i}00 ${1000 + i}`,
        status: "ACTIVE",
        popiaConsentAt: new Date(),
        enrolledAt: new Date("2026-01-15"),
      },
    });
    students.push(student);
  }

  await prisma.studentGuardian.create({
    data: {
      studentId: students[0].id,
      guardianId: guardian.id,
      relationship: "Mother",
      isPrimary: true,
    },
  });

  // ── Enrolments ──────────────────────────────────────────────────────────
  for (const student of students) {
    await prisma.enrolment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        academicYearId: academicYear.id,
      },
    });
  }

  // ── Attendance (sample) ─────────────────────────────────────────────────
  const today = new Date();
  for (const student of students.slice(0, 5)) {
    await prisma.attendanceRecord.create({
      data: {
        studentId: student.id,
        classId: classA.id,
        termId: term2.id,
        date: today,
        status: Math.random() > 0.15 ? "PRESENT" : "ABSENT",
        markedBy: teacher.id,
      },
    });
  }

  // ── Invoices ────────────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const student = students[i];
    const total = 15000;
    const paid = i < 3 ? 15000 : i === 3 ? 7500 : 0;
    const invoice = await prisma.invoice.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        invoiceNumber: `INV-2026-${String(i + 1).padStart(4, "0")}`,
        description: "Term 2 Tuition Fees",
        subtotal: total,
        total,
        amountPaid: paid,
        status: paid >= total ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "SENT",
        dueDate: new Date("2026-06-30"),
        lineItems: {
          create: [
            { description: "Tuition Fee", quantity: 1, unitPrice: 12000, amount: 12000 },
            { description: "Registration Fee", quantity: 1, unitPrice: 3000, amount: 3000 },
          ],
        },
      },
    });

    if (paid > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paid,
          method: i % 2 === 0 ? "EFT" : "CASH",
          reference: `PAY-${i + 1}`,
        },
      });
    }
  }

  // ── Announcements ───────────────────────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      {
        schoolId: school.id,
        authorId: schoolAdmin.id,
        title: "Term 2 Mid-Year Exams",
        content: "Mid-year examinations will commence on 15 June 2026. Please ensure all students are prepared.",
        audience: "ALL",
        isPinned: true,
      },
      {
        schoolId: school.id,
        authorId: principal.id,
        title: "Fee Payment Reminder",
        content: "Term 2 fees are due by 30 June 2026. Outstanding accounts may result in access restrictions.",
        audience: "STUDENTS",
      },
      {
        schoolId: school.id,
        authorId: teacherUser.id,
        title: "Programming Assignment Due",
        content: "The Programming Fundamentals assignment is due this Friday. Submit via the student portal.",
        audience: "STUDENTS",
      },
    ],
  });

  // ── Assessments & Marks ─────────────────────────────────────────────────
  const programmingSubject = subjects.find((s) => s.code === "IT-PRG")!;

  const testAssessment = await prisma.assessment.create({
    data: {
      subjectId: programmingSubject.id,
      termId: term2.id,
      teacherId: teacher.id,
      title: "Term 2 Programming Test",
      type: "TEST",
      maxMarks: 50,
      weight: 25,
      isPublished: true,
    },
  });

  const assignmentAssessment = await prisma.assessment.create({
    data: {
      subjectId: programmingSubject.id,
      termId: term2.id,
      teacherId: teacher.id,
      title: "Programming Assignment 1",
      type: "ASSIGNMENT",
      maxMarks: 30,
      weight: 15,
      dueDate: new Date("2026-06-30"),
      isPublished: true,
      assignment: {
        create: {
          instructions: "Build a console application that demonstrates variables, loops, and functions. Submit your code and a brief explanation.",
          allowLate: true,
        },
      },
    },
    include: { assignment: true },
  });

  const examAssessment = await prisma.assessment.create({
    data: {
      subjectId: subjects.find((s) => s.code === "MATH")!.id,
      termId: term2.id,
      teacherId: teacher.id,
      title: "Term 2 Mathematics Exam",
      type: "EXAM",
      maxMarks: 100,
      weight: 40,
      isPublished: false,
    },
  });

  const testScores = [42, 38, 45, 35, 48, 40, 44, 36, 41, 39];
  for (let i = 0; i < students.length; i++) {
    const score = testScores[i] ?? 35;
    const pct = (score / 50) * 100;
    const symbol =
      pct >= 80 ? "7" : pct >= 70 ? "6" : pct >= 60 ? "5" : pct >= 50 ? "4" : pct >= 40 ? "3" : pct >= 30 ? "2" : "1";
    await prisma.mark.create({
      data: {
        assessmentId: testAssessment.id,
        studentId: students[i].id,
        score,
        gradeSymbol: symbol,
      },
    });
  }

  // Student Thabo submitted assignment
  await prisma.assignmentSubmission.create({
    data: {
      assignmentId: assignmentAssessment.assignment!.id,
      studentId: students[0].id,
      content: "Submitted console app with factorial calculator and number guessing game.",
    },
  });

  // ── Applications ────────────────────────────────────────────────────────
  await prisma.application.createMany({
    data: [
      {
        schoolId: school.id,
        referenceNo: "APP-2026-0001",
        firstName: "Zandile",
        lastName: "Mabaso",
        email: "zandile@email.co.za",
        phone: "082 111 2233",
        gradeApplied: "NQF Level 4",
        courseApplied: "Information Technology",
        status: "SUBMITTED",
      },
      {
        schoolId: school.id,
        referenceNo: "APP-2026-0002",
        firstName: "James",
        lastName: "Pretorius",
        email: "james@email.co.za",
        phone: "083 222 3344",
        gradeApplied: "NQF Level 4",
        courseApplied: "Information Technology",
        status: "UNDER_REVIEW",
      },
      {
        schoolId: school.id,
        referenceNo: "APP-2026-0003",
        firstName: "Naledi",
        lastName: "Kgoete",
        email: "naledi@email.co.za",
        gradeApplied: "NQF Level 3",
        status: "ACCEPTED",
        reviewedAt: new Date(),
      },
    ],
  });

  // ── Documents ───────────────────────────────────────────────────────────
  await prisma.document.createMany({
    data: [
      {
        schoolId: school.id,
        uploadedBy: teacherUser.id,
        title: "Programming Fundamentals — Chapter 1",
        description: "Introduction to variables, data types and control structures",
        type: "LEARNING_MATERIAL",
        fileUrl: "/uploads/demo/programming-ch1.pdf",
        isPublic: true,
      },
      {
        schoolId: school.id,
        uploadedBy: teacherUser.id,
        title: "Networking Basics — Study Guide",
        description: "OSI model, IP addressing and subnetting overview",
        type: "LEARNING_MATERIAL",
        fileUrl: "/uploads/demo/networking-guide.pdf",
        isPublic: true,
      },
    ],
  });

  // ── Notifications ─────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        schoolId: school.id,
        userId: schoolAdmin.id,
        title: "Welcome to SchoolHub SA",
        message: "Your school management portal is ready. Explore reports and settings in Phase 5.",
        type: "INFO",
        link: "/admin/dashboard",
      },
      {
        schoolId: school.id,
        userId: financeUser.id,
        title: "Fee collection update",
        message: "3 invoices are outstanding. Review the debtors report.",
        type: "FEE",
        link: "/finance/debtors",
      },
      {
        schoolId: school.id,
        userId: parentUser.id,
        title: "Term 1 fees available",
        message: "View Thabo's fee statement in the parent portal.",
        type: "FEE",
        link: "/parent/fees",
      },
      {
        schoolId: school.id,
        userId: studentUser.id,
        title: "New learning material",
        message: "Programming Fundamentals — Chapter 1 has been uploaded.",
        type: "ACADEMIC",
        link: "/student/materials",
      },
    ],
  });

  // ── Audit Log ───────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      schoolId: school.id,
      userId: superAdmin.id,
      action: "SEED",
      entity: "Database",
      metadata: { message: "Demo data seeded successfully" },
    },
  });

  console.log("✅ Seed complete!");
  console.log("\nDemo credentials:");
  console.log("  Super Admin:  admin@cyberdevelopers.co.za / Admin@2026");
  console.log("  School Admin: admin@college.co.za / admin123");
  console.log("  Teacher:      lecturer@college.co.za / lecturer123");
  console.log("  Student:      student@college.co.za / student123");
  console.log("  Parent:       parent@college.co.za / parent123");
  console.log("  Finance:      finance@college.co.za / finance123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
