import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import {
  getAttendanceReport,
  getAcademicReport,
  getFinanceReport,
  getAdmissionsReport,
} from "@/lib/reports";
import { ReportPanel } from "@/components/reports/report-panel";
import { formatZAR } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const session = await getSession();
  const filter = getSchoolFilter(session!);
  const { tab = "attendance" } = await searchParams;

  const [attendance, academic, finance, admissions] = await Promise.all([
    tab === "attendance" ? getAttendanceReport(filter) : Promise.resolve([]),
    tab === "academic" ? getAcademicReport(filter) : Promise.resolve([]),
    tab === "finance" ? getFinanceReport(filter) : Promise.resolve(null),
    tab === "admissions" ? getAdmissionsReport(filter) : Promise.resolve(null),
  ]);

  const tabs = [
    { id: "attendance", label: "Attendance" },
    { id: "academic", label: "Academic" },
    { id: "finance", label: "Finance" },
    { id: "admissions", label: "Admissions" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted text-sm mt-1">
          Performance, attendance, fee and admissions analytics with CSV and PDF export
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/admin/reports?tab=${t.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-primary text-white"
                : "text-muted hover:bg-background"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === "attendance" && (
        <ReportPanel
          title="Attendance by Class"
          description="Present, absent and late counts per class"
          exportType="attendance"
          columns={[
            { key: "className", label: "Class" },
            { key: "grade", label: "Grade" },
            { key: "enrolled", label: "Enrolled", align: "right" },
            { key: "present", label: "Present", align: "right" },
            { key: "absent", label: "Absent", align: "right" },
            { key: "attendanceRate", label: "Rate %", align: "right" },
          ]}
          rows={attendance.map((r) => ({
            className: r.className,
            grade: r.grade,
            enrolled: r.enrolled,
            present: r.present,
            absent: r.absent,
            attendanceRate: `${r.attendanceRate}%`,
          }))}
        />
      )}

      {tab === "academic" && (
        <ReportPanel
          title="Academic Performance"
          description="Average published marks per subject"
          exportType="academic"
          columns={[
            { key: "code", label: "Code" },
            { key: "name", label: "Subject" },
            { key: "markCount", label: "Marks", align: "right" },
            { key: "averagePercent", label: "Average %", align: "right" },
          ]}
          rows={academic.map((r) => ({
            code: r.code,
            name: r.name,
            markCount: r.markCount,
            averagePercent: `${r.averagePercent}%`,
          }))}
        />
      )}

      {tab === "finance" && finance && (
        <ReportPanel
          title="Finance Summary"
          description="Billing and collection overview"
          exportType="finance"
          summary={[
            { label: "Total Billed", value: formatZAR(finance.summary.totalBilled) },
            { label: "Collected", value: formatZAR(finance.summary.totalCollected) },
            { label: "Outstanding", value: formatZAR(finance.summary.outstanding) },
            { label: "Invoices", value: String(finance.summary.invoiceCount) },
          ]}
          columns={[
            { key: "month", label: "Month" },
            { key: "billed", label: "Billed", align: "right" },
            { key: "collected", label: "Collected", align: "right" },
          ]}
          rows={finance.monthly.map((r) => ({
            month: r.month,
            billed: formatZAR(r.billed),
            collected: formatZAR(r.collected),
          }))}
        />
      )}

      {tab === "admissions" && admissions && (
        <ReportPanel
          title="Admissions Pipeline"
          description="Application status breakdown"
          exportType="admissions"
          summary={[
            { label: "Total", value: String(admissions.total) },
            { label: "Submitted", value: String(admissions.byStatus.SUBMITTED ?? 0) },
            { label: "Under Review", value: String(admissions.byStatus.UNDER_REVIEW ?? 0) },
            { label: "Accepted", value: String(admissions.byStatus.ACCEPTED ?? 0) },
          ]}
          columns={[
            { key: "name", label: "Applicant" },
            { key: "status", label: "Status" },
            { key: "gradeApplied", label: "Grade" },
          ]}
          rows={admissions.recent.map((r) => ({
            name: r.name,
            status: r.status,
            gradeApplied: r.gradeApplied ?? "—",
          }))}
        />
      )}
    </div>
  );
}
