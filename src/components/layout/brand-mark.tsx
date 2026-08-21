"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { schoolLogoAlt } from "@/lib/school-branding";

const LOGO_SIZE = {
  sm: "h-8 w-auto max-h-8 max-w-[40px]",
  md: "h-10 w-auto max-h-10 max-w-[140px]",
  lg: "h-16 w-auto max-h-16 max-w-[200px]",
  xl: "h-24 w-auto max-h-24 max-w-[260px]",
} as const;

const ICON_SIZE = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
} as const;

export function SchoolLogo({
  src,
  name,
  size = "md",
  framed = false,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof LOGO_SIZE;
  framed?: boolean;
  className?: string;
}) {
  if (!src) return null;
  return <SchoolLogoImage src={src} name={name} size={size} framed={framed} className={className} />;
}

function SchoolLogoImage({
  src,
  name,
  size,
  framed,
  className,
}: {
  src: string;
  name?: string | null;
  size: keyof typeof LOGO_SIZE;
  framed: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={schoolLogoAlt(name)}
      onError={() => setFailed(true)}
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
  const iconClass = inverted ? "text-accent" : "text-primary";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        stacked && "flex-col text-center"
      )}
    >
      {logoUrl ? (
        <SchoolLogo src={logoUrl} name={title} size={size} framed={inverted} />
      ) : (
        <Building2 className={cn(ICON_SIZE[size], "shrink-0", iconClass)} />
      )}
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
