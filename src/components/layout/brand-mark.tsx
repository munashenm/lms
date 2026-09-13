import { cn } from "@/lib/utils";
import { APP_LOGO_URL, APP_NAME } from "@/lib/constants";
import { schoolLogoAlt } from "@/lib/school-branding";

const LOGO_SIZE = {
  sm: "h-8 w-auto max-h-8 max-w-[40px]",
  md: "h-10 w-auto max-h-10 max-w-[140px]",
  lg: "h-16 w-auto max-h-16 max-w-[200px]",
  xl: "h-24 w-auto max-h-24 max-w-[260px]",
} as const;

/** Product wordmark is wide; allow more width than school crest marks. */
const APP_LOGO_SIZE = {
  sm: "h-9 w-auto max-h-9 max-w-[132px]",
  md: "h-11 w-auto max-h-11 max-w-[168px]",
  lg: "h-24 w-auto max-h-24 max-w-[280px]",
  xl: "h-32 w-auto max-h-32 max-w-[360px]",
} as const;

export function SchoolLogo({
  src,
  name,
  size = "md",
  framed = false,
  className,
  appMark = false,
}: {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof LOGO_SIZE;
  framed?: boolean;
  className?: string;
  /** Use wider sizing for the product wordmark logo. */
  appMark?: boolean;
}) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={schoolLogoAlt(name)}
      className={cn(
        "shrink-0 object-contain",
        appMark ? APP_LOGO_SIZE[size] : LOGO_SIZE[size],
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
  const usingAppLogo = !logoUrl;
  const resolvedLogo = logoUrl || APP_LOGO_URL;
  // Product logo already includes the SchoolHub SA wordmark — avoid duplicating it.
  const showTitle = !usingAppLogo || title !== APP_NAME;
  const showSubtitle = Boolean(subtitle) && (showTitle || !usingAppLogo || !stacked);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        stacked && "flex-col text-center"
      )}
    >
      <SchoolLogo
        src={resolvedLogo}
        name={title}
        size={size}
        framed={inverted}
        appMark={usingAppLogo}
      />
      {(showTitle || showSubtitle) && (
        <div className={cn("min-w-0", stacked && "space-y-1")}>
          {showTitle ? (
            <p
              className={cn(
                "font-bold leading-tight truncate",
                size === "xl" || size === "lg" ? "text-xl" : size === "md" ? "text-base" : "text-sm",
                inverted && "text-white"
              )}
            >
              {title}
            </p>
          ) : null}
          {showSubtitle ? (
            <p className={cn("text-[11px] truncate", inverted ? "text-white/70" : "text-muted")}>
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
