import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { Building2, Database } from "lucide-react";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME } from "@/lib/constants";
import { isDatabaseReachable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_DASHBOARD[session.role]);
  }

  const dbOk = await isDatabaseReachable();

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <Building2 className="h-10 w-10 text-accent" />
          <div>
            <p className="text-xl font-bold">{APP_NAME}</p>
            <p className="text-sm text-white/70">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold leading-tight">
            Manage your school<br />with confidence.
          </h2>
          <p className="text-white/70 text-lg leading-relaxed max-w-md">
            Built for South African schools, colleges and TVET institutions.
            POPIA-compliant, ZAR-ready, and load-shedding friendly.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            {["CAPS / NSC", "TVET Modules", "ZAR Finance", "POPIA Safe"].map((item) => (
              <div key={item} className="rounded-lg bg-white/10 px-4 py-3 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/40">© {COMPANY_NAME}</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center space-y-2">
            <Building2 className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">{APP_NAME}</h1>
            <p className="text-muted text-sm">{APP_TAGLINE}</p>
          </div>
          {!dbOk && (
            <div className="rounded-lg border border-danger/30 bg-red-50 p-4 text-sm text-red-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Database className="h-4 w-4" />
                Database not connected
              </div>
              <p>PostgreSQL is not running on <code className="text-xs bg-red-100 px-1 rounded">localhost:5432</code>. Login will fail until the database is started and seeded.</p>
              <ol className="list-decimal list-inside text-xs space-y-1 text-red-800">
                <li>Install <strong>Docker Desktop</strong> or <strong>PostgreSQL 16</strong></li>
                <li>Start DB: <code className="bg-red-100 px-1 rounded">docker compose up -d</code></li>
                <li>Setup: <code className="bg-red-100 px-1 rounded">npm run db:push</code> then <code className="bg-red-100 px-1 rounded">npm run db:seed</code></li>
              </ol>
            </div>
          )}
          <LoginForm dbReady={dbOk} />
        </div>
      </div>
    </div>
  );
}
