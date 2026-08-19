import { prisma } from "./db";

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

export async function nextReceiptNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const last = await prisma.payment.findFirst({
    where: { schoolId, receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const seq = last?.receiptNumber ? Number(last.receiptNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(5, "0")}`;
}

export async function nextCreditNoteNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.creditNote.count({ where: { schoolId } });
  return `CN-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextPayslipNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.payslip.count({
    where: { item: { run: { schoolId } } },
  });
  return `PS-${year}-${String(count + 1).padStart(5, "0")}`;
}
