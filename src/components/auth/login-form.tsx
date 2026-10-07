"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { safeInternalPath } from "@/lib/safe-redirect";
import type { LoginPortal } from "@/lib/login-portals";

interface LoginFormProps {
  dbReady?: boolean;
  portal?: LoginPortal;
  title?: string;
  description?: string;
  /** Branding context only — validated server-side against User.schoolId. */
  schoolSlug?: string;
}

export function LoginForm({
  dbReady = true,
  portal,
  title = "Sign in to your portal",
  description = "Enter your credentials to access your dashboard",
  schoolSlug,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mismatch, setMismatch] = useState<{ message: string; href: string; label?: string } | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setMismatch(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(portal ? { portal } : {}),
          ...(schoolSlug ? { schoolSlug } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else if (data.code === "PORTAL_SCHOOL_MISMATCH") {
          setMismatch({
            message: data.message || "This account belongs to another institution.",
            href: data.redirect || data.loginRedirect || "/login",
            label: data.correctSchoolName
              ? `Go to ${data.correctSchoolName}`
              : "Go to your institution portal",
          });
          toast.error(data.message || "Wrong institution portal");
        } else {
          toast.error(data.message || "Login failed");
        }
        if (data.redirect && res.status === 403 && data.code !== "PORTAL_SCHOOL_MISMATCH") {
          router.push(data.redirect);
        }
        return;
      }

      toast.success(`Welcome back, ${data.user.firstName}!`);
      const next = safeInternalPath(searchParams.get("redirect"));
      router.push(next && !data.mustResetPassword ? next : data.redirect);
      router.refresh();
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {mismatch ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2">
            <p>{mismatch.message}</p>
            <Link href={mismatch.href} className="font-medium text-primary hover:underline">
              {mismatch.label ?? "Open the correct portal"}
            </Link>
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@school.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !dbReady}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
