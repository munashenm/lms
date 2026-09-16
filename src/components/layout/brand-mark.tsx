"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { APP_NAME, DEFAULT_BRAND_LOGO_URL, DEFAULT_BRAND_MARK_URL } from "@/lib/constants";
import { resolveBrandMark, schoolLogoAlt } from "@/lib/school-branding";

const LOGO_SIZE = {
  sm: "h-8 w-auto max-h-8 max-w-[72px]",
  md: "h-12 w-auto max-h-12 max-w-[180px]",
  lg: "h-16 w-auto max-h-16 max-w-[220px]",
  xl: "h-24 w-auto max-h-24 max-w-[280px]",
} as const;

export function SchoolLogo({
  src,
  name,
  size = "md",
  framed = false,
  className,
  fallbackSrc = DEFAULT_BRAND_LOGO_URL,
}: {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof LOGO_SIZE;
  framed?: boolean;
  className?: string;
  fallbackSrc?: string;
}) {
  const initialSrc = src?.trim() || fallbackSrc;
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const displaySrc = failedFor === initialSrc ? fallbackSrc : initialSrc;
  if (!displaySrc) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={schoolLogoAlt(name)}
      onError={() => {
        if (initialSrc !== fallbackSrc) setFailedFor(initialSrc);
      }}
      className={cn(
        "shrink-0 object-contain",
        LOGO_SIZE[size],
        framed && "rounded-xl bg-white p-2",
        className
      )}
    />
  );
}

export function BrandMark({
  logoUrl,
  name,
  subtitle,
  inverted = false,
  size = "sm",
  stacked = false,
}: {
  logoUrl?: string | null;
  name?: string | null;
  subtitle?: string | null;
  inverted?: boolean;
  size?: keyof typeof LOGO_SIZE;
  stacked?: boolean;
}) {
  const title = name?.trim() || APP_NAME;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        stacked && "flex-col text-center"
      )}
    >
      <SchoolLogo
        src={resolveBrandMark(logoUrl)}
        name={title}
        size={size}
        framed={inverted}
        fallbackSrc={DEFAULT_BRAND_MARK_URL}
      />
      <div className={cn("min-w-0", stacked && "space-y-1")}>
        <p
          className={cn(
            "font-bold leading-tight truncate",
            size === "xl" || size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-sm",
            inverted && "text-white"
          )}
        >
          {title}
        </p>
        {subtitle ? (
          <p className={cn("text-[11px] truncate", inverted ? "text-white/70" : "text-muted")}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
