import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalShell } from "@/components/layout/portal-shell";
import { canApplyForLeave } from "@/lib/staff-leave";
import { ROLE_DASHBOARD } from "@/lib/constants";
import type { NavItem } from "@/lib/navigation";

const staffLeaveNav: NavItem[] = [
  { label: "My Attendance", href: "/staff/attendance", icon: "ClipboardCheck" },
  { label: "My Leave", href: "/staff/leave", icon: "Palmtree" },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canApplyForLeave(session.role)) {
    redirect("/login");
  }

  return (
    <PortalShell user={session} navItems={staffLeaveNav} portalLabel="Staff">
      <div className="mb-6">
        <Link
          href={ROLE_DASHBOARD[session.role]}
          className="text-sm text-muted hover:text-primary"
        >
          ← Back to dashboard
        </Link>
      </div>
      {children}
    </PortalShell>
  );
}
