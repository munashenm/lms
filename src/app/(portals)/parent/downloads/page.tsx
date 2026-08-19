import { getSession } from "@/lib/auth";
import { getGuardianForSession } from "@/lib/portal-data";
import { prisma } from "@/lib/db";
import { DocumentList } from "@/components/documents/document-list";
import { DOWNLOAD_CATEGORY_LABELS } from "@/lib/learner-portal";

export default async function ParentDownloadsPage() {
  const session = await getSession();
  const guardian = await getGuardianForSession(session!);
  const schoolId = session?.schoolId ?? guardian?.schoolId;

  const documents = schoolId
    ? await prisma.document.findMany({
        where: {
          schoolId,
          isPublic: true,
        },
        include: { uploader: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const grouped = new Map<string, typeof documents>();
  for (const doc of documents) {
    const label = DOWNLOAD_CATEGORY_LABELS[doc.type] ?? "Other";
    const list = grouped.get(label) ?? [];
    list.push(doc);
    grouped.set(label, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Download Centre</h1>
        <p className="text-muted text-sm mt-1">
          Public policies, forms and files released to parents. Class-only learner files are not
          shown here.
        </p>
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
