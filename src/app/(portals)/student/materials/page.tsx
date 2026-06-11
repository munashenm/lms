import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { DocumentList } from "@/components/documents/document-list";

export default async function StudentMaterialsPage() {
  const session = await getSession();

  const documents = await prisma.document.findMany({
    where: {
      ...getSchoolFilter(session!),
      isPublic: true,
      type: "LEARNING_MATERIAL",
    },
    include: { uploader: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Learning Materials</h1>
        <p className="text-muted text-sm mt-1">Notes and resources from your teachers</p>
      </div>
      <DocumentList documents={documents} />
    </div>
  );
}
