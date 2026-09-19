import { describe, expect, it } from "vitest";
import { unsealIdentityResult } from "@/lib/pii-prisma";
import { formatDate, formatDateTime, formatZAR, parseDate, toIsoDateInput } from "@/lib/utils";
import { STUDENT_LEDGER_TYPE_LABELS } from "@/lib/student-ledger-labels";

describe("safe date formatting", () => {
  it("renders a valid Johannesburg date", () => {
    expect(formatDate("2026-03-01T00:00:00.000Z")).toMatch(/2026/);
  });

  it("does not throw on invalid or empty dates", () => {
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate(new Date(Number.NaN))).toBe("—");
    expect(formatDateTime("bogus")).toBe("—");
    expect(toIsoDateInput("nope")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("formats invalid money as R0.00", () => {
    expect(formatZAR(Number.NaN)).toBe("R0.00");
  });
});

describe("identity unseal", () => {
  it("skips class instances such as Prisma Decimal-like values", () => {
    class FakeDecimal {
      s = 1;
      e = 0;
      d = [1250];
      toFixed() {
        return "12.50";
      }
    }
    const row = {
      firstName: "Thabo",
      saIdNumber: null,
      average: new FakeDecimal(),
    };
    expect(() => unsealIdentityResult(row)).not.toThrow();
    expect(row.average).toBeInstanceOf(FakeDecimal);
    expect(row.average.toFixed()).toBe("12.50");
  });
});

describe("ledger labels", () => {
  it("stays usable in the browser without Prisma", () => {
    expect(STUDENT_LEDGER_TYPE_LABELS.PAYMENT).toBe("Payment");
    expect(STUDENT_LEDGER_TYPE_LABELS.CHARGE).toBe("Charge");
  });
});
