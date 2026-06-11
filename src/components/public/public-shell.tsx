import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";

interface PublicShellProps {
  children: React.ReactNode;
  schoolName?: string;
}

export function PublicShell({ children, schoolName }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter schoolName={schoolName} />
    </div>
  );
}
