import { AcademicOfferings } from "@/components/public/academic-offerings";
import { publicPageMetadata } from "@/lib/site-metadata";

export const metadata = publicPageMetadata("Programmes", "Browse programmes, courses and modules.");
export const dynamic = "force-dynamic";

export default async function ProgrammesPage() {
  return <AcademicOfferings heading="Programmes" />;
}
