import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { canApplyForLeave } from "@/lib/staff-leave";
import {
  isAllowedLeaveEvidence,
  leaveEvidenceFileFromForm,
  leaveEvidenceLabel,
  leaveEvidenceRequired,
  validateLeaveEvidence,
} from "@/lib/staff-leave-evidence";

describe("canApplyForLeave", () => {
  it("allows staff and teacher portal roles", () => {
    expect(canApplyForLeave(UserRole.STAFF)).toBe(true);
    expect(canApplyForLeave(UserRole.TEACHER)).toBe(true);
    expect(canApplyForLeave(UserRole.STUDENT)).toBe(false);
  });
});

describe("staff leave evidence", () => {
  it("requires a file only for sick leave", () => {
    expect(leaveEvidenceRequired("SICK")).toBe(true);
    expect(leaveEvidenceRequired("ANNUAL")).toBe(false);
    expect(leaveEvidenceRequired("FAMILY")).toBe(false);
    expect(leaveEvidenceRequired("MATERNITY")).toBe(false);
    expect(leaveEvidenceRequired("STUDY")).toBe(false);
    expect(leaveEvidenceRequired("UNPAID")).toBe(false);
    expect(leaveEvidenceRequired("OTHER")).toBe(false);
  });

  it("rejects missing evidence for sick leave and allows it for other types", () => {
    expect(validateLeaveEvidence(null, "SICK")).toMatch(/medical certificate/i);
    expect(validateLeaveEvidence(null, "ANNUAL")).toBeNull();
    expect(validateLeaveEvidence(null, "STUDY")).toBeNull();
  });

  it("allows PDF, Word and image files", () => {
    expect(isAllowedLeaveEvidence({ name: "note.pdf", size: 100, type: "application/pdf" })).toBe(true);
    expect(
      isAllowedLeaveEvidence({
        name: "letter.docx",
        size: 100,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ).toBe(true);
    expect(isAllowedLeaveEvidence({ name: "scan.jpg", size: 100, type: "image/jpeg" })).toBe(true);
    expect(isAllowedLeaveEvidence({ name: "note.doc", size: 100, type: "" })).toBe(true);
    expect(isAllowedLeaveEvidence({ name: "virus.exe", size: 100, type: "application/octet-stream" })).toBe(false);
  });

  it("rejects oversized files", () => {
    expect(
      validateLeaveEvidence({ name: "huge.pdf", size: 6 * 1024 * 1024, type: "application/pdf" }, "ANNUAL")
    ).toMatch(/5 MB/);
  });

  it("reads evidence or the legacy sickNote form field", () => {
    const withEvidence = new FormData();
    withEvidence.set("evidence", new File(["ok"], "note.pdf", { type: "application/pdf" }));
    expect(leaveEvidenceFileFromForm(withEvidence)?.name).toBe("note.pdf");

    const withSickNote = new FormData();
    withSickNote.set("sickNote", new File(["ok"], "doctor.png", { type: "image/png" }));
    expect(leaveEvidenceFileFromForm(withSickNote)?.name).toBe("doctor.png");

    const empty = new FormData();
    empty.set("evidence", new File([], "empty.pdf"));
    expect(leaveEvidenceFileFromForm(empty)).toBeNull();
  });

  it("labels downloads with the filename, or a type fallback", () => {
    expect(leaveEvidenceLabel("SICK", "doctor-note.pdf")).toBe("doctor-note.pdf");
    expect(leaveEvidenceLabel("SICK", null)).toBe("Sick note");
    expect(leaveEvidenceLabel("ANNUAL", null)).toBe("Supporting evidence");
  });
});
