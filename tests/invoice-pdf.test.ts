import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateInvoicePdf } from "@/lib/pdf-invoice";

function inflatePdfStreams(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const chunks: string[] = [];
  let from = 0;
  while (from < buf.length) {
    const start = buf.indexOf("stream", from, "latin1");
    if (start < 0) break;
    let dataStart = start + 6;
    if (buf[dataStart] === 0x0d) dataStart += 1;
    if (buf[dataStart] === 0x0a) dataStart += 1;
    const end = buf.indexOf("endstream", dataStart, "latin1");
    if (end < 0) break;
    let dataEnd = end;
    if (buf[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (buf[dataEnd - 1] === 0x0d) dataEnd -= 1;
    try {
      chunks.push(inflateSync(buf.subarray(dataStart, dataEnd)).toString("latin1"));
    } catch {
      /* skip non-flate objects */
    }
    from = end + 9;
  }
  return chunks.join("\n");
}

describe("invoice PDF letterhead", () => {
  it("prints the school name, account number and banking details", async () => {
    const pdf = await generateInvoicePdf({
      brand: {
        name: "Cyber Developers College",
        email: "info@college.co.za",
        phone: "087 550 1813",
        address: "123 Education Drive",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        registrationNo: "REG-2020-001",
        bankName: "FNB",
        bankAccountName: "Cyber Developers College",
        bankAccountNumber: "62801234567",
        bankBranchCode: "250655",
      },
      invoiceNumber: "INV-2026-0001",
      statusLabel: "Sent",
      studentName: "Anele Ndlovu",
      studentNumber: "CDC0001",
      issuedAt: "21 Aug 2026",
      lineItems: [{ description: "Tuition", quantity: 1, unitPrice: 2500, amount: 2500 }],
      subtotal: 2500,
      discount: 0,
      total: 2500,
      amountPaid: 0,
      outstanding: 2500,
      paymentReference: "CDC0001",
    });

    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    const hexStrings = [...inflatePdfStreams(pdf).matchAll(/<([0-9A-Fa-f]+)>/g)]
      .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
      .join("\n");
    expect(hexStrings).toContain("Cyber Developers College");
    expect(hexStrings).toContain("62801234567");
    expect(hexStrings).toContain("250655");
    expect(hexStrings).toContain("CDC0001");
    expect(hexStrings).toContain("Account number");
    expect(hexStrings).toContain("Payment reference");
  });
});
