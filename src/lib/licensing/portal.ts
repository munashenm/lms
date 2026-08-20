import type { NavItem } from "@/lib/navigation";
import { normalizeFeatures, type LicenseFeatureKey } from "./features";
import type { EvaluatedLicense } from "./types";

export function isFeatureEnabled(
  evaluation: EvaluatedLicense | null | undefined,
  feature: LicenseFeatureKey
): boolean {
  if (!evaluation?.claims) return true;
  return normalizeFeatures(evaluation.claims.features)[feature] !== false;
}

export function navHrefFeature(href: string): LicenseFeatureKey | null {
  if (href.includes("/applications")) return "admissions";
  if (href.includes("/finance") || href.includes("/fees") || href.includes("/debtors") || href.includes("/ledger") || href.includes("/expenses") || href.includes("/structures")) {
    return "finance";
  }
  if (
    href.includes("/hr") ||
    href.includes("/payroll") ||
    href.includes("/payslips") ||
    href.includes("/leave-policies") ||
    href.includes("/timesheets") ||
    href.includes("/staff/leave")
  ) {
    return "hr_payroll";
  }
  if (
    href.includes("/assessments") ||
    href.includes("/assignments") ||
    href.includes("/results") ||
    href.includes("/report-cards") ||
    href.includes("/certificates") ||
    href.includes("/exams")
  ) {
    return "assessments";
  }
  if (href.includes("/attendance") && !href.includes("staff-attendance")) return "attendance";
  if (href.includes("/timetable")) return "timetable";
  if (href.includes("/reviews")) return "teacher_reviews";
  if (href.includes("/downloads")) return "download_centre";
  if (
    href.includes("/learner-leave") ||
    href === "/student/leave" ||
    href.startsWith("/student/leave/") ||
    href === "/parent/leave" ||
    href.startsWith("/parent/leave/")
  ) {
    return "student_leave";
  }
  if (href.includes("/visitor")) return "visitor_management";
  if (href.includes("/messages")) return "messaging";
  if (href === "/admin/reports" || href.startsWith("/admin/reports/")) return "reporting";
  return null;
}

export function filterNavByLicense(
  items: NavItem[],
  evaluation: EvaluatedLicense | null | undefined
): NavItem[] {
  if (!evaluation?.claims) return items;
  return items.filter((item) => {
    const feature = navHrefFeature(item.href);
    if (!feature) return true;
    // HR screens stay in the menu even when the module flag was issued off.
    if (feature === "hr_payroll") return true;
    return isFeatureEnabled(evaluation, feature);
  });
}

export function licenseBannerTone(
  evaluation: EvaluatedLicense | null | undefined
): "restricted" | "grace" | "warning" | null {
  if (!evaluation) return null;
  if (evaluation.restricted) return "restricted";
  if (evaluation.effectiveStatus === "GRACE") return "grace";
  if (evaluation.warnings.length > 0) return "warning";
  return null;
}
