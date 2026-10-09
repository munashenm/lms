import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canAccessAdmin, canAccessFinance, canAccessHr, canAccessSecurityPortal } from "@/lib/rbac";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { canApplyForLeave } from "@/lib/staff-leave-access";
import { UserRole } from "@prisma/client";
import { unauthenticatedLoginPath } from "@/lib/login-portals";
import { isInstitutionPublicPath } from "@/lib/institution-portal";
import { isForcedPasswordPathAllowed } from "@/lib/force-password-reset";
import { readOrCreateRequestId, requestIdHeaderName } from "@/lib/request-id";
import { restrictedPathnameHeaderName } from "@/lib/licensing/restricted-ui";

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
  "/api/webhooks",
  "/api/cron",
  "/api/contact",
  "/api/applications/status",
  "/sitemap.xml",
  "/robots.txt",
];

const STATIC_ASSET = /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|css|map)$/i;

function withRequestId(request: NextRequest, response: NextResponse) {
  const requestId = readOrCreateRequestId(request.headers.get(requestIdHeaderName()));
  response.headers.set(requestIdHeaderName(), requestId);
  response.headers.set(restrictedPathnameHeaderName(), request.nextUrl.pathname);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.includes("..")) {
    return withRequestId(request, NextResponse.json({ message: "Not found" }, { status: 404 }));
  }

  // Academic PDFs are fee-gated — only serve via authenticated API routes.
  if (
    pathname.startsWith("/uploads/report-cards") ||
    pathname.startsWith("/uploads/certificates") ||
    pathname.startsWith("/uploads/letters")
  ) {
    return withRequestId(request, NextResponse.json({ message: "Not found" }, { status: 404 }));
  }

  if (pathname.startsWith("/uploads")) {
    // All school uploads (including public branding) go through /api/files so local
    // and S3-backed object storage both work. Branding remains unauthenticated in the API.
    const rewriteUrl = request.nextUrl.clone();
    const relative = pathname.replace(/^\/uploads\//, "");
    rewriteUrl.pathname = `/api/files/${relative}`;
    return withRequestId(request, NextResponse.rewrite(rewriteUrl));
  }

  if (STATIC_ASSET.test(pathname)) {
    return withRequestId(request, NextResponse.next());
  }

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    isInstitutionPublicPath(pathname)
  ) {
    return withRequestId(request, NextResponse.next());
  }

  const session = await getSessionFromRequest(
    request.headers.get("cookie")
  );

  if (!session) {
    if (pathname === "/api/applications" && request.method === "POST") {
      return withRequestId(request, NextResponse.next());
    }
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        request,
        NextResponse.json({ message: "Unauthorized" }, { status: 401 })
      );
    }
    const loginUrl = new URL(unauthenticatedLoginPath(pathname), request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return withRequestId(request, NextResponse.redirect(loginUrl));
  }

  if (session.mustResetPassword && !isForcedPasswordPathAllowed(pathname)) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        request,
        NextResponse.json({ message: "Password change required" }, { status: 403 })
      );
    }
    return withRequestId(request, NextResponse.redirect(new URL("/account/password", request.url)));
  }

  if (pathname.startsWith("/admin") && !canAccessAdmin(session.role)) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  if (pathname.startsWith("/finance") && !canAccessFinance(session.role)) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  if (pathname.startsWith("/hr") && !canAccessHr(session.role)) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  if (pathname.startsWith("/teacher") && session.role !== UserRole.TEACHER && session.role !== UserRole.SUPER_ADMIN) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  if (pathname.startsWith("/student") && pathname !== "/student/login" && session.role !== UserRole.STUDENT && session.role !== UserRole.SUPER_ADMIN) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  if (pathname.startsWith("/parent") && pathname !== "/parent/login" && session.role !== UserRole.PARENT && session.role !== UserRole.SUPER_ADMIN) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  if (pathname.startsWith("/staff") && !canApplyForLeave(session.role)) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  if (pathname.startsWith("/security") && !canAccessSecurityPortal(session.role)) {
    return withRequestId(request, NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url)));
  }

  return withRequestId(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
