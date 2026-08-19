import { describe, expect, it } from "vitest";
import {
  assertPaidAtAcceptable,
  collectedPaymentsForInvoice,
  digitsOnly,
  feeCollectionSearchWhere,
  invoiceSchoolDetailLines,
  isCollectableInvoiceStatus,
  mapFeeCollectionInvoice,
  parseCollectionPaidAt,
  toPublicFeeCollectionStudent,
} from "@/lib/fee-collection";
import { johannesburgDatetimeLocalValue } from "@/lib/utils";

describe("fee collection search", () => {
  it("requires a query or class before listing learners", () => {
    expect(feeCollectionSearchWhere({ query: "" })).toBeNull();
    expect(feeCollectionSearchWhere({ query: "T" })).toBeNull();
  });

  it("matches admission number, names, ID digits and class name", () => {
    const where = feeCollectionSearchWhere({
      schoolId: "sch-1",
      query: "STD20260001",
    });
    expect(where?.schoolId).toBe("sch-1");
    expect(where?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ studentNumber: expect.objectContaining({ contains: "STD20260001" }) }),
        expect.objectContaining({ firstName: expect.objectContaining({ contains: "STD20260001" }) }),
        expect.objectContaining({
          class: expect.objectContaining({
            is: expect.objectContaining({ name: expect.objectContaining({ contains: "STD20260001" }) }),
          }),
        }),
      ])
    );
  });

  it("searches SA ID numbers by digits and split first/last names", () => {
    const where = feeCollectionSearchWhere({ query: "Thabo Mokoena 8001015009087" });
    const or = where?.OR ?? [];
    expect(digitsOnly("800101 5009087")).toBe("8001015009087");
    expect(or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ saIdNumber: { contains: "8001015009087" } }),
        expect.objectContaining({
          AND: [
            expect.objectContaining({ firstName: expect.objectContaining({ contains: "Thabo" }) }),
            expect.objectContaining({ lastName: expect.objectContaining({ contains: "Mokoena" }) }),
          ],
        }),
      ])
    );
  });

  it("lists a class without a text query", () => {
    const where = feeCollectionSearchWhere({ query: "", classId: "class-10a" });
    expect(where).toMatchObject({ classId: "class-10a" });
    expect(where?.OR).toBeUndefined();
  });

  it("loads a specific learner by id", () => {
    expect(feeCollectionSearchWhere({ query: "", studentId: "stu-1" })).toMatchObject({
      id: "stu-1",
    });
  });
});

describe("fee collection public records", () => {
  it("masks the ID number and only returns collectable outstanding invoices", () => {
    const student = toPublicFeeCollectionStudent({
      id: "stu-1",
      studentNumber: "STD1",
      firstName: "Thabo",
      lastName: "Mokoena",
      saIdNumber: "8001015009087",
      classId: "c1",
      grade: { name: "Grade 10" },
      class: { name: "10A" },
      invoices: [
        {
          id: "inv-open",
          invoiceNumber: "INV-1",
          description: "Tuition",
          status: "SENT",
          total: 1000,
          amountPaid: 250,
          dueDate: null,
          issuedAt: new Date("2026-02-01T08:00:00+02:00"),
        },
        {
          id: "inv-paid",
          invoiceNumber: "INV-2",
          description: "Sports",
          status: "PAID",
          total: 200,
          amountPaid: 200,
          dueDate: null,
          issuedAt: new Date("2026-02-01T08:00:00+02:00"),
        },
        {
          id: "inv-draft",
          invoiceNumber: "INV-3",
          description: "Draft",
          status: "DRAFT",
          total: 50,
          amountPaid: 0,
          dueDate: null,
          issuedAt: new Date("2026-02-01T08:00:00+02:00"),
        },
      ],
    });

    expect(student.identityNumber).toBe("8001••••87");
    expect(student.invoices.map((row) => row.id)).toEqual(["inv-open"]);
    expect(student.outstandingTotal).toBe(750);
    expect(isCollectableInvoiceStatus("OVERDUE")).toBe(true);
    expect(isCollectableInvoiceStatus("PAID")).toBe(false);
  });

  it("maps invoice outstanding from decimal-like values", () => {
    const mapped = mapFeeCollectionInvoice({
      id: "inv-1",
      invoiceNumber: "INV-1",
      description: null,
      status: "PARTIALLY_PAID",
      total: { toString: () => "1500.00" },
      amountPaid: { toString: () => "500.50" },
      dueDate: null,
      issuedAt: "2026-03-01T10:15:00+02:00",
    });
    expect(mapped.outstanding).toBe(999.5);
  });
});

describe("collection timestamps", () => {
  it("treats datetime-local values as Africa/Johannesburg", () => {
    const paidAt = parseCollectionPaidAt("2026-08-19T14:05");
    expect(paidAt?.toISOString()).toBe("2026-08-19T12:05:00.000Z");
  });

  it("accepts ISO timestamps with an offset", () => {
    const paidAt = parseCollectionPaidAt("2026-08-19T14:05:00+02:00");
    expect(paidAt?.toISOString()).toBe("2026-08-19T12:05:00.000Z");
  });

  it("rejects a future collection time", () => {
    const future = new Date("2030-01-01T10:00:00Z");
    expect(assertPaidAtAcceptable(future, new Date("2026-08-19T10:00:00Z"))).toMatch(/future/i);
    expect(assertPaidAtAcceptable(new Date("2026-08-19T09:00:00Z"), new Date("2026-08-19T10:00:00Z"))).toBeNull();
  });

  it("builds a datetime-local value in Johannesburg", () => {
    expect(johannesburgDatetimeLocalValue("2026-08-19T12:05:00.000Z")).toBe("2026-08-19T14:05");
  });
});

describe("invoice school and collection rows", () => {
  it("prints school address, contact and registration", () => {
    expect(
      invoiceSchoolDetailLines({
        name: "Sunrise High",
        address: "1 School Rd",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2000",
        phone: "011 000 0000",
        email: "fees@sunrise.example",
        registrationNo: "EMIS-1",
      })
    ).toEqual([
      "Sunrise High",
      "1 School Rd, Johannesburg, Gauteng, 2000",
      "011 000 0000 · fees@sunrise.example",
      "Registration: EMIS-1",
    ]);
  });

  it("omits reversed receipts from the invoice collection list", () => {
    const rows = collectedPaymentsForInvoice([
      { id: "p1", reversedAt: null, reversalOfId: null },
      { id: "p2", reversedAt: new Date(), reversalOfId: null },
      { id: "p3", reversedAt: null, reversalOfId: "p1" },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["p1"]);
  });
});
