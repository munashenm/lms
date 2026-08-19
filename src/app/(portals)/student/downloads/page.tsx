import { getSession } from "@/lib/auth";
import { getStudentForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { DocumentList } from "@/components/documents/document-list";
import { documentVisibleToLearner, DOWNLOAD_CATEGORY_LABELS } from "@/lib/learner-portal";

export default async function StudentDownloadsPage() {
  const session = await getSession();
  const student = await getStudentForSession(session!);
  const documents = student
    ? await prisma.document.findMany({
        where: {
          schoolId: student.schoolId,
          OR: [{ isPublic: true }, { learnerVisible: true }],
        },
        include: { uploader: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const visible = student
    ? documents.filter((doc) =>
        documentVisibleToLearner(doc, {
          id: student.id,
          gradeId: student.gradeId,
          classId: student.classId,
          campusId: student.campusId,
          courseIds: student.enrolments.map((e) => e.courseId).filter((id): id is string => Boolean(id)),
        })
      )
    : [];

  const grouped = new Map<string, typeof visible>();
  for (const doc of visible) {
    const label = DOWNLOAD_CATEGORY_LABELS[doc.type] ?? "Other";
    const list = grouped.get(label) ?? [];
    list.push(doc);
    grouped.set(label, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Download Centre</h1>
        <p className="text-muted text-sm mt-1">Policies, study material and files released to your class or campus.</p>
      </div>
      {grouped.size === 0 ? (
        <DocumentList documents={[]} />
      ) : (
        [...grouped.entries()].map(([category, docs]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-lg font-semibold">{category}</h2>
            <DocumentList documents={docs} />
          </section>
        ))
      )}
    </div>
  );
}
