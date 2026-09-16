export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_OUTSTANDING",
  "INTERVIEW_REQUIRED",
  "ASSESSMENT_REQUIRED",
  "WAITLISTED",
  "PROVISIONALLY_ACCEPTED",
  "ACCEPTED",
  "REJECTED",
  "ENROLLED",
  "WITHDRAWN",
] as const;

export type ApplicationStatusValue = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  DOCUMENTS_OUTSTANDING: "Documents Outstanding",
  INTERVIEW_REQUIRED: "Interview Required",
  ASSESSMENT_REQUIRED: "Assessment Required",
  WAITLISTED: "Waitlisted",
  PROVISIONALLY_ACCEPTED: "Provisionally Accepted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
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
  ACCEPTED: "Congratulations! Your application has been accepted.",
  REJECTED: "Unfortunately your application was not successful this intake.",
  ENROLLED: "You are enrolled. Use the student portal to access your account.",
  WITHDRAWN: "This application has been withdrawn.",
};

export const REVIEW_ACTION_STATUSES: ApplicationStatusValue[] = [
  "UNDER_REVIEW",
  "DOCUMENTS_OUTSTANDING",
  "INTERVIEW_REQUIRED",
  "ASSESSMENT_REQUIRED",
  "WAITLISTED",
  "PROVISIONALLY_ACCEPTED",
  "ACCEPTED",
  "REJECTED",
  "ENROLLED",
];
