import { UserRole } from "@prisma/client";
import { canAccessAdmin, canAccessFinance } from "./rbac";

/** Invoice detail/list base path for the caller's portal (avoids /admin walls for finance). */
export function invoiceBasePathForRole(role: UserRole): string {
  if (canAccessFinance(role) && !canAccessAdmin(role)) {
    return "/finance/invoices";
  }
  if (canAccessFinance(role) || canAccessAdmin(role)) {
    return "/admin/finance/invoices";
  }
  return "/finance/invoices";
}

export function invoiceHrefForRole(role: UserRole, invoiceId: string): string {
  return `${invoiceBasePathForRole(role)}/${invoiceId}`;
}

/** Applications board lives under admin; finance officers use deposit invoices instead. */
export function admissionsHomeForRole(role: UserRole): string {
  if (canAccessAdmin(role)) return "/admin/applications";
  if (canAccessFinance(role)) return "/finance/invoices";
  return "/admin/applications";
}
