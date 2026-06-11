import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface StudentRow {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  enrolledAt: Date | null;
  grade: { name: string } | null;
  class: { name: string } | null;
  campus: { name: string } | null;
}

interface StudentsTableProps {
  students: StudentRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const statusVariant: Record<string, "success" | "warning" | "danger" | "secondary" | "default"> = {
  ACTIVE: "success",
  APPLICANT: "warning",
  SUSPENDED: "danger",
  GRADUATED: "default",
  WITHDRAWN: "secondary",
};

export function StudentsTable({ students, pagination }: StudentsTableProps) {
  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted">No students found. Add your first student to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium text-muted">Student No.</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden md:table-cell">Grade</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden lg:table-cell">Class</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden lg:table-cell">Campus</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted hidden sm:table-cell">Enrolled</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-border last:border-0 hover:bg-background/30">
                  <td className="px-4 py-3 font-mono text-xs">{student.studentNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{student.firstName} {student.lastName}</p>
                    {student.email && (
                      <p className="text-xs text-muted">{student.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted">
                    {student.grade?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted">
                    {student.class?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted">
                    {student.campus?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[student.status] ?? "secondary"}>
                      {student.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted text-xs">
                    {student.enrolledAt ? formatDate(student.enrolledAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/students/${student.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <p>
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            {pagination.page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`?page=${pagination.page - 1}`}>Previous</Link>
              </Button>
            )}
            {pagination.page < pagination.pages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`?page=${pagination.page + 1}`}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
