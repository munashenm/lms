import { getFeaturedSchool } from "@/lib/public-site";
import { publicPageMetadata } from "@/lib/site-metadata";
import { COMPANY_NAME } from "@/lib/constants";
import { PageHero, SiteSection } from "@/components/public/site-ui";

export const metadata = publicPageMetadata("Privacy and POPIA", "How this institution processes personal information.");
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const school = await getFeaturedSchool();

  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Privacy / POPIA"
        description="How personal information is processed at this institution."
      />
      <SiteSection>
        <div className="max-w-3xl space-y-6 text-[var(--site-muted)] leading-relaxed">
          <p className="whitespace-pre-wrap">
            {school?.popiaConsentText ||
              `${school?.name ?? "This institution"} processes personal information of applicants, learners/students and parents in accordance with the Protection of Personal Information Act (POPIA). Information is used for admissions, teaching, fees and lawful school administration.`}
          </p>
          <p className="text-sm">
            Contact {school?.email ?? "the school office"} to request access, correction or deletion of personal
            information where POPIA allows. Platform services are powered by {COMPANY_NAME}.
          </p>
        </div>
      </SiteSection>
    </>
  );
}
