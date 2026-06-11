import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { StudentsTable } from "@/components/students/students-table";

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getSession();
  const schoolFilter = getSchoolFilter(session!);
  const search = params.search ?? "";
  const status = params.status;
  const page = parseInt(params.page ?? "1", 10);
  const limit = 20;

  const where = {
    ...schoolFilter,
    ...(status && { status: status as "ACTIVE" }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { studentNumber: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        grade: { select: { name: true } },
        class: { select: { name: true } },
        campus: { select: { name: true } },
      },
      orderBy: { lastName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.student.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-muted text-sm mt-1">
            {total} student{total !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/students/new">
            <Plus className="h-4 w-4" />
            Add Student
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <form className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                name="search"
                placeholder="Search by name or student number..."
                defaultValue={search}
                className="pl-9"
              />
            </div>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="APPLICANT">Applicant</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="GRADUATED">Graduated</option>
            </select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <StudentsTable
        students={students}
        pagination={{ page, limit, total, pages: Math.ceil(total / limit) }}
      />
    </div>
  );
}
