import { CompactSign, compactVerify, generateKeyPair, importPKCS8, importSPKI, exportSPKI, exportPKCS8 } from "jose";
import type { LicenseClaims } from "./types";

const ALG = "EdDSA";
const TYP = "license+jwt";

export async function generateLicenseKeyPair(): Promise<{
  publicKeyPem: string;
  privateKeyPem: string;
}> {
  const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true });
  return {
    publicKeyPem: await exportSPKI(publicKey),
    privateKeyPem: await exportPKCS8(privateKey),
  };
}

export async function importPublicKey(pem: string) {
  return importSPKI(pem, ALG);
}

export async function importPrivateKey(pem: string) {
  return importPKCS8(pem, ALG);
}

export async function signLicenseClaims(
  claims: LicenseClaims,
  privateKeyPem: string
): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);
  return new CompactSign(new TextEncoder().encode(JSON.stringify(claims)))
    .setProtectedHeader({ alg: ALG, typ: TYP })
    .sign(key);
}

export type VerifyLicenseResult =
  | { ok: true; claims: LicenseClaims; token: string }
  | { ok: false; error: "invalid_signature" | "malformed" };

export async function verifyLicenseToken(
  token: string,
  publicKeyPem: string
): Promise<VerifyLicenseResult> {
  try {
    const key = await importPublicKey(publicKeyPem);
    const { payload, protectedHeader } = await compactVerify(token, key);
    if (protectedHeader.alg !== ALG) {
      return { ok: false, error: "invalid_signature" };
    }
    const claims = JSON.parse(new TextDecoder().decode(payload)) as LicenseClaims;
    if (!claims?.licenseKey || !claims?.product || !claims?.status) {
      return { ok: false, error: "malformed" };
    }
    return { ok: true, claims, token };
  } catch {
    return { ok: false, error: "invalid_signature" };
  }
}

export function getLicensePublicKey(): string | null {
  const raw = process.env.LICENSE_PUBLIC_KEY?.trim();
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n");
}

export function getLicensePrivateKey(): string | null {
  const raw = process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim();
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n");
}

export function isLicenseServerEnabled(): boolean {
  return process.env.LICENSE_SERVER_ENABLED === "true" && Boolean(getLicensePrivateKey());
}
