import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import { schoolThemeCssVars } from "@/lib/school-branding";

interface PublicShellProps {
  children: React.ReactNode;
  schoolName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export function PublicShell({
  children,
  schoolName,
  logoUrl,
  primaryColor,
  accentColor,
}: PublicShellProps) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={schoolThemeCssVars(primaryColor, accentColor)}
    >
      <PublicHeader schoolName={schoolName} logoUrl={logoUrl} />
      <main className="flex-1">{children}</main>
      <PublicFooter schoolName={schoolName} />
    </div>
  );
}
