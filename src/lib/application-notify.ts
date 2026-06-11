import { logOutboundMessage } from "./notifications";

interface ApplicantConfirmationParams {
  referenceNo: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  schoolName: string;
  appUrl: string;
}

export function sendApplicationConfirmation(params: ApplicantConfirmationParams) {
  const { referenceNo, firstName, schoolName, appUrl } = params;
  const statusUrl = `${appUrl}/apply/status?ref=${encodeURIComponent(referenceNo)}`;

  const message =
    `Hi ${firstName}, your application to ${schoolName} was received. ` +
    `Reference: ${referenceNo}. Track status: ${statusUrl}`;

  if (params.email) {
    logOutboundMessage(
      "email",
      params.email,
      `Application received — ${referenceNo}`,
      message
    );
  }

  if (params.phone) {
    logOutboundMessage("sms", params.phone, "Application received", message);
  }
}

export function sendApplicationStatusUpdate(params: {
  email?: string | null;
  phone?: string | null;
  firstName: string;
  referenceNo: string;
  status: string;
  schoolName: string;
}) {
  const message =
    `Hi ${params.firstName}, your application ${params.referenceNo} at ${params.schoolName} ` +
    `is now: ${params.status}.`;

  if (params.email) {
    logOutboundMessage("email", params.email, `Application update — ${params.referenceNo}`, message);
  }
  if (params.phone) {
    logOutboundMessage("sms", params.phone, "Application update", message);
  }
}
