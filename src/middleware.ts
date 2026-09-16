import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canAccessAdmin, canAccessFinance, canAccessHr } from "@/lib/rbac";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { canApplyForLeave } from "@/lib/staff-leave-access";
import { UserRole } from "@prisma/client";
import { unauthenticatedLoginPath } from "@/lib/login-portals";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/student/login",
  "/parent/login",
  "/apply",
  "/about",
  "/admissions",
  "/academics",
  "/programmes",
  "/fees",
  "/contact",
  "/news",
  "/calendar",
  "/gallery",
  "/privacy",
  "/brand",
  "/apple-touch-icon",
  "/uploads",
  "/api/webhooks",
  "/api/cron",
  "/api/contact",
  "/api/applications/status",
  "/sitemap.xml",
  "/robots.txt",
];

const STATIC_ASSET = /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|css|map)$/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Academic PDFs are fee-gated — only serve via authenticated API routes.
  if (
    pathname.startsWith("/uploads/report-cards") ||
    pathname.startsWith("/uploads/certificates") ||
    pathname.startsWith("/uploads/letters")
  ) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (STATIC_ASSET.test(pathname)) {
    return NextResponse.next();
  }

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(
    request.headers.get("cookie")
  );

  if (!session) {
    if (pathname === "/api/applications" && request.method === "POST") {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL(unauthenticatedLoginPath(pathname), request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !canAccessAdmin(session.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/finance") && !canAccessFinance(session.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/hr") && !canAccessHr(session.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/teacher") && session.role !== UserRole.TEACHER && session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/student") && pathname !== "/student/login" && session.role !== UserRole.STUDENT && session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/parent") && pathname !== "/parent/login" && session.role !== UserRole.PARENT && session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/staff") && !canApplyForLeave(session.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
