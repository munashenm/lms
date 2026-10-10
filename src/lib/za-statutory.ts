import { fromCents, roundMoney, toCents } from "./money";

/**
 * Dated South African statutory tables.
 * 2025 and 2026 tax years share the unchanged brackets published by SARS.
 * The 2027 tax year (1 March 2026 – 28 February 2027) is the Budget tax guide 2026.
 * UIF stays 1% each side up to the monthly earnings ceiling. The 2026 guide did not publish a new ceiling.
 * A later year is added by appending a version; existing payroll rows are not rewritten.
 */
export interface ZaTaxBand {
  /** Annual taxable income above this amount falls in the band. */
  above: number;
  base: number;
  rate: number;
}

export interface ZaStatutoryVersion {
  id: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  bands: ZaTaxBand[];
  primaryRebate: number;
  secondaryRebate: number;
  tertiaryRebate: number;
  medicalCredit: { taxpayer: number; firstDependant: number; additional: number };
  uifEmployeePercent: number;
  uifEmployerPercent: number;
  uifMonthlyCeiling: number;
  sdlPercent: number;
  sdlAnnualExemption: number;
}

const TAX_YEARS_2025_2026: ZaTaxBand[] = [
  { above: 0, base: 0, rate: 18 },
  { above: 237_100, base: 42_678, rate: 26 },
  { above: 370_500, base: 77_362, rate: 31 },
  { above: 512_800, base: 121_475, rate: 36 },
  { above: 673_000, base: 179_147, rate: 39 },
  { above: 857_900, base: 251_258, rate: 41 },
  { above: 1_817_000, base: 644_489, rate: 45 },
];

const TAX_YEAR_2027: ZaTaxBand[] = [
  { above: 0, base: 0, rate: 18 },
  { above: 245_100, base: 44_118, rate: 26 },
  { above: 383_100, base: 79_998, rate: 31 },
  { above: 530_200, base: 125_599, rate: 36 },
  { above: 695_800, base: 185_215, rate: 39 },
  { above: 887_000, base: 259_783, rate: 41 },
  { above: 1_878_600, base: 666_339, rate: 45 },
];

export const ZA_STATUTORY_VERSIONS: ZaStatutoryVersion[] = [
  {
    id: "ZA-2025-2026",
    label: "2025 and 2026 tax years",
    effectiveFrom: "2024-03-01",
    effectiveTo: "2026-02-28",
    bands: TAX_YEARS_2025_2026,
    primaryRebate: 17_235,
    secondaryRebate: 9_444,
    tertiaryRebate: 3_145,
    medicalCredit: { taxpayer: 364, firstDependant: 364, additional: 246 },
    uifEmployeePercent: 1,
    uifEmployerPercent: 1,
    uifMonthlyCeiling: 17_712,
    sdlPercent: 1,
    sdlAnnualExemption: 500_000,
  },
  {
    id: "ZA-2027",
    label: "2027 tax year (1 March 2026 – 28 February 2027)",
    effectiveFrom: "2026-03-01",
    effectiveTo: null,
    bands: TAX_YEAR_2027,
    primaryRebate: 17_820,
    secondaryRebate: 9_765,
    tertiaryRebate: 3_249,
    medicalCredit: { taxpayer: 376, firstDependant: 376, additional: 254 },
    uifEmployeePercent: 1,
    uifEmployerPercent: 1,
    uifMonthlyCeiling: 17_712,
    sdlPercent: 1,
    sdlAnnualExemption: 500_000,
  },
];

function utcDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(NaN) : parsed;
}

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Last day of February for the year of assessment that contains `periodEnd`. */
export function yearOfAssessmentEnd(periodEnd: Date): Date {
  const year = periodEnd.getUTCFullYear();
  const endYear = periodEnd.getUTCMonth() >= 2 ? year + 1 : year;
  return new Date(Date.UTC(endYear, 2, 0));
}

export function ageOn(dateOfBirth: Date, on: Date): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

export function statutoryVersionFor(periodEnd: Date | string): ZaStatutoryVersion | null {
  const day = isoDay(utcDate(periodEnd));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return (
    ZA_STATUTORY_VERSIONS.find((version) => {
      if (day < version.effectiveFrom) return false;
      if (version.effectiveTo && day > version.effectiveTo) return false;
      return true;
    }) ?? null
  );
}

export function annualNormalTax(annualTaxable: number, version: ZaStatutoryVersion): number {
  const income = Math.max(0, annualTaxable);
  const band = [...version.bands].reverse().find((row) => income > row.above) ?? version.bands[0];
  return roundMoney(band.base + ((income - band.above) * band.rate) / 100);
}

export function rebateForAge(version: ZaStatutoryVersion, age: number | null): number {
  let rebate = version.primaryRebate;
  if (age != null && age >= 65) rebate += version.secondaryRebate;
  if (age != null && age >= 75) rebate += version.tertiaryRebate;
  return rebate;
}

/** Monthly medical scheme fees tax credit for the number of people covered. */
export function monthlyMedicalCredit(version: ZaStatutoryVersion, members: number): number {
  const count = Math.max(0, Math.floor(members));
  if (count <= 0) return 0;
  if (count === 1) return version.medicalCredit.taxpayer;
  return roundMoney(
    version.medicalCredit.taxpayer +
      version.medicalCredit.firstDependant +
      version.medicalCredit.additional * (count - 2)
  );
}

export function monthlyEmployeesTax(params: {
  version: ZaStatutoryVersion;
  monthlyGross: number;
  dateOfBirth?: Date | string | null;
  periodEnd: Date | string;
  medicalSchemeMembers?: number;
}): { monthlyPaye: number; age: number | null; versionId: string; primaryRebateOnly: boolean } {
  const periodEnd = utcDate(params.periodEnd);
  const birth = params.dateOfBirth ? utcDate(params.dateOfBirth) : null;
  const age = birth && !Number.isNaN(birth.getTime()) ? ageOn(birth, yearOfAssessmentEnd(periodEnd)) : null;
  const annualTaxable = roundMoney(params.monthlyGross * 12);
  const tax = annualNormalTax(annualTaxable, params.version);
  const rebate = rebateForAge(params.version, age);
  const credit = monthlyMedicalCredit(params.version, params.medicalSchemeMembers ?? 0);
  const annualPayableCents = Math.max(0, toCents(tax) - toCents(rebate) - toCents(credit) * 12);
  return {
    monthlyPaye: roundMoney(fromCents(annualPayableCents) / 12),
    age,
    versionId: params.version.id,
    primaryRebateOnly: age == null,
  };
}
