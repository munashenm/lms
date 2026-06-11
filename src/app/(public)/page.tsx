import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { getFeaturedSchool } from "@/lib/public-site";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  Users,
  Shield,
  Smartphone,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, school] = await Promise.all([getSession(), getFeaturedSchool()]);

  const stats = [
    { label: "Students", value: school?._count.students ?? 0 },
    { label: "Staff", value: school?._count.teachers ?? 0 },
    { label: "Programmes", value: school?._count.courses ?? 0 },
  ];

  return (
    <>
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-accent font-semibold text-sm uppercase tracking-wide mb-3">
              {school?.institutionType.replace("_", " ") ?? "School"} · {school?.city ?? "South Africa"}
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
              {school?.name ?? "Your Future Starts Here"}
            </h1>
            <p className="mt-4 text-lg text-white/80 leading-relaxed">
              Quality education for South African learners. CAPS, NSC and TVET programmes
              with modern facilities, expert lecturers, and a path to your career.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-accent text-primary hover:bg-accent/90" asChild>
                <Link href="/apply">
                  Apply for {new Date().getFullYear()}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                <Link href="/programmes">View Programmes</Link>
              </Button>
              {session && (
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                  <Link href={ROLE_DASHBOARD[session.role]}>My Dashboard</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-primary">{s.value}+</p>
                <p className="text-sm text-muted mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-surface border-y border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
          <h2 className="text-2xl font-bold text-center mb-10">Why study with us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: GraduationCap, title: "Accredited Programmes", desc: "NQF-aligned courses recognised across South Africa." },
              { icon: Users, title: "Expert Lecturers", desc: "Industry-experienced staff dedicated to your success." },
              { icon: Shield, title: "POPIA Compliant", desc: "Your personal information is protected by law." },
              { icon: Smartphone, title: "Digital-First", desc: "Access timetables, results and fees from any device." },
            ].map((item) => (
              <div key={item.title} className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl font-bold">Admissions open</h2>
            <p className="text-muted mt-3 leading-relaxed">
              Apply online in minutes. Upload your documents, track your application status,
              and receive updates by email or SMS.
            </p>
            <ul className="mt-6 space-y-3">
              {["Free online application", "Track status with your reference number", "Response within 5–10 working days"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-3">
              <Button asChild>
                <Link href="/apply">Start Application</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/apply/status">Track Application</Link>
              </Button>
            </div>
          </div>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8">
              <p className="text-sm font-medium text-primary">Featured Programme</p>
              <h3 className="text-xl font-bold mt-2">{school?.courses[0]?.name ?? "Information Technology"}</h3>
              <p className="text-sm text-muted mt-2">
                {school?.courses[0]?.description ?? "NQF Level 4 programme with industry-relevant modules."}
              </p>
              {school?.courses[0]?.nqfLevel && (
                <p className="text-xs text-muted mt-3">NQF Level {school.courses[0].nqfLevel} · {school.courses[0].durationMonths} months</p>
              )}
              <Button variant="outline" className="mt-6" asChild>
                <Link href="/programmes">All Programmes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
