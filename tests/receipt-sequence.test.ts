import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { formatReceiptNumber, nextReceiptNumber, plainReceiptSequence } from "@/lib/finance-catalog";

describe("receipt number format", () => {
  it("keeps a fixed width and ignores suffixed historical numbers", () => {
    expect(formatReceiptNumber(2026, 12)).toBe("RCP-2026-00012");
    expect(plainReceiptSequence("RCP-2026-00012", 2026)).toBe(12);
    expect(plainReceiptSequence("RCP-2026-00012-R", 2026)).toBeNull();
    expect(plainReceiptSequence("RCP-2026-00012-REV", 2026)).toBeNull();
    expect(plainReceiptSequence("RCP-2025-00012", 2026)).toBeNull();
  });
});

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb("receipt sequences", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const year = 2026;
  const createdSchoolIds: string[] = [];

  afterAll(async () => {
    if (createdSchoolIds.length) {
      await prisma.receiptSequence.deleteMany({ where: { schoolId: { in: createdSchoolIds } } });
      await prisma.school.deleteMany({ where: { id: { in: createdSchoolIds } } });
    }
    await prisma.$disconnect();
  });

  async function makeSchool(label: string) {
    const school = await prisma.school.create({
      data: {
        name: `Receipt sequence ${label}`,
        slug: `receipt-seq-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
      select: { id: true },
    });
    createdSchoolIds.push(school.id);
    return school.id;
  }

  it("allocates unique numbers for two schools at the same time", async () => {
    const [schoolA, schoolB] = await Promise.all([makeSchool("a"), makeSchool("b")]);
    await prisma.payment.create({
      data: {
        schoolId: schoolA,
        invoiceId: await invoiceFor(prisma, schoolA),
        amount: 10,
        method: "CASH",
        receiptNumber: "RCP-2026-00004-R",
      },
    });
    await prisma.payment.create({
      data: {
        schoolId: schoolA,
        invoiceId: await invoiceFor(prisma, schoolA),
        amount: 10,
        method: "CASH",
        receiptNumber: "RCP-2026-00007",
      },
    });

    const [fromA, fromB] = await Promise.all([
      Promise.all(Array.from({ length: 8 }, () => nextReceiptNumber(schoolA, prisma, year))),
      Promise.all(Array.from({ length: 8 }, () => nextReceiptNumber(schoolB, prisma, year))),
    ]);

    expect(new Set(fromA).size).toBe(8);
    expect(new Set(fromB).size).toBe(8);
    expect(fromA.sort()).toEqual([
      "RCP-2026-00008",
      "RCP-2026-00009",
      "RCP-2026-00010",
      "RCP-2026-00011",
      "RCP-2026-00012",
      "RCP-2026-00013",
      "RCP-2026-00014",
      "RCP-2026-00015",
    ]);
    expect(fromB.sort()[0]).toBe("RCP-2026-00001");
    expect(fromA.some((number) => fromB.includes(number))).toBe(true);
    expect(fromA).not.toContain("RCP-2026-00004-R");
  });
});

async function invoiceFor(prisma: PrismaClient, schoolId: string) {
  const student = await prisma.student.create({
    data: {
      schoolId,
      studentNumber: `RS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      firstName: "Receipt",
      lastName: "Test",
    },
    select: { id: true },
  });
  const invoice = await prisma.invoice.create({
    data: {
      schoolId,
      studentId: student.id,
      invoiceNumber: `INV-RS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      subtotal: 100,
      total: 100,
      amountPaid: 0,
      status: "SENT",
    },
    select: { id: true },
  });
  return invoice.id;
}
