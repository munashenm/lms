import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { COMPANY_NAME } from "@/lib/constants";

export const metadata = publicPageMetadata("Privacy and POPIA", "How this institution processes personal information.");
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const school = await getFeaturedSchool();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6 space-y-6">
      <h1 className="text-3xl font-bold">Privacy / POPIA</h1>
      <p className="text-muted leading-relaxed whitespace-pre-wrap">
        {school?.popiaConsentText ||
          `${school?.name ?? "This institution"} processes personal information of applicants, ${
            school ? "" : ""
          }learners/students and parents in accordance with the Protection of Personal Information Act (POPIA). Information is used for admissions, teaching, fees and lawful school administration.`}
      </p>
      <p className="text-sm text-muted">
        Contact {school?.email ?? "the school office"} to request access, correction or deletion of personal
        information where POPIA allows. Platform services are powered by {COMPANY_NAME}.
      </p>
    </div>
  );
}
