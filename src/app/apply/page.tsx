import { prisma } from "@/lib/db";
import { ApplyForm } from "@/components/applications/apply-form";
import { Building2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    select: { slug: true, name: true, institutionType: true, city: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-white py-8 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Building2 className="h-8 w-8 text-accent" />
          <div>
            <h1 className="text-xl font-bold">{APP_NAME}</h1>
            <p className="text-sm text-white/70">Online Application Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Apply for Admission</h2>
          <p className="text-muted text-sm mt-2">
            Submit your application to a South African school or college. You will receive a
            reference number to track your application status.
          </p>
        </div>
        <ApplyForm schools={schools} />
      </div>
    </div>
  );
}
