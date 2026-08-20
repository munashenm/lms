import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export function BrandMark({
  logoUrl,
  name,
  subtitle,
  inverted = false,
  compact = false,
}: {
  logoUrl?: string | null;
  name?: string | null;
  subtitle?: string | null;
  inverted?: boolean;
  compact?: boolean;
}) {
  const title = name?.trim() || APP_NAME;
  const iconClass = inverted ? "text-accent" : "text-primary";
  const size = compact ? "h-8 w-8" : "h-7 w-7";

  return (
    <div className="flex items-center gap-2 min-w-0">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className={cn(
            "shrink-0 object-contain rounded bg-white/90",
            compact ? "h-8 w-8" : "h-8 w-8 max-w-[40px]"
          )}
        />
      ) : (
        <Building2 className={cn(size, "shrink-0", iconClass)} />
      )}
      <div className="min-w-0">
        <p className={cn("text-sm font-bold leading-tight truncate", inverted && "text-white")}>
          {title}
        </p>
        {subtitle ? (
          <p className={cn("text-[10px] truncate", inverted ? "text-white/60" : "text-muted")}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
