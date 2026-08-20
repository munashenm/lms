import { describe, expect, it } from "vitest";
import { brandedEmailHtml } from "@/lib/email-branding";

describe("branded emails", () => {
  it("wraps body copy in school colours and escapes HTML", () => {
    const html = brandedEmailHtml({
      schoolName: "Westville High",
      primaryColor: "#14532D",
      accentColor: "#FBBF24",
      title: "Fee reminder",
      bodyText: "Please pay <today> at https://school.example/pay",
    });
    expect(html).toContain("Westville High");
    expect(html).toContain("#14532D");
    expect(html).toContain("#FBBF24");
    expect(html).toContain("Fee reminder");
    expect(html).toContain("Please pay &lt;today&gt;");
    expect(html).not.toContain("Please pay <today>");
    expect(html).toContain('href="https://school.example/pay"');
  });

  it("includes a logo when a URL is provided", () => {
    const html = brandedEmailHtml({
      schoolName: "Westville High",
      logoUrl: "/uploads/logo.png",
      title: "Welcome",
      bodyText: "Hello",
    });
    expect(html).toContain("/uploads/logo.png");
    expect(html).toContain('alt="Westville High"');
  });
});
