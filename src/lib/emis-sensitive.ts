/** Fields that must not be editable via ordinary students.edit alone. */
export const EMIS_SENSITIVE_FIELDS = [
  "disabilityStatus",
  "sneStatus",
  "disabilityNotes",
  "populationGroup",
  "citizenship",
  "countryOfBirth",
  "luritsNumber",
  "previousEmisSchool",
  "transferReason",
] as const;

export type EmisSensitiveField = (typeof EMIS_SENSITIVE_FIELDS)[number];

export function requestedEmisSensitiveFields(
  data: Record<string, unknown>
): EmisSensitiveField[] {
  return EMIS_SENSITIVE_FIELDS.filter((field) => data[field] !== undefined);
}
