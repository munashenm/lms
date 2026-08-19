import { EmployeeCategory, EmploymentType, StaffStatus } from "@prisma/client";
import { prisma } from "./db";
import { logAudit } from "./audit";

export async function ensureEmployeeForTeacher(params: {
  schoolId: string;
  teacherId: string;
  userId?: string | null;
  actorId?: string | null;
}) {
  const existing = await prisma.employee.findUnique({ where: { teacherId: params.teacherId } });
  if (existing) return existing;
  const teacher = await prisma.teacher.findUnique({ where: { id: params.teacherId } });
  if (!teacher) return null;

  const employee = await prisma.employee.create({
    data: {
      schoolId: params.schoolId,
      teacherId: teacher.id,
      userId: params.userId ?? teacher.userId,
      campusId: teacher.campusId,
      employeeNumber: teacher.employeeNumber,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      phone: teacher.phone,
      saIdNumber: teacher.saIdNumber,
      category: EmployeeCategory.EDUCATOR,
      department: teacher.department,
      employmentType: EmploymentType.PERMANENT,
      status: teacher.status === "TERMINATED" ? StaffStatus.TERMINATED : StaffStatus.ACTIVE,
      startDate: teacher.hiredAt,
    },
  });

  await logAudit({
    schoolId: params.schoolId,
    userId: params.actorId,
    action: "EMPLOYEE_CREATED",
    entity: "Employee",
    entityId: employee.id,
    metadata: { teacherId: teacher.id, employeeNumber: employee.employeeNumber },
  });

  return employee;
}

export async function nextHrEmployeeNumber(schoolId: string) {
  const count = await prisma.employee.count({ where: { schoolId } });
  return `EMP${String(count + 1).padStart(4, "0")}`;
}
