import { CommunicationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { transactionalAppUrl } from "@/lib/app-url";
import { deliverEmail, SENT_TO_PROVIDER, toEmailLogFields } from "@/lib/email/deliver";
import {
  EMAIL_PROVIDER_NOT_CONFIGURED,
  publicEmailProviderStatus,
  resolveEmailProvider,
  type EmailProviderInput,
} from "@/lib/email/resolve-provider";
import { sanitizeEmailDetail } from "@/lib/email/sanitize";
import type { ResendEmailClient } from "@/lib/email/send-resend";

const RESEND_KEY = "re_platform_secret_key";
const SCHOOL_KEY = "SG.schoolsecretkey";

function input(overrides: Partial<EmailProviderInput> = {}): EmailProviderInput {
  return {
    schoolEnabled: false,
    schoolApiKey: null,
    schoolFromEmail: "noreply@schoolhub.local",
    schoolFromName: "Smart School",
    schoolReplyTo: "info@college.co.za",
    sendGridReplyTo: null,
    resendApiKey: RESEND_KEY,
    resendFromEmail: "noreply@schoolhubsa.co.za",
    resendFromName: "SchoolHub SA",
    resendReplyTo: "info@schoolhubsa.co.za",
    ...overrides,
  };
}

describe("email provider selection", () => {
  it("uses platform Resend when it is configured", () => {
    const resolved = resolveEmailProvider(input());
    expect(resolved.provider).toBe("RESEND");
    expect(resolved.configured).toBe(true);
    expect(resolved.senderValid).toBe(true);
    expect(resolved.deliveryReady).toBe(true);
    expect(resolved.fromEmail).toBe("noreply@schoolhubsa.co.za");
    expect(resolved.replyTo).toBe("info@schoolhubsa.co.za");
    expect(resolved.fromEmail).not.toBe("noreply@schoolhub.local");
  });

  it("falls back to platform Resend when school SendGrid is disabled", () => {
    const resolved = resolveEmailProvider(
      input({
        schoolEnabled: false,
        schoolApiKey: SCHOOL_KEY,
        schoolFromEmail: "mail@college.co.za",
      })
    );
    expect(resolved.provider).toBe("RESEND");
    expect(resolved.apiKey).toBe(RESEND_KEY);
    expect(resolved.fromEmail).toBe("noreply@schoolhubsa.co.za");
  });

  it("falls back to platform Resend when school SendGrid is incomplete", () => {
    const resolved = resolveEmailProvider(
      input({
        schoolEnabled: true,
        schoolApiKey: SCHOOL_KEY,
        schoolFromEmail: "noreply@schoolhub.local",
      })
    );
    expect(resolved.provider).toBe("RESEND");
    expect(resolved.fromEmail).toBe("noreply@schoolhubsa.co.za");
    expect(resolved.senderValid).toBe(true);
  });

  it("lets a valid school SendGrid integration take precedence", () => {
    const resolved = resolveEmailProvider(
      input({
        schoolEnabled: true,
        schoolApiKey: SCHOOL_KEY,
        schoolFromEmail: "mail@college.co.za",
        schoolFromName: "Smart School",
        sendGridReplyTo: "reply@college.co.za",
      })
    );
    expect(resolved.provider).toBe("SENDGRID");
    expect(resolved.apiKey).toBe(SCHOOL_KEY);
    expect(resolved.fromEmail).toBe("mail@college.co.za");
    expect(resolved.replyTo).toBe("reply@college.co.za");
    expect(resolved.deliveryReady).toBe(true);
  });

  it("fails cleanly when neither provider is configured", () => {
    const resolved = resolveEmailProvider(
      input({
        schoolEnabled: false,
        schoolApiKey: null,
        resendApiKey: null,
        resendFromEmail: null,
      })
    );
    expect(resolved.provider).toBe("NONE");
    expect(resolved.configured).toBe(false);
    expect(resolved.deliveryReady).toBe(false);
    expect(resolved.failureCode).toBe(EMAIL_PROVIDER_NOT_CONFIGURED);
  });
});

describe("Resend delivery recording", () => {
  it("records a Resend API failure without keeping secrets", async () => {
    const resolved = resolveEmailProvider(input());
    const client: ResendEmailClient = {
      emails: {
        send: async () => ({
          data: null,
          error: {
            message: `rejected ${RESEND_KEY} ${SCHOOL_KEY} Bearer raw-token SHSA-ABCD-EFGH-IJKL`,
            statusCode: 422,
            name: "validation_error",
          },
        }),
      },
    };
    const result = await deliverEmail(
      resolved,
      { to: "person@example.com", subject: "Hello", text: "Hello" },
      { resendClient: client }
    );
    const logged = toEmailLogFields(result);
    expect(result.sent).toBe(false);
    expect(logged.status).toBe(CommunicationStatus.FAILED);
    expect(logged.status).not.toBe(CommunicationStatus.DELIVERED);
    const stored = JSON.stringify(logged);
    expect(stored).not.toContain(RESEND_KEY);
    expect(stored).not.toContain(SCHOOL_KEY);
    expect(stored).not.toContain("raw-token");
    expect(stored).not.toContain("SHSA-ABCD");
    expect(logged.error).toContain("[redacted]");
  });

  it("records provider acceptance separately from inbox delivery", async () => {
    const resolved = resolveEmailProvider(input());
    let payload: { from?: string; replyTo?: string; text?: string; html?: string } | null = null;
    const client: ResendEmailClient = {
      emails: {
        send: async (message) => {
          payload = message;
          return { data: { id: "re_msg_123" }, error: null };
        },
      },
    };
    const result = await deliverEmail(
      resolved,
      { to: "person@example.com", subject: "Hello", text: "Hello", html: "<p>Hello</p>" },
      { resendClient: client }
    );
    const logged = toEmailLogFields(result);
    expect(result.sent).toBe(true);
    expect(result.messageId).toBe("re_msg_123");
    expect(result.acceptance).toBe(SENT_TO_PROVIDER);
    expect(result.status).toBe(CommunicationStatus.SENT);
    expect(logged.status).not.toBe(CommunicationStatus.DELIVERED);
    expect(logged.metadata.providerAcceptance).toBe("SENT_TO_PROVIDER");
    expect(logged.metadata.inboxDelivered).toBe(false);
    expect(logged.provider).toBe("resend");
    expect(payload).toMatchObject({
      from: "SchoolHub SA <noreply@schoolhubsa.co.za>",
      replyTo: "info@schoolhubsa.co.za",
      text: "Hello",
      html: "<p>Hello</p>",
    });
  });

  it("keeps secrets out of public status and sanitized errors", () => {
    const resolved = resolveEmailProvider(input());
    const status = publicEmailProviderStatus(resolved);
    expect(status).toEqual({
      provider: "RESEND",
      configured: true,
      senderValid: true,
      deliveryReady: true,
      fromEmail: "noreply@schoolhubsa.co.za",
      fromName: "SchoolHub SA",
      replyTo: "info@schoolhubsa.co.za",
    });
    expect(JSON.stringify(status)).not.toContain(RESEND_KEY);
    expect(status).not.toHaveProperty("apiKey");
    expect(sanitizeEmailDetail(`key ${RESEND_KEY}`, [RESEND_KEY])).toBe("key [redacted]");
  });
});

describe("invitation links", () => {
  it("uses the canonical production domain when the Railway hostname is configured", () => {
    expect(transactionalAppUrl("https://lms-production-4e0d.up.railway.app")).toBe(
      "https://app.schoolhubsa.co.za"
    );
    expect(transactionalAppUrl("https://app.schoolhubsa.co.za")).toBe("https://app.schoolhubsa.co.za");
    expect(transactionalAppUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });
});

describe("school SendGrid send path", () => {
  it("does not call Resend when the school provider is valid", async () => {
    const resolved = resolveEmailProvider(
      input({
        schoolEnabled: true,
        schoolApiKey: SCHOOL_KEY,
        schoolFromEmail: "mail@college.co.za",
      })
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 202, headers: { "x-message-id": "sg-msg-1" } })
    );
    const resendClient: ResendEmailClient = {
      emails: {
        send: async () => {
          throw new Error("Resend should not be called");
        },
      },
    };
    try {
      const result = await deliverEmail(
        resolved,
        { to: "person@example.com", subject: "Hello", text: "Hello" },
        { resendClient }
      );
      expect(result.provider).toBe("SENDGRID");
      expect(result.acceptance).toBe(SENT_TO_PROVIDER);
      expect(result.status).toBe(CommunicationStatus.SENT);
      expect(result.messageId).toBe("sg-msg-1");
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("api.sendgrid.com");
      const body = JSON.parse(String(init?.body));
      expect(body.from.email).toBe("mail@college.co.za");
      const headers = init?.headers as { Authorization?: string };
      expect(headers.Authorization).toBe(`Bearer ${SCHOOL_KEY}`);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
