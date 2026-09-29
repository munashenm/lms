export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_OUTSTANDING",
  "INTERVIEW_REQUIRED",
  "ASSESSMENT_REQUIRED",
  "WAITLISTED",
  "PROVISIONALLY_ACCEPTED",
  "OFFER_ISSUED",
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "ACCEPTED",
  "REJECTED",
  "ENROLLED",
  "WITHDRAWN",
] as const;

export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  DOCUMENTS_OUTSTANDING: "Waiting for documents",
  INTERVIEW_REQUIRED: "Interview needed",
  ASSESSMENT_REQUIRED: "Assessment needed",
  WAITLISTED: "On the waitlist",
  PROVISIONALLY_ACCEPTED: "Provisionally accepted",
  OFFER_ISSUED: "Offer sent",
  DEPOSIT_PENDING: "Waiting for deposit",
  DEPOSIT_PAID: "Ready to enrol",
  ACCEPTED: "Offer accepted",
  REJECTED: "Not successful",
  ENROLLED: "Enrolled",
  WITHDRAWN: "Withdrawn",
};

export const APPLICATION_STATUS_DESCRIPTIONS: Record<string, string> = {
  SUBMITTED: "Your application has been received and is awaiting review.",
  UNDER_REVIEW: "Our admissions team is reviewing your application.",
  DOCUMENTS_OUTSTANDING: "Please submit the outstanding documents requested by admissions.",
  INTERVIEW_REQUIRED: "An interview is required. The admissions office will contact you with details.",
  ASSESSMENT_REQUIRED: "An assessment is required before a final decision can be made.",
  WAITLISTED: "You are on the waiting list. We will contact you if a place opens.",
  PROVISIONALLY_ACCEPTED: "You have been provisionally accepted, subject to the remaining conditions.",
  OFFER_ISSUED: "An offer has been issued. Accept the offer and pay any deposit to continue.",
  DEPOSIT_PENDING: "Your offer deposit invoice has been issued. Payment is required to continue.",
  DEPOSIT_PAID: "Your deposit has been paid or waived. You may accept the offer to enrol.",
  ACCEPTED: "Congratulations! Your offer has been accepted.",
  REJECTED: "Unfortunately your application was not successful this intake.",
  ENROLLED: "You are enrolled. Use the student portal to access your account.",
  WITHDRAWN: "This application has been withdrawn.",
};

/** Short “what happens next” line for parents and staff cards. */
export const APPLICATION_STATUS_NEXT: Record<string, string> = {
  SUBMITTED: "Next: admissions will review this application.",
  UNDER_REVIEW: "Next: complete any document or interview requests.",
  DOCUMENTS_OUTSTANDING: "Next: upload the missing documents.",
  INTERVIEW_REQUIRED: "Next: attend the scheduled interview.",
  ASSESSMENT_REQUIRED: "Next: complete the admissions assessment.",
  WAITLISTED: "Next: wait for a place — we will contact you.",
  PROVISIONALLY_ACCEPTED: "Next: meet remaining conditions, then receive an offer.",
  OFFER_ISSUED: "Next: pay the deposit (if any), then accept the offer.",
  DEPOSIT_PENDING: "Next: pay the deposit invoice to continue enrolment.",
  DEPOSIT_PAID: "Next: accept the offer so the learner can be enrolled.",
  ACCEPTED: "Next: the school will complete enrolment.",
  REJECTED: "No further action on this application.",
  ENROLLED: "Next: use the learner portal for classes and fees.",
  WITHDRAWN: "No further action on this application.",
};

export const REVIEW_ACTION_STATUSES: ApplicationStatusValue[] = [
  "UNDER_REVIEW",
  "DOCUMENTS_OUTSTANDING",
  "INTERVIEW_REQUIRED",
  "ASSESSMENT_REQUIRED",
  "WAITLISTED",
  "PROVISIONALLY_ACCEPTED",
  "OFFER_ISSUED",
  "DEPOSIT_PENDING",
  "DEPOSIT_PAID",
  "ACCEPTED",
  "REJECTED",
  "ENROLLED",
];
