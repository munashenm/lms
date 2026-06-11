import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canAccessAdmin, canAccessFinance } from "@/lib/rbac";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { UserRole } from "@prisma/client";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/apply",
  "/about",
  "/programmes",
  "/fees",
  "/contact",
  "/uploads",
  "/api/webhooks",
  "/api/contact",
  "/api/applications/status",
  "/sitemap.xml",
  "/robots.txt",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !canAccessAdmin(session.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/finance") && !canAccessFinance(session.role)) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/teacher") && session.role !== UserRole.TEACHER && session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/student") && session.role !== UserRole.STUDENT && session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  if (pathname.startsWith("/parent") && session.role !== UserRole.PARENT && session.role !== UserRole.SUPER_ADMIN) {
    return NextResponse.redirect(new URL(ROLE_DASHBOARD[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
