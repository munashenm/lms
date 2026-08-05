import { prisma } from "./db";

export async function getPublicFeeSchedule(schoolId: string) {
  return prisma.feeScheduleItem.findMany({
    where: { schoolId, isActive: true, isPublic: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getActiveFeeSchedule(schoolId: string) {
  return prisma.feeScheduleItem.findMany({
    where: { schoolId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
