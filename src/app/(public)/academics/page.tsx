import { AcademicOfferings } from "@/components/public/academic-offerings";
import { publicPageMetadata } from "@/lib/site-metadata";

export const metadata = publicPageMetadata("Academics", "Grades, subjects and academic structure.");
export const dynamic = "force-dynamic";

export default async function AcademicsPage() {
  return <AcademicOfferings heading="Academics" />;
}
