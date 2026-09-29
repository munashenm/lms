/** Public SaaS packaging — transparent pricing bands (ZAR, published). */

export type PricingTierId =
  | "core"
  | "family"
  | "fees"
  | "professional"
  | "college"
  | "compliance"
  | "group";

export type PricingTier = {
  id: PricingTierId;
  name: string;
  tagline: string;
  monthlyFromZar: number;
  perLearnerZar: number;
  highlighted?: boolean;
  includes: string[];
  excludes?: string[];
};

export const PRICING_CURRENCY = "ZAR";

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "core",
    name: "Core Campus",
    tagline: "Records, teaching, reports and backup for a single campus.",
    monthlyFromZar: 1490,
    perLearnerZar: 8,
    includes: [
      "Learner / student records",
      "Academics, attendance, assessments",
      "Public website pages",
      "Report cards & certificates (PDF)",
      "Encrypted backup",
    ],
  },
  {
    id: "family",
    name: "Core + Family",
    tagline: "Parent and learner portals with messaging.",
    monthlyFromZar: 1990,
    perLearnerZar: 11,
    includes: [
      "Everything in Core Campus",
      "Parent / sponsor portal",
      "Learner / student portal",
      "In-app messaging & announcements",
    ],
  },
  {
    id: "fees",
    name: "Core + Fees",
    tagline: "Collect desk, statements and online pay.",
    monthlyFromZar: 2290,
    perLearnerZar: 12,
    includes: [
      "Everything in Core Campus",
      "Fee schedules & invoices",
      "Collect desk (cash / EFT / card)",
      "PayFast & Paystack",
      "Debtors & fee reminders",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "Family + fees + HR/payroll for growing schools.",
    monthlyFromZar: 3490,
    perLearnerZar: 15,
    highlighted: true,
    includes: [
      "Family + Fees modules",
      "HR, leave & timesheets",
      "Payroll & branded payslips",
      "SMS bundle (metered usage)",
      "Visitors book",
    ],
  },
  {
    id: "college",
    name: "College",
    tagline: "TVET / private college language, modules and exams.",
    monthlyFromZar: 3990,
    perLearnerZar: 16,
    includes: [
      "Everything in Professional",
      "Programmes / modules / semesters",
      "Online examinations",
      "Certificates of completion",
    ],
  },
  {
    id: "compliance",
    name: "Compliance Pack",
    tagline: "SA-SAMS export, LURITS feedback and CEMIS MVP.",
    monthlyFromZar: 890,
    perLearnerZar: 0,
    includes: [
      "Compliance Centre",
      "EMIS field validation",
      "SA-SAMS tabular export",
      "LURITS feedback import",
      "CEMIS marks export (WCape MVP)",
      "Promotion → LURITS batch",
    ],
    excludes: ["Does not replace SA-SAMS or Valistractor as DBE filing tools"],
  },
  {
    id: "group",
    name: "Group",
    tagline: "Multi-institution Super Admin and licence control.",
    monthlyFromZar: 0,
    perLearnerZar: 0,
    includes: [
      "Multi-campus tenancy",
      "Central licence server",
      "Module toggles per institution",
      "Volume discount on Professional / College",
    ],
  },
];

export const PRICING_NOTES = [
  "Prices are indicative published bands in South African Rand (ex VAT). Final quotes may vary by learner count and SMS volume.",
  "SMS, biometric hardware, WhatsApp and AI features are metered or project-based — not included by default.",
  "Compliance Pack is an add-on for schools that submit via SA-SAMS / LURITS / CEMIS.",
  "Group pricing is quote-based on campus count; contact sales for a written proposal.",
];

export function estimateMonthlyZar(tierId: PricingTierId, activeLearners: number): number | null {
  const tier = PRICING_TIERS.find((t) => t.id === tierId);
  if (!tier || tier.id === "group") return null;
  const learners = Math.max(0, Math.floor(activeLearners));
  return tier.monthlyFromZar + tier.perLearnerZar * learners;
}