import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Document {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string;
  fileSize: number | null;
  isPublic: boolean;
  createdAt: Date;
  uploader?: { firstName: string; lastName: string } | null;
}

export function DocumentList({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted text-sm">
          No documents uploaded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileText className="h-8 w-8 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{doc.title}</p>
                {doc.description && (
                  <p className="text-sm text-muted mt-0.5">{doc.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">{doc.type.replace("_", " ")}</Badge>
                  {doc.isPublic && <Badge variant="success">Public</Badge>}
                  <span className="text-xs text-muted">{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
