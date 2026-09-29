import Link from "next/link";
import { PRICING_NOTES, PRICING_TIERS, estimateMonthlyZar } from "@/lib/pricing";
import { formatZAR } from "@/lib/utils";

export const metadata = {
  title: "SchoolHub SA pricing",
  description: "Transparent SaaS packages for South African schools, colleges and training centres.",
};

export default function PricingPage() {
  const sampleLearners = 400;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f3ee,_#f7f4ef_45%,_#eef2f7)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-emerald-800">SchoolHub SA</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Transparent SaaS pricing
          </h1>
          <p className="mt-4 text-lg text-slate-700">
            Published bands in ZAR. Turn modules on when you need them — including the Compliance Pack for
            SA-SAMS / LURITS / CEMIS.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Book a demo
            </Link>
            <Link
              href="/apply"
              className="rounded-md border border-slate-300 bg-white/70 px-4 py-2 text-sm font-medium text-slate-800"
            >
              See online admissions
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const estimate = estimateMonthlyZar(tier.id, sampleLearners);
            return (
              <article
                key={tier.id}
                className={`rounded-2xl border bg-white/80 p-6 shadow-sm backdrop-blur ${
                  tier.highlighted ? "border-emerald-700 ring-1 ring-emerald-700/30" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">{tier.name}</h2>
                  {tier.highlighted ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                      Popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">{tier.tagline}</p>
                <div className="mt-5">
                  {tier.id === "group" ? (
                    <p className="text-2xl font-semibold text-slate-900">Custom quote</p>
                  ) : (
                    <>
                      <p className="text-3xl font-semibold text-slate-900">
                        from {formatZAR(tier.monthlyFromZar)}
                        <span className="text-base font-normal text-slate-500"> / month</span>
                      </p>
                      {tier.perLearnerZar > 0 ? (
                        <p className="text-sm text-slate-600">
                          + {formatZAR(tier.perLearnerZar)} per active learner
                        </p>
                      ) : (
                        <p className="text-sm text-slate-600">Flat add-on (not learner-metered)</p>
                      )}
                      {estimate != null ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Example at {sampleLearners} learners: {formatZAR(estimate)} / month
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <ul className="mt-5 space-y-2 text-sm text-slate-700">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-emerald-700">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {tier.excludes?.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {tier.excludes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="mt-10 max-w-3xl space-y-2 text-sm text-slate-600">
          {PRICING_NOTES.map((note) => (
            <p key={note}>• {note}</p>
          ))}
        </div>
      </div>
    </main>
  );
}