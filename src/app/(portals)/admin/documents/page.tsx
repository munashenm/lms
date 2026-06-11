import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSchoolFilter } from "@/lib/rbac";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/documents/document-list";

export default async function DocumentsPage() {
  const session = await getSession();
  const filter = getSchoolFilter(session!);

  const documents = await prisma.document.findMany({
    where: filter,
    include: { uploader: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted text-sm mt-1">Learning materials, certificates and files</p>
      </div>
      <DocumentUpload />
      <DocumentList documents={documents} />
    </div>
  );
}
