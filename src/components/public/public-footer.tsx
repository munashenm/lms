import Link from "next/link";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

interface PublicFooterProps {
  schoolName?: string;
}

export function PublicFooter({ schoolName }: PublicFooterProps) {
  return (
    <footer className="border-t border-border bg-primary text-white mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <p className="font-bold text-lg">{APP_NAME}</p>
            <p className="text-sm text-white/70 mt-2">
              Modern school management for South African institutions.
            </p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Explore</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/about" className="hover:text-white">About</Link></li>
              <li><Link href="/programmes" className="hover:text-white">Programmes</Link></li>
              <li><Link href="/fees" className="hover:text-white">Fees</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Admissions</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/apply" className="hover:text-white">Apply Online</Link></li>
              <li><Link href="/apply/status" className="hover:text-white">Track Application</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Portals</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/login" className="hover:text-white">Staff & Student Login</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {schoolName ?? COMPANY_NAME}. All rights reserved.</p>
          <p>POPIA compliant · Built by {COMPANY_NAME}</p>
        </div>
      </div>
    </footer>
  );
}
