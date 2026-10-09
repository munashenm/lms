import { z } from "zod";
import { EARLY_DEPARTURE_REASONS, validHHMM } from "./engine";

export const gateScanSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  method: z.enum(["QR", "BARCODE", "CAMERA", "RFID", "NFC", "BIOMETRIC", "MANUAL"]),
  token: z.string().max(80).optional().nullable(),
  personType: z.enum(["STUDENT", "STAFF"]).optional().nullable(),
  personId: z.string().max(80).optional().nullable(),
  gateId: z.string().max(80).optional().nullable(),
  deviceId: z.string().max(80).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  manualReason: z.string().max(300).optional().nullable(),
  earlyDepartureReason: z.enum(EARLY_DEPARTURE_REASONS).optional().nullable(),
  earlyDepartureNote: z.string().max(300).optional().nullable(),
  correction: z.boolean().optional(),
});

const hhmm = z.string().refine((value) => Boolean(validHHMM(value)), "Use HH:MM");

export const gatePolicySchema = z.object({
  schoolStartTime: hhmm,
  lateAfterMinutes: z.coerce.number().int().min(0).max(180),
  normalDepartureTime: hhmm,
  duplicateScanIntervalSeconds: z.coerce.number().int().min(10).max(3600),
  dayBoundaryTime: hhmm,
  requireVisitorIdentity: z.boolean().optional(),
  allowVisitorPhoto: z.boolean().optional(),
});

export const gateCheckpointSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().min(1).max(20),
  location: z.string().max(120).optional().nullable(),
  deviceId: z.string().max(80).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const issueCardSchema = z.object({
  holderType: z.enum(["STUDENT", "STAFF"]),
  studentId: z.string().min(1).optional().nullable(),
  userId: z.string().min(1).optional().nullable(),
  employeeId: z.string().min(1).optional().nullable(),
});

export const bulkCardSchema = z.object({
  holderType: z.enum(["STUDENT", "STAFF"]),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const cardSheetSchema = z.object({
  cardIds: z.array(z.string().min(1)).min(1).max(40),
});

export const reconcileSchema = z.object({
  gateEventId: z.string().min(1).optional().nullable(),
  visitorEntryId: z.string().min(1).optional().nullable(),
  reason: z.string().min(3).max(300),
});

export const cardActionSchema = z.object({
  action: z.enum(["deactivate", "reissue"]),
  reason: z.string().max(200).optional().nullable(),
});
