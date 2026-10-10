import { afterAll, describe, expect, it } from "vitest";
import {
  backupCoverageNote,
  dailyBackupEnabledForLicenseStatus,
  paidBackupCoverageMessage,
} from "@/lib/backup/coverage";
import { enableDailyBackupsForPaidLicence, ensureDefaultSchedules } from "@/lib/backup/schedule";
import { prisma } from "@/lib/db";

describe("backup coverage policy", () => {
  it("turns automatic daily backups on only for a paid licence", () => {
    expect(dailyBackupEnabledForLicenseStatus("ACTIVE")).toBe(true);
    expect(dailyBackupEnabledForLicenseStatus("TRIAL")).toBe(false);
    expect(dailyBackupEnabledForLicenseStatus("GRACE")).toBe(false);
    expect(dailyBackupEnabledForLicenseStatus(null)).toBe(false);
  });

  it("explains trial and paid coverage without hiding restore", () => {
    expect(backupCoverageNote({ licenseStatus: "TRIAL", dailyEnabled: false, retainCount: 14 })).toContain("free trial");
    expect(backupCoverageNote({ licenseStatus: "TRIAL", dailyEnabled: false, retainCount: 14 })).toContain("restore");
    expect(backupCoverageNote({ licenseStatus: "ACTIVE", dailyEnabled: true, retainCount: 14 })).toContain("14");
    expect(paidBackupCoverageMessage({ enabledNow: true, retainCount: 7 }).message).toContain("7");
    expect(paidBackupCoverageMessage({ enabledNow: false, retainCount: 14 }).title).toBe("Daily backups unchanged");
  });
});

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("backup schedules follow the licence and keep saved rows", () => {
  const schoolIds: string[] = [];

  afterAll(async () => {
    if (schoolIds.length) await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    await prisma.$disconnect();
  });

  async function makeSchool(status: "TRIAL" | "ACTIVE") {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const school = await prisma.school.create({
      data: { name: "Coverage school", slug: `coverage-${stamp}` },
      select: { id: true },
    });
    schoolIds.push(school.id);
    await prisma.schoolLicense.create({
      data: {
        schoolId: school.id,
        licenseKey: `LIC-${stamp}`,
        status,
        planCode: status === "ACTIVE" ? "standard" : "trial",
      },
    });
    await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `admin-${stamp}@example.test`,
        passwordHash: "not-a-login",
        firstName: "Ada",
        lastName: "Admin",
        role: "SCHOOL_ADMIN",
      },
    });
    return school.id;
  }

  it("creates a disabled daily schedule for a trial and does not turn an existing one off", async () => {
    const schoolId = await makeSchool("TRIAL");
    expect(await ensureDefaultSchedules(schoolId)).toBe(3);
    const daily = await prisma.backupSchedule.findUniqueOrThrow({
      where: { schoolId_frequency: { schoolId, frequency: "DAILY" } },
    });
    expect(daily.enabled).toBe(false);
    expect(daily.retainCount).toBe(14);

    await prisma.backupSchedule.update({
      where: { id: daily.id },
      data: { enabled: true, retainCount: 4 },
    });
    expect(await ensureDefaultSchedules(schoolId)).toBe(0);
    const kept = await prisma.backupSchedule.findUniqueOrThrow({ where: { id: daily.id } });
    expect(kept.enabled).toBe(true);
    expect(kept.retainCount).toBe(4);
    expect(await prisma.backupJob.count({ where: { schoolId } })).toBe(0);
  });

  it("creates an enabled daily schedule for a paid school and does not turn a saved choice back on", async () => {
    const schoolId = await makeSchool("ACTIVE");
    await ensureDefaultSchedules(schoolId);
    const daily = await prisma.backupSchedule.findUniqueOrThrow({
      where: { schoolId_frequency: { schoolId, frequency: "DAILY" } },
    });
    expect(daily).toMatchObject({ enabled: true, retainCount: 14 });
    await prisma.backupSchedule.update({ where: { id: daily.id }, data: { enabled: false, retainCount: 9 } });
    await ensureDefaultSchedules(schoolId);
    const kept = await prisma.backupSchedule.findUniqueOrThrow({ where: { id: daily.id } });
    expect(kept.enabled).toBe(false);
    expect(kept.retainCount).toBe(9);
  });

  it("enables daily backups when a trial becomes paid and leaves an already enabled schedule alone", async () => {
    const turningOn = await makeSchool("ACTIVE");
    await prisma.backupSchedule.create({
      data: {
        schoolId: turningOn,
        frequency: "DAILY",
        enabled: false,
        retainCount: 3,
        nextRunAt: new Date("2026-10-01T00:00:00.000Z"),
      },
    });
    const enabled = await enableDailyBackupsForPaidLicence(turningOn);
    expect(enabled).toEqual({ changed: true, retainCount: 3 });
    const daily = await prisma.backupSchedule.findUniqueOrThrow({
      where: { schoolId_frequency: { schoolId: turningOn, frequency: "DAILY" } },
    });
    expect(daily.enabled).toBe(true);
    expect(daily.retainCount).toBe(3);
    const weekly = await prisma.backupSchedule.findUnique({
      where: { schoolId_frequency: { schoolId: turningOn, frequency: "WEEKLY" } },
    });
    expect(weekly?.enabled).toBe(false);
    expect(
      await prisma.notification.count({ where: { schoolId: turningOn, title: "Daily backups are on" } })
    ).toBe(1);

    const already = await makeSchool("ACTIVE");
    await prisma.backupSchedule.create({
      data: { schoolId: already, frequency: "DAILY", enabled: true, retainCount: 7, nextRunAt: new Date() },
    });
    const unchanged = await enableDailyBackupsForPaidLicence(already);
    expect(unchanged).toEqual({ changed: false, retainCount: 7 });
    const kept = await prisma.backupSchedule.findUniqueOrThrow({
      where: { schoolId_frequency: { schoolId: already, frequency: "DAILY" } },
    });
    expect(kept.enabled).toBe(true);
    expect(kept.retainCount).toBe(7);
    expect(
      await prisma.notification.count({ where: { schoolId: already, title: "Daily backups unchanged" } })
    ).toBe(1);
    expect(await prisma.backupJob.count({ where: { schoolId: { in: [turningOn, already] } } })).toBe(0);
  });
});
