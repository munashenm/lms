export const LICENSE_FEATURE_KEYS = [
  "student_portal",
  "parent_portal",
  "teacher_portal",
  "admissions",
  "finance",
  "assessments",
  "attendance",
  "timetable",
  "library",
  "reporting",
  "ai_features",
  "sms",
  "whatsapp",
  "biometrics",
  "api_access",
  "advanced_analytics",
  "hr_payroll",
] as const;

export type LicenseFeatureKey = (typeof LICENSE_FEATURE_KEYS)[number];

export const LICENSE_FEATURE_LABELS: Record<LicenseFeatureKey, string> = {
  student_portal: "Student Portal",
  parent_portal: "Parent Portal",
  teacher_portal: "Teacher Portal",
  admissions: "Admissions",
  finance: "Finance",
  assessments: "Assessments",
  attendance: "Attendance",
  timetable: "Timetable",
  library: "Library",
  reporting: "Reporting",
  ai_features: "AI features",
  sms: "SMS",
  whatsapp: "WhatsApp",
  biometrics: "Biometrics",
  api_access: "API access",
  advanced_analytics: "Advanced Analytics",
  hr_payroll: "HR & Payroll",
};

export const DEFAULT_LICENSE_FEATURES: Record<LicenseFeatureKey, boolean> = {
  student_portal: true,
  parent_portal: true,
  teacher_portal: true,
  admissions: true,
  finance: true,
  assessments: true,
  attendance: true,
  timetable: true,
  library: false,
  reporting: true,
  ai_features: false,
  sms: false,
  whatsapp: false,
  biometrics: false,
  api_access: false,
  advanced_analytics: false,
  hr_payroll: false,
};

export function normalizeFeatures(
  input?: Record<string, boolean> | null
): Record<LicenseFeatureKey, boolean> {
  const out = { ...DEFAULT_LICENSE_FEATURES };
  if (!input) return out;
  for (const key of LICENSE_FEATURE_KEYS) {
    if (typeof input[key] === "boolean") out[key] = input[key];
  }
  return out;
}

export function isKnownFeature(key: string): key is LicenseFeatureKey {
  return (LICENSE_FEATURE_KEYS as readonly string[]).includes(key);
}
