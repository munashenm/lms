export function publicApplicationStatus(application: {
  referenceNo: string;
  status: string;
  submittedAt: Date;
  school: { name: string };
}) {
  return {
    referenceNo: application.referenceNo,
    status: application.status,
    submittedAt: application.submittedAt.toISOString(),
    schoolName: application.school.name,
  };
}
