import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { SCHEDULED_JOBS } from "@/lib/scheduler/catalog";
import { IMPORT_FILE_CLEANUP_STATUSES, cleanupExpiredImportFiles } from "@/lib/integrations/sasams/security";
import { ensureLeaveEntitlement } from "@/lib/leave-entitlement";
import { generateOneRecurringExpense } from "@/lib/recurring-expenses";
import { prisma } from "@/lib/db";

describe("held scheduler jobs stay off", () => {
  it("does not enable import cleanup, leave accrual, or recurring expenses", () => {
    expect(SCHEDULED_JOBS.filter((job) => !job.automatic).map((job) => job.key)).toEqual([
      "import-cleanup",
      "leave-accrual",
      "recurring-expenses",
    ]);
    expect(IMPORT_FILE_CLEANUP_STATUSES).toEqual(["COMPLETED", "FAILED", "ROLLED_BACK"]);
    expect(IMPORT_FILE_CLEANUP_STATUSES).not.toContain("IMPORTING");
  });
});

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("held job duplicate safety", () => {
  const schoolIds: string[] = [];

  afterAll(async () => {
    if (schoolIds.length) await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    await prisma.$disconnect();
  });

  async function makeSchool() {
    const school = await prisma.school.create({
      data: {
        name: "Held job safety",
        slug: `held-job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
      select: { id: true },
    });
    schoolIds.push(school.id);
    return school.id;
  }

  it("keeps one leave entitlement when accrual runs twice", async () => {
    const schoolId = await makeSchool();
    const employee = await prisma.employee.create({
      data: { schoolId, employeeNumber: "E-1", firstName: "Leave", lastName: "Test" },
      select: { id: true },
    });
    const policy = await prisma.leavePolicy.create({
      data: { schoolId, leaveType: "ANNUAL", name: "Annual", daysPerYear: 15, accrualMethod: "YEARLY" },
    });
    const asOf = new Date("2026-10-10T00:00:00.000Z");
    const [first, second] = await Promise.all([
      ensureLeaveEntitlement({ employeeId: employee.id, policy, cycleYear: 2026, asOf }),
      ensureLeaveEntitlement({ employeeId: employee.id, policy, cycleYear: 2026, asOf }),
    ]);
    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    await prisma.leaveEntitlement.update({ where: { id: first.id }, data: { taken: 2 } });
    await ensureLeaveEntitlement({ employeeId: employee.id, policy, cycleYear: 2026, asOf });
    const rows = await prisma.leaveEntitlement.findMany({
      where: { employeeId: employee.id, leavePolicyId: policy.id, cycleYear: 2026 },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].accrued)).toBe(15);
    expect(Number(rows[0].taken)).toBe(2);
  });

  it("creates one expense when the same recurring due date is generated twice", async () => {
    const schoolId = await makeSchool();
    const due = new Date("2026-10-01T00:00:00.000Z");
    const recurring = await prisma.recurringExpense.create({
      data: { schoolId, description: "Rent", amount: 1000, nextDueDate: due, interval: "MONTHLY" },
      select: { id: true },
    });
    const [a, b] = await Promise.all([
      generateOneRecurringExpense({ recurringExpenseId: recurring.id, schoolId }),
      generateOneRecurringExpense({ recurringExpenseId: recurring.id, schoolId }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const expenses = await prisma.expense.findMany({ where: { recurringExpenseId: recurring.id } });
    expect(expenses).toHaveLength(1);
    expect(Number(expenses[0].amount)).toBe(1000);
    const updated = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: recurring.id } });
    expect(updated.nextDueDate.getTime()).toBeGreaterThan(due.getTime());
  });

  it("removes expired files for finished imports and keeps an import that is still open", async () => {
    const schoolId = await makeSchool();
    const dir = await mkdtemp(path.join(tmpdir(), "schoolhub-import-"));
    const openPath = path.join(dir, "open.bin");
    const donePath = path.join(dir, "done.bin");
    await writeFile(openPath, "open");
    await writeFile(donePath, "done");
    const past = new Date("2026-01-01T00:00:00.000Z");
    await prisma.importJob.createMany({
      data: [
        {
          schoolId,
          adapterId: "test",
          filename: "open.csv",
          status: "IMPORTING",
          expiresAt: past,
          encryptedStorageKey: openPath,
        },
        {
          schoolId,
          adapterId: "test",
          filename: "done.csv",
          status: "COMPLETED",
          expiresAt: past,
          encryptedStorageKey: donePath,
        },
      ],
    });
    const removed = await cleanupExpiredImportFiles(new Date("2026-10-10T00:00:00.000Z"));
    expect(removed).toBe(1);
    expect(await readFile(openPath, "utf8")).toBe("open");
    await expect(readFile(donePath, "utf8")).rejects.toThrow();
    const jobs = await prisma.importJob.findMany({ where: { schoolId }, orderBy: { filename: "asc" } });
    expect(jobs.find((job) => job.filename === "open.csv")?.encryptedStorageKey).toBe(openPath);
    expect(jobs.find((job) => job.filename === "done.csv")?.encryptedStorageKey).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });
});
