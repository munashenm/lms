import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { hasPermission } from "@/lib/rbac";
import { permissionModule, navHrefModule } from "@/lib/modules";
import { paymentRequiresVerification, splitPaymentAgainstInvoice, PAYMENT_METHOD_LABELS } from "@/lib/finance";
import { getAdminNav, getTeacherNav, getStudentNav } from "@/lib/navigation";
import { isAllowedHomeworkFile } from "@/lib/homework-upload";
import { toExcelCsv } from "@/lib/csv";

describe("LMS extension modules", () => {
  it("requires EFT verification and splits overpayments into credit", () => {
    expect(paymentRequiresVerification("EFT")).toBe(true);
    expect(paymentRequiresVerification("CASH")).toBe(false);
    expect(splitPaymentAgainstInvoice(1200, 1000)).toEqual({ applied: 1000, credit: 200 });
    expect(splitPaymentAgainstInvoice(400, 1000)).toEqual({ applied: 400, credit: 0 });
  });

  it("exposes Paystack as a payment method and new permission keys", () => {
    expect(PAYMENT_METHOD_LABELS.PAYSTACK).toBe("Paystack");
    expect(PAYMENT_METHOD_LABELS.PAYFAST).toBe("PayFast");
    expect(hasPermission(UserRole.FINANCE_OFFICER, "finance.payments.approve")).toBe(true);
    expect(hasPermission(UserRole.TEACHER, "finance.payments.approve")).toBe(false);
    expect(hasPermission(UserRole.TEACHER, "homework.grade")).toBe(true);
    expect(hasPermission(UserRole.TEACHER, "messaging.bulk_send")).toBe(false);
    expect(hasPermission(UserRole.SCHOOL_ADMIN, "sms.settings")).toBe(true);
    expect(permissionModule("messaging.send")).toBe("messaging");
    expect(permissionModule("sms.send")).toBe("sms");
    expect(permissionModule("backup.create")).toBe("backup");
    expect(navHrefModule("/admin/messages")).toBe("messaging");
    expect(navHrefModule("/admin/sms")).toBe("sms");
    expect(navHrefModule("/admin/settings/backup")).toBe("backup");
  });

  it("adds the new sidebar destinations", () => {
    const admin = getAdminNav();
    expect(admin.some((item) => item.href === "/admin/finance/payments")).toBe(true);
    expect(admin.some((item) => item.href === "/admin/messages")).toBe(true);
    expect(admin.some((item) => item.href === "/admin/sms")).toBe(true);
    expect(admin.some((item) => item.href === "/admin/homework")).toBe(true);
    expect(getTeacherNav().some((item) => item.href === "/teacher/homework")).toBe(true);
    expect(getStudentNav().some((item) => item.href === "/student/messages")).toBe(true);
  });

  it("accepts office homework files and builds an Excel CSV export", () => {
    expect(isAllowedHomeworkFile(new File(["x"], "notes.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }))).toBe(true);
    const excel = toExcelCsv(["A"], [["1"]]);
    expect(excel.startsWith("\uFEFF")).toBe(true);
  });
});
