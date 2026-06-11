/**
 * South African data validation utilities
 */

export function validateSAIdNumber(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(id[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function validateSAPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, "");
  return /^0\d{9}$/.test(cleaned);
}

export function formatSAPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

export function extractDateOfBirthFromSAId(id: string): Date | null {
  if (!validateSAIdNumber(id)) return null;

  const year = parseInt(id.slice(0, 2), 10);
  const month = parseInt(id.slice(2, 4), 10);
  const day = parseInt(id.slice(4, 6), 10);

  const currentYear = new Date().getFullYear() % 100;
  const fullYear = year <= currentYear ? 2000 + year : 1900 + year;

  const date = new Date(fullYear, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}
