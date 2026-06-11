import { Suspense } from "react";
import { ApplicationStatusTracker } from "@/components/public/application-status-tracker";
import { publicPageMetadata } from "@/lib/site-metadata";

export const metadata = publicPageMetadata("Track Application", "Check the status of your admission application.");

export default function ApplicationStatusPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 lg:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Application Status</h1>
        <p className="text-muted mt-2">
          Check the progress of your admission application.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted text-sm">Loading...</p>}>
        <ApplicationStatusTracker />
      </Suspense>
    </div>
  );
}
