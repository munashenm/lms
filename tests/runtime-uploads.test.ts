import { describe, expect, it } from "vitest";
import {
  contentTypeForUpload,
  parseUploadSegments,
  parseUploadUrl,
} from "@/lib/runtime-uploads";

describe("runtime uploads", () => {
  it("accepts a school branding logo path", () => {
    expect(parseUploadUrl("/uploads/crocot123/branding/logo-1.png")).toEqual([
      "crocot123",
      "branding",
      "logo-1.png",
    ]);
  });

  it("rejects path traversal and academic PDF folders", () => {
    expect(parseUploadUrl("/uploads/../.env")).toBeNull();
    expect(parseUploadUrl("/uploads/school/branding/../secret.png")).toBeNull();
    expect(parseUploadUrl("/uploads/report-cards/report.pdf")).toBeNull();
    expect(parseUploadUrl("/uploads/letters/ltr.pdf")).toBeNull();
    expect(parseUploadSegments(["..", "etc", "passwd"])).toBeNull();
  });

  it("maps logo extensions to image content types", () => {
    expect(contentTypeForUpload("logo.png")).toBe("image/png");
    expect(contentTypeForUpload("logo.JPG")).toBe("image/jpeg");
  });
});
