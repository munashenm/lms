import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import Link from "next/link";
import { ROLE_DASHBOARD } from "@/lib/constants";

export default async function AccountPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          {session.mustResetPassword ? (
            <p className="text-sm text-amber-700">
              You must set a new password before continuing.
            </p>
          ) : (
            <Link
              href={ROLE_DASHBOARD[session.role]}
              className="text-sm text-muted hover:text-primary"
            >
              ← Back to dashboard
            </Link>
          )}
          <h1 className="text-2xl font-bold mt-2">Account security</h1>
          <p className="text-muted text-sm mt-1">
            {session.mustResetPassword
              ? "Choose a new password for your SchoolHub SA account"
              : "Update your portal password"}
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
