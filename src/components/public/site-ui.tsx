import Link from "next/link";
import { cn } from "@/lib/utils";
import { emphasizeLastWord } from "@/lib/public-site";

export function SiteEyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("site-eyebrow", className)}>{children}</span>;
}

export function SiteHeading({
  as: Tag = "h2",
  children,
  className,
}: {
  as?: "h1" | "h2" | "h3";
  children: React.ReactNode;
  className?: string;
}) {
  return <Tag className={cn("font-normal", className)}>{children}</Tag>;
}

export function EmphasizedTitle({
  text,
  as: Tag = "h1",
  className,
}: {
  text: string;
  as?: "h1" | "h2";
  className?: string;
}) {
  const { lead, emphasis } = emphasizeLastWord(text);
  return (
    <Tag className={className}>
      {lead}
      <em>{emphasis}</em>
    </Tag>
  );
}

export function SiteSection({
  children,
  alt = false,
  tight = false,
  className,
}: {
  children: React.ReactNode;
  alt?: boolean;
  tight?: boolean;
  className?: string;
}) {
  return (
    <section className={cn(tight ? "py-14" : "py-[84px]", alt && "bg-[var(--site-paper-2)]", className)}>
      <div className="mx-auto max-w-[1180px] px-7">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-[42rem] mb-[42px]">
      {eyebrow ? <SiteEyebrow>{eyebrow}</SiteEyebrow> : null}
      <h2 className="text-[length:var(--site-h2)] font-normal mt-[0.35em] mb-[0.4em]">{title}</h2>
      {description ? <p className="text-[1.05rem] text-[var(--site-muted)]">{description}</p> : null}
    </div>
  );
}

export function SiteLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("site-read", className)}>
      {children}
    </Link>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  imageUrl,
  align = "left",
  emphasize = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  align?: "left" | "center";
  emphasize?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-primary text-white flex items-center",
        imageUrl ? "min-h-[420px] sm:min-h-[480px]" : "min-h-[320px]"
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background: imageUrl
            ? "linear-gradient(to bottom, color-mix(in srgb, var(--primary) 78%, #000), color-mix(in srgb, var(--primary) 62%, #000))"
            : "radial-gradient(900px 400px at 85% -20%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 60%)",
        }}
      />
      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-[1180px] px-7 py-16 sm:py-20",
          align === "center" && "text-center"
        )}
      >
        {eyebrow ? <SiteEyebrow className="text-[var(--accent)]">{eyebrow}</SiteEyebrow> : null}
        {emphasize ? (
          <EmphasizedTitle
            text={title}
            className={cn("page-title", align === "center" && "center")}
          />
        ) : (
          <h1 className={cn("page-title", align === "center" && "center")}>{title}</h1>
        )}
        {description ? (
          <p
            className={cn(
              "text-[length:var(--site-lead)] text-white/80 whitespace-pre-wrap",
              align === "center" ? "max-w-[40em] mx-auto" : "max-w-[40em]"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-[14px] p-7 border border-[var(--site-line)]">
      <div className="w-[46px] h-[46px] rounded-xl border-[1.5px] border-[var(--accent-dark)] text-[var(--accent-dark)] grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="text-[1.1rem] mb-1.5">{title}</h3>
      <p className="text-[0.93rem] text-[var(--site-muted)]">{description}</p>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-[var(--site-line)] bg-white px-6 py-12 text-center text-sm text-[var(--site-muted)]">
      {children}
    </div>
  );
}

export function CtaBand({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="text-center text-white" style={{ background: "linear-gradient(120deg, var(--primary), var(--primary-light))" }}>
      <div className="mx-auto max-w-[1180px] px-7 py-[74px]">
        {eyebrow ? <SiteEyebrow className="text-[var(--accent)]">{eyebrow}</SiteEyebrow> : null}
        <h2 className="text-white text-[length:var(--site-h2)] font-normal mb-[0.4em] mt-[0.3em]">{title}</h2>
        {description ? <p className="text-white/80 max-w-[34em] mx-auto mb-8">{description}</p> : null}
        <div className="flex flex-wrap justify-center gap-3.5">
          <Link href={primaryHref} className="site-btn site-btn-gold site-btn-arrow">
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className="site-btn site-btn-ghost">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
