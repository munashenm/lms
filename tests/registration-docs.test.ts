import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_REGISTRATION_DOC_SLOTS,
  STUDENT_REGISTRATION_DOC_SLOTS,
  isAllowedRegistrationDocument,
  isAllowedStudentPhoto,
  registrationFilesFromForm,
  photoFileFromForm,
  validateRegistrationDocument,
  validateStudentPhoto,
} from "@/lib/registration-docs";

describe("registration documents", () => {
  it("includes birth certificate, ID, past results and other on student registration", () => {
    expect(STUDENT_REGISTRATION_DOC_SLOTS.map((s) => s.type)).toEqual([
      "BIRTH_CERTIFICATE",
      "ID_PASSPORT",
      "PAST_RESULTS",
      "OTHER",
    ]);
  });

  it("includes ID, contract, qualification, CV, certificate and other on employee registration", () => {
    expect(EMPLOYEE_REGISTRATION_DOC_SLOTS.map((s) => s.type)).toEqual([
      "ID_PASSPORT",
      "CONTRACT",
      "QUALIFICATION",
      "CV",
      "CERTIFICATE",
      "OTHER",
    ]);
  });

  it("allows PDF, Word and images for documents", () => {
    expect(isAllowedRegistrationDocument({ name: "birth.pdf", size: 100, type: "application/pdf" })).toBe(true);
    expect(isAllowedRegistrationDocument({ name: "results.docx", size: 100, type: "" })).toBe(true);
    expect(isAllowedRegistrationDocument({ name: "id.jpg", size: 100, type: "image/jpeg" })).toBe(true);
    expect(isAllowedRegistrationDocument({ name: "note.exe", size: 100, type: "application/octet-stream" })).toBe(false);
  });

  it("allows JPEG, PNG and WebP for student photos used on the identity card", () => {
    expect(isAllowedStudentPhoto({ name: "face.jpg", size: 100, type: "image/jpeg" })).toBe(true);
    expect(isAllowedStudentPhoto({ name: "face.png", size: 100, type: "image/png" })).toBe(true);
    expect(isAllowedStudentPhoto({ name: "face.pdf", size: 100, type: "application/pdf" })).toBe(false);
  });

  it("rejects oversized documents and photos", () => {
    expect(validateRegistrationDocument({ name: "big.pdf", size: 11 * 1024 * 1024, type: "application/pdf" })).toMatch(/10 MB/);
    expect(validateStudentPhoto({ name: "big.jpg", size: 6 * 1024 * 1024, type: "image/jpeg" })).toMatch(/5 MB/);
  });

  it("reads named registration slots and the photo field from form data", () => {
    const form = new FormData();
    form.set("photo", new File(["pic"], "face.jpg", { type: "image/jpeg" }));
    form.set("doc_BIRTH_CERTIFICATE", new File(["bc"], "birth.pdf", { type: "application/pdf" }));
    form.set("doc_OTHER", new File(["x"], "letter.pdf", { type: "application/pdf" }));
    form.set("doc_OTHER_title", "Transfer letter");
    form.set("doc_ID_PASSPORT", new File([], "empty.pdf"));

    expect(photoFileFromForm(form)?.name).toBe("face.jpg");
    const docs = registrationFilesFromForm(form, STUDENT_REGISTRATION_DOC_SLOTS);
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ type: "BIRTH_CERTIFICATE", title: "Birth certificate" });
    expect(docs[1]).toMatchObject({ type: "OTHER", title: "Transfer letter" });
  });
});
