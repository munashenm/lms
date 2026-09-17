import crypto from "crypto";

export function encodePayFastValue(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

/** PayFast ITN signature: posted fields in received order, excluding `signature`. */
export function payFastItnSignature(
  fields: Record<string, string>,
  passphrase: string
): string {
  const query = Object.entries(fields)
    .filter(([key, value]) => key !== "signature" && value !== "")
    .map(([key, value]) => `${key}=${encodePayFastValue(value)}`)
    .join("&");
  const payload = `${query}&passphrase=${encodePayFastValue(passphrase)}`;
  return crypto.createHash("md5").update(payload).digest("hex");
}

export function verifyPayFastItnSignature(
  fields: Record<string, string>,
  passphrase: string,
  signature: string
): boolean {
  if (!passphrase || !signature) return false;
  const expected = payFastItnSignature(fields, passphrase);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function payFastAmountAcceptable(itnAmount: number, outstanding: number): boolean {
  if (!Number.isFinite(itnAmount) || itnAmount <= 0) return false;
  return itnAmount <= outstanding + 0.01;
}

export function formDataToPayFastFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") fields[key] = value;
  });
  return fields;
}
