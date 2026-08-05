import { prisma } from "./db";

export async function buildStudentPopiaExport(studentId: string, schoolId?: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      ...(schoolId ? { schoolId } : {}),
    },
    include: {
      grade: { select: { name: true } },
      class: { select: { name: true } },
      campus: { select: { name: true } },
      school: { select: { name: true } },
      guardians: {
        include: {
          guardian: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      invoices: {
        include: {
          lineItems: true,
          payments: { orderBy: { paidAt: "desc" } },
        },
        orderBy: { issuedAt: "desc" },
      },
      attendanceRecords: {
        take: 500,
        orderBy: { date: "desc" },
        select: { date: true, status: true, notes: true },
      },
      marks: {
        include: {
          assessment: {
            select: {
              title: true,
              type: true,
              maxMarks: true,
              term: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      submissions: {
        include: {
          assignment: { select: { title: true, dueDate: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
      certificates: {
        select: { title: true, type: true, issuedAt: true, certificateNo: true },
        orderBy: { issuedAt: "desc" },
      },
      reportCards: {
        select: {
          id: true,
          publishedAt: true,
          createdAt: true,
          academicYear: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) return null;

  const auditTrail = await prisma.auditLog.findMany({
    where: {
      schoolId: student.schoolId,
      entity: "Student",
      entityId: studentId,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      action: true,
      entity: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  const {
    id,
    firstName,
    lastName,
    studentNumber,
    saIdNumber,
    email,
    phone,
    dateOfBirth,
    gender,
    address,
    city,
    province,
    postalCode,
    status,
    popiaConsentAt,
    enrolledAt,
    createdAt,
    updatedAt,
    grade,
    class: studentClass,
    campus,
    school,
    guardians,
    invoices,
    attendanceRecords,
    marks,
    submissions,
    certificates,
    reportCards,
  } = student;

  return {
    exportedAt: new Date().toISOString(),
    purpose: "POPIA data subject access request",
    profile: {
      id,
      firstName,
      lastName,
      studentNumber,
      saIdNumber,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      city,
      province,
      postalCode,
      status,
      popiaConsentAt,
      enrolledAt,
      createdAt,
      updatedAt,
      grade: grade?.name ?? null,
      class: studentClass?.name ?? null,
      campus: campus?.name ?? null,
      school: school.name,
    },
    guardians: guardians.map((g) => ({
      name: `${g.guardian.firstName} ${g.guardian.lastName}`,
      relationship: g.relationship,
      email: g.guardian.email,
      phone: g.guardian.phone,
      isPrimary: g.isPrimary,
    })),
    finance: invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      description: inv.description,
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      status: inv.status,
      dueDate: inv.dueDate,
      issuedAt: inv.issuedAt,
      lineItems: inv.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: Number(li.unitPrice),
        amount: Number(li.amount),
      })),
      payments: inv.payments.map((p) => ({
        amount: Number(p.amount),
        method: p.method,
        reference: p.reference,
        paidAt: p.paidAt,
      })),
    })),
    attendance: attendanceRecords.map((a) => ({
      date: a.date,
      status: a.status,
      notes: a.notes,
    })),
    academic: {
      marks: marks.map((m) => ({
        assessment: m.assessment.title,
        type: m.assessment.type,
        term: m.assessment.term?.name ?? null,
        score: Number(m.score),
        maxMarks: Number(m.assessment.maxMarks),
        gradeSymbol: m.gradeSymbol,
      })),
      assignmentSubmissions: submissions.map((s) => ({
        assignment: s.assignment.title,
        dueDate: s.assignment.dueDate,
        submittedAt: s.submittedAt,
        grade: s.grade != null ? Number(s.grade) : null,
        feedback: s.feedback,
      })),
      reportCards: reportCards.map((rc) => ({
        academicYear: rc.academicYear.name,
        publishedAt: rc.publishedAt,
        createdAt: rc.createdAt,
      })),
      certificates: certificates.map((c) => ({
        title: c.title,
        type: c.type,
        certificateNo: c.certificateNo,
        issuedAt: c.issuedAt,
      })),
    },
    auditTrail: auditTrail.map((log) => ({
      action: log.action,
      entity: log.entity,
      at: log.createdAt,
      by: log.user?.email ?? "system",
    })),
  };
}
