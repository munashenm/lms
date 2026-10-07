import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { ROLE_DASHBOARD } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import {
  portalForRole,
  portalMismatchMessage,
  roleAllowedForPortal,
} from "@/lib/login-portals";
import {
  evaluateBrandedLoginTenant,
  getSchoolBySlug,
  institutionHomePath,
  institutionLoginPath,
} from "@/lib/institution-portal";
import { clientIp, rateLimit, rateLimitedJson } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/request-meta";
import { FORCE_PASSWORD_PATH } from "@/lib/force-password-reset";

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
    const ipLimit = rateLimit({ key: `login:ip:${ip}`, limit: 20, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.ok) {
      const limited = rateLimitedJson(ipLimit.retryAfterSec);
      return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers });
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString() ?? "form";
        errors[key] = issue.message;
      });
      return NextResponse.json({ errors }, { status: 400 });
    }

    const { email, password, portal, schoolSlug } = parsed.data;
    const emailKey = email.toLowerCase();
    const emailLimit = rateLimit({
      key: `login:email:${ip}:${emailKey}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimit.ok) {
      const limited = rateLimitedJson(emailLimit.retryAfterSec);
      return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers });
    }

    const portalSchool = schoolSlug ? await getSchoolBySlug(schoolSlug) : null;
    if (schoolSlug && !portalSchool) {
      return NextResponse.json({ message: "Institution portal not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: emailKey },
      include: { school: { select: { id: true, name: true, slug: true, isActive: true } } },
    });

    const meta = requestMeta(request);

    if (!user || !user.isActive) {
      await logAudit({
        action: "LOGIN_FAILED",
        entity: "User",
        metadata: { reason: "invalid_credentials" },
        ...meta,
      });
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logAudit({
        schoolId: user.schoolId,
        userId: user.id,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user.id,
        metadata: { reason: "invalid_credentials" },
        ...meta,
      });
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (portal && !roleAllowedForPortal(user.role, portal)) {
      const mismatch = portalMismatchMessage(user.role, portal);
      return NextResponse.json(
        { message: mismatch.message, redirect: mismatch.redirect },
        { status: 403 }
      );
    }

    if (portalSchool) {
      const tenant = evaluateBrandedLoginTenant({
        userSchoolId: user.schoolId,
        portalSchoolId: portalSchool.id,
        userRole: user.role,
      });
      if (!tenant.ok) {
        const homeSchool = user.school?.isActive ? user.school : null;
        const correctPortal = homeSchool?.slug
          ? institutionLoginPath(homeSchool.slug, portalForRole(user.role))
          : portalMismatchMessage(user.role, portal ?? portalForRole(user.role)).redirect;
        await logAudit({
          schoolId: user.schoolId,
          userId: user.id,
          action: "LOGIN_FAILED",
          entity: "User",
          entityId: user.id,
          metadata: {
            reason: "portal_school_mismatch",
            attemptedSlug: portalSchool.slug,
          },
          ...meta,
        });
        return NextResponse.json(
          {
            code: "PORTAL_SCHOOL_MISMATCH",
            message: homeSchool
              ? `This account belongs to ${homeSchool.name}. Please use the ${homeSchool.name} portal.`
              : "This account does not belong to this institution portal.",
            correctSchoolName: homeSchool?.name ?? null,
            redirect: homeSchool?.slug ? institutionHomePath(homeSchool.slug) : correctPortal,
            loginRedirect: correctPortal,
          },
          { status: 403 }
        );
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const session = {
      userId: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      firstName: user.firstName,
      lastName: user.lastName,
      mustResetPassword: user.mustResetPassword,
      sessionVersion: user.sessionVersion,
    };

    const token = await createToken(session);
    await setSessionCookie(token);

    await logAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ...meta,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      redirect: user.mustResetPassword ? FORCE_PASSWORD_PATH : ROLE_DASHBOARD[user.role],
      mustResetPassword: user.mustResetPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    const message =
      error instanceof Error && error.message.includes("Can't reach database")
        ? "Database is not running. Start PostgreSQL, then run: npm run db:push && npm run db:seed"
        : "An error occurred during login";
    return NextResponse.json({ message }, { status: 500 });
  }
}
