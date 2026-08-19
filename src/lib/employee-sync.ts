import { EmployeeCategory, EmploymentType, StaffStatus } from "@prisma/client";
import { prisma } from "./db";
import { logAudit } from "./audit";
import { staffPortalShouldBeActive } from "./portal-lifecycle";
import { setLinkedUserActive } from "./portal-provision";

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

export async function syncEmployeeEmploymentStatus(params: {
  employeeId: string;
  schoolId: string;
  actorId: string;
  status: StaffStatus;
}) {
  const employee = await prisma.employee.findFirst({
    where: { id: params.employeeId, schoolId: params.schoolId },
    select: { id: true, userId: true, teacherId: true },
  });
  if (!employee) return { deactivated: false };

  const isActive = staffPortalShouldBeActive(params.status);
  await setLinkedUserActive({
    userId: employee.userId,
    schoolId: params.schoolId,
    actorId: params.actorId,
    isActive,
  });

  if (employee.teacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: employee.teacherId, schoolId: params.schoolId },
      select: { id: true, userId: true },
    });
    if (teacher) {
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { status: params.status },
      });
      if (teacher.userId && teacher.userId !== employee.userId) {
        await setLinkedUserActive({
          userId: teacher.userId,
          schoolId: params.schoolId,
          actorId: params.actorId,
          isActive,
        });
      }
    }
  }

  return { deactivated: !isActive };
}
