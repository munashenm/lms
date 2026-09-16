import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-lg px-7 py-24 text-center space-y-6">
        <p className="font-[family-name:var(--site-serif)] text-6xl text-primary/20">404</p>
        <h1 className="section-title">Page not found</h1>
        <p className="text-[var(--site-muted)]">
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="site-btn site-btn-navy">
            Go Home
          </Link>
          <Link href="/contact" className="site-btn site-btn-outline">
            Contact Us
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
