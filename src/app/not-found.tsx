import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-lg px-4 py-24 text-center space-y-6">
        <p className="text-6xl font-bold text-primary/20">404</p>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted">
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">Go Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}
