import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type ReceiptDb = {
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};

export function formatReceiptNumber(year: number, sequence: number): string {
  return `RCP-${year}-${String(sequence).padStart(5, "0")}`;
}

/** Plain RCP-YYYY-##### only. Suffixed historical numbers such as -R are ignored. */
export function plainReceiptSequence(receiptNumber: string, year: number): number | null {
  const match = new RegExp(`^RCP-${year}-(\\d+)$`).exec(receiptNumber);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Salaries",
  "Telephone",
  "Internet",
  "Electricity",
  "Water",
  "Rent",
  "Stationery",
  "Teaching materials",
  "IT equipment",
  "Software subscriptions",
  "Transport",
  "Repairs",
  "Maintenance",
  "Security",
  "Insurance",
  "Marketing",
  "Bank fees",
  "Other",
];

export const DEFAULT_INCOME_CATEGORIES = [
  "Donations",
  "Grants",
  "Rentals",
  "Events",
  "Sponsorships",
  "Application fees",
  "Sales",
  "Other income",
];

export async function ensureFinanceCatalog(schoolId: string) {
  const [expenseCount, incomeCount, accountCount] = await Promise.all([
    prisma.expenseCategory.count({ where: { schoolId } }),
    prisma.incomeCategory.count({ where: { schoolId } }),
    prisma.financialAccount.count({ where: { schoolId } }),
  ]);

  if (expenseCount === 0) {
    await prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
        schoolId,
        name,
        isSystem: true,
      })),
    });
  }
  if (incomeCount === 0) {
    await prisma.incomeCategory.createMany({
      data: DEFAULT_INCOME_CATEGORIES.map((name) => ({
        schoolId,
        name,
        isSystem: true,
      })),
    });
  }
  if (accountCount === 0) {
    await prisma.financialAccount.create({
      data: { schoolId, name: "Main bank account", type: "BANK" },
    });
  }
}

export async function nextReceiptNumber(schoolId: string, db: ReceiptDb = prisma, year = new Date().getFullYear()): Promise<string> {
  const pattern = `^RCP-${year}-([0-9]+)$`;
  const whole = `^RCP-${year}-[0-9]+$`;
  const rows = await db.$queryRaw<Array<{ lastNumber: number }>>`
    WITH seed AS (
      SELECT COALESCE(MAX(CAST(substring("receiptNumber" FROM ${pattern}) AS INTEGER)), 0) AS n
      FROM "payments"
      WHERE "schoolId" = ${schoolId}
        AND "receiptNumber" ~ ${whole}
    )
    INSERT INTO "receipt_sequences" ("schoolId", "year", "lastNumber")
    SELECT ${schoolId}, ${year}, (SELECT n FROM seed) + 1
    ON CONFLICT ("schoolId", "year") DO UPDATE
    SET "lastNumber" = GREATEST("receipt_sequences"."lastNumber", (SELECT n FROM seed)) + 1
    RETURNING "lastNumber"
  `;
  const sequence = Number(rows[0]?.lastNumber);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Could not allocate a receipt number");
  }
  return formatReceiptNumber(year, sequence);
}

export async function nextCreditNoteNumber(
  schoolId: string,
  db: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.creditNote.count({ where: { schoolId } });
  return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextPayslipNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.payslip.count({
    where: { item: { run: { schoolId } } },
  });
  return `PS-${year}-${String(count + 1).padStart(5, "0")}`;
}
