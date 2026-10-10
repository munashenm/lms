import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultSchedules, provisionMissingBackupSchedules } from "@/lib/backup/schedule";

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("backup schedule provisioning", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const schoolIds: string[] = [];

  afterAll(async () => {
    if (schoolIds.length) {
      await prisma.backupSchedule.deleteMany({ where: { schoolId: { in: schoolIds } } });
      await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    }
    await prisma.$disconnect();
  });

  async function makeSchool() {
    const school = await prisma.school.create({
      data: {
        name: "Backup schedule school",
        slug: `backup-sched-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
      select: { id: true },
    });
    schoolIds.push(school.id);
    return school.id;
  }

  it("creates the three default schedules and does not overwrite an existing one", async () => {
    const schoolId = await makeSchool();
    expect(await ensureDefaultSchedules(schoolId)).toBe(3);
    expect(await ensureDefaultSchedules(schoolId)).toBe(0);

    await prisma.backupSchedule.update({
      where: { schoolId_frequency: { schoolId, frequency: "DAILY" } },
      data: { enabled: false, retainCount: 3 },
    });
    await prisma.backupSchedule.delete({
      where: { schoolId_frequency: { schoolId, frequency: "WEEKLY" } },
    });

    expect(await ensureDefaultSchedules(schoolId)).toBe(1);

    const rows = await prisma.backupSchedule.findMany({
      where: { schoolId },
      orderBy: { frequency: "asc" },
    });
    const daily = rows.find((row) => row.frequency === "DAILY");
    const weekly = rows.find((row) => row.frequency === "WEEKLY");
    const monthly = rows.find((row) => row.frequency === "MONTHLY");
    expect(daily).toMatchObject({ enabled: false, retainCount: 3 });
    expect(weekly).toMatchObject({ enabled: false, retainCount: 8 });
    expect(monthly).toMatchObject({ enabled: false, retainCount: 12 });
    expect(rows).toHaveLength(3);
  });

  it("backfills only institutions that are missing a schedule", async () => {
    const schoolId = await makeSchool();
    const first = await provisionMissingBackupSchedules(schoolId);
    expect(first).toEqual({ schools: 1, created: 3 });
    const daily = await prisma.backupSchedule.findUnique({
      where: { schoolId_frequency: { schoolId, frequency: "DAILY" } },
    });
    expect(daily?.enabled).toBe(true);
    expect(daily?.retainCount).toBe(14);

    const second = await provisionMissingBackupSchedules(schoolId);
    const still = await prisma.backupSchedule.findUnique({
      where: { schoolId_frequency: { schoolId, frequency: "DAILY" } },
    });
    expect(second.created).toBe(0);
    expect(still?.id).toBe(daily?.id);
    expect(still?.retainCount).toBe(14);
  });
});
