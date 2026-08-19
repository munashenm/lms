import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { getLearnerDashboardData } from "@/lib/learner-dashboard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnnouncementList } from "@/components/announcements/announcement-list";
import { PayOnlineButton } from "@/components/finance/pay-online-button";
import { StudentCardButton } from "@/components/students/student-card-button";
import { StudentBarcode } from "@/components/learner/student-barcode";
import { formatZAR, formatDate, getInitials } from "@/lib/utils";
import {
  BookOpen,
  Calendar,
  ClipboardCheck,
  CreditCard,
  FileText,
  Award,
} from "lucide-react";

export default async function StudentDashboardPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const data = student ? await getLearnerDashboardData(student) : null;
  const currentEnrolment =
    student?.enrolments.find((e) => e.academicYear?.isCurrent) ?? student?.enrolments[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar className="h-16 w-16">
          {student?.photoUrl ? <AvatarImage src={student.photoUrl} alt="" /> : null}
          <AvatarFallback>
            {getInitials(student?.firstName ?? session!.firstName, student?.lastName ?? session!.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            Welcome back, {student?.firstName ?? session!.firstName}
          </h1>
          <p className="text-muted text-sm mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {student?.studentNumber ? <span>{student.studentNumber}</span> : null}
            {student?.grade?.name ? <span>{student.grade.name}</span> : null}
            {student?.class?.name ? <span>{student.class.name}</span> : null}
            {currentEnrolment?.course?.name ? <span>{currentEnrolment.course.name}</span> : null}
            {currentEnrolment?.academicYear?.name ? <span>{currentEnrolment.academicYear.name}</span> : null}
            {student?.campus?.name ? <span>{student.campus.name}</span> : null}
          </p>
        </div>
        {student?.studentNumber ? (
          <StudentCardButton href="/api/me/card" studentNumber={student.studentNumber} />
        ) : null}
      </div>

      {student?.studentNumber ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted">
              Present this barcode at the school gate or office. Download the PDF card for printing.
            </p>
            <StudentBarcode value={student.studentNumber} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Link href="/student/attendance"><StatCard title="Attendance" value={`${data?.attendance.percentage ?? 100}%`} subtitle={`${data?.attendance.present ?? 0} present`} icon={ClipboardCheck} /></Link>
        <Link href="/student/results"><StatCard title="Current average" value={data?.currentAverage != null ? `${data.currentAverage}%` : "—"} icon={Award} /></Link>
        <Link href="/student/fees"><StatCard title="Outstanding fees" value={formatZAR(data?.outstandingFees ?? 0)} icon={CreditCard} /></Link>
        <Link href="/student/assignments"><StatCard title="Pending homework" value={data?.pendingAssignments.length ?? 0} icon={FileText} /></Link>
        <Link href="/student/exams"><StatCard title="Upcoming exams" value={data?.upcomingExams.length ?? 0} icon={Calendar} /></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Today&apos;s classes</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/student/timetable">Timetable</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data?.todaySlots.length ? (
              <p className="text-sm text-muted">No classes scheduled for today.</p>
            ) : (
              data.todaySlots.map((slot) => (
                <div key={slot.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{slot.subject?.name ?? slot.module?.name ?? "Period"}</p>
                  <p className="text-xs text-muted mt-1">
                    {slot.startTime}–{slot.endTime}
                    {slot.room ? ` · ${slot.room}` : ""}
                    {slot.teacher ? ` · ${slot.teacher.firstName} ${slot.teacher.lastName}` : ""}
                  </p>
                  {slot.onlineMeetingUrl ? (
                    <a href={slot.onlineMeetingUrl} className="text-xs text-primary hover:underline" target="_blank" rel="noreferrer">
                      Join online class
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Academic progress</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/student/subjects">Subjects</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const rows = data?.academicProgress.length ? data.academicProgress : data?.curriculum ?? [];
              if (rows.length === 0) {
                return <p className="text-sm text-muted">No published results or curriculum progress yet.</p>;
              }
              return rows.map((row) => {
                const value = "average" in row ? row.average : row.percentage;
                return (
                  <Link key={row.id} href={`/student/subjects/${row.id}`} className="block">
                    <div className="flex items-center justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="font-medium">{value}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-background">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(value, 100)}%` }} />
                    </div>
                  </Link>
                );
              });
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assignments due</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/student/assignments">Homework</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data?.pendingAssignments.length ? (
              <p className="text-sm text-muted">You&apos;re up to date.</p>
            ) : (
              data.pendingAssignments.slice(0, 6).map((item) => (
                <Link key={item.assignmentId} href={`/student/assignments#${item.assignmentId}`} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span>{item.title} <span className="text-muted">· {item.subject}</span></span>
                  <span className="text-muted">{item.dueDate ? formatDate(item.dueDate) : "No due date"}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fee summary</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/student/fees">View account</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Current balance: <strong>{formatZAR(data?.ledgerBalance ?? 0)}</strong></p>
            <p>Overdue: <strong>{formatZAR(data?.overdueFees ?? 0)}</strong></p>
            {data?.nextInstalment ? (
              <p>
                Next payment: {formatZAR(data.nextInstalment.amount)} due {formatDate(data.nextInstalment.dueDate)}
              </p>
            ) : (
              <p className="text-muted">No upcoming instalment.</p>
            )}
            {data?.payInvoiceId ? (
              <PayOnlineButton invoiceId={data.payInvoiceId} outstanding={data.payOutstanding} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming exams</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/student/exams">All exams</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!data?.upcomingExams.length ? (
              <p className="text-sm text-muted">No upcoming exams.</p>
            ) : (
              data.upcomingExams.map((exam) => (
                <div key={exam.id} className="text-sm border-b border-border pb-2 last:border-0">
                  <p className="font-medium">{exam.title}</p>
                  <p className="text-xs text-muted">
                    {exam.subject}
                    {exam.dueDate ? ` · ${formatDate(exam.dueDate)}` : ""}
                    {exam.venue ? ` · ${exam.venue}` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Notice board</h2>
            <Button variant="ghost" size="sm" asChild><Link href="/student/announcements">View all</Link></Button>
          </div>
          <AnnouncementList announcements={data?.announcements ?? []} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Latest results</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.latestResults.length ? (
            <p className="text-sm text-muted">No published results yet.</p>
          ) : (
            <div className="space-y-2">
              {data.latestResults.map((row) => (
                <div key={row.id} className="flex justify-between text-sm">
                  <span>{row.title} <span className="text-muted">· {row.subject}</span></span>
                  <span>
                    {row.score}/{row.maxMarks}
                    {row.symbol ? ` (${row.symbol})` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
