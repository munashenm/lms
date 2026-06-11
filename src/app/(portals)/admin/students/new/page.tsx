import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { StudentForm } from "@/components/students/student-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function NewStudentPage() {
  const session = await getSession();
  const schoolFilter = getSchoolFilter(session!);

  const [grades, classes, campuses] = await Promise.all([
    prisma.grade.findMany({
      where: { ...schoolFilter, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.class.findMany({
      where: { ...schoolFilter, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.campus.findMany({
      where: { ...schoolFilter, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Student</h1>
          <p className="text-muted text-sm mt-1">
            Register a new learner with POPIA-compliant data capture
          </p>
        </div>
      </div>

      <StudentForm grades={grades} classes={classes} campuses={campuses} />
    </div>
  );
}
