import { Suspense } from "react";
import { ApplicationStatusTracker } from "@/components/public/application-status-tracker";
import { publicPageMetadata } from "@/lib/site-metadata";
import { PageHero, SiteSection } from "@/components/public/site-ui";

export const metadata = publicPageMetadata("Track Application", "Check the status of your admission application.");

export default function ApplicationStatusPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions"
        title="Track your application."
        description="Enter the reference number you received when you applied."
      />
      <SiteSection>
        <div className="max-w-2xl mx-auto">
          <Suspense fallback={<p className="text-[var(--site-muted)] text-sm">Loading...</p>}>
            <ApplicationStatusTracker />
          </Suspense>
        </div>
      </SiteSection>
    </>
  );
}
