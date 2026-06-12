import { sendOutboundMessage } from "./notifications";

interface ApplicantConfirmationParams {
  schoolId: string;
  referenceNo: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  schoolName: string;
  appUrl: string;
}

export async function sendApplicationConfirmation(params: ApplicantConfirmationParams) {
  const { referenceNo, firstName, schoolName, appUrl } = params;
  const statusUrl = `${appUrl}/apply/status?ref=${encodeURIComponent(referenceNo)}`;

  const message =
    `Hi ${firstName}, your application to ${schoolName} was received. ` +
    `Reference: ${referenceNo}. Track status: ${statusUrl}`;

  const tasks: Promise<void>[] = [];

  if (params.email) {
    tasks.push(
      sendOutboundMessage(
        params.schoolId,
        "email",
        params.email,
        `Application received — ${referenceNo}`,
        message
      )
    );
  }

  if (params.phone) {
    tasks.push(sendOutboundMessage(params.schoolId, "sms", params.phone, "Application received", message));
  }

  await Promise.all(tasks);
}

export async function sendApplicationStatusUpdate(params: {
  schoolId: string;
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

  const tasks: Promise<void>[] = [];

  if (params.email) {
    tasks.push(
      sendOutboundMessage(
        params.schoolId,
        "email",
        params.email,
        `Application update — ${params.referenceNo}`,
        message
      )
    );
  }
  if (params.phone) {
    tasks.push(sendOutboundMessage(params.schoolId, "sms", params.phone, "Application update", message));
  }

  await Promise.all(tasks);
}
