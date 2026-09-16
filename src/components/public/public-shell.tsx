import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import { publicSans, publicSerif } from "./public-fonts";
import { schoolThemeCssVars } from "@/lib/school-branding";
import {
  formatSchoolAddress,
  publicAcademicsHref,
  publicAcademicsLabel,
  type PublicSchool,
} from "@/lib/public-site";
import { cn } from "@/lib/utils";

interface PublicShellProps {
  children: React.ReactNode;
  school?: PublicSchool | null;
  schoolName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export function PublicShell({
  children,
  school,
  schoolName,
  logoUrl,
  primaryColor,
  accentColor,
}: PublicShellProps) {
  const name = school?.name ?? schoolName;
  const logo = school?.logoUrl ?? logoUrl;
  const primary = school?.primaryColor ?? primaryColor;
  const accent = school?.accentColor ?? accentColor;
  const academicsHref = publicAcademicsHref(school?.institutionType);
  const academicsLabel = publicAcademicsLabel(school?.institutionType);

  return (
    <div
      className={cn("public-site flex min-h-screen flex-col", publicSans.variable, publicSerif.variable)}
      style={schoolThemeCssVars(primary, accent)}
    >
      <PublicHeader
        schoolName={name}
        logoUrl={logo}
        academicsHref={academicsHref}
        academicsLabel={academicsLabel}
      />
      <main className="flex-1">{children}</main>
      <PublicFooter
        schoolName={name}
        logoUrl={logo}
        aboutText={school?.aboutText}
        email={school?.email}
        phone={school?.phone}
        whatsapp={school?.whatsapp}
        address={school ? formatSchoolAddress(school) : undefined}
        facebookUrl={school?.facebookUrl}
        instagramUrl={school?.instagramUrl}
        twitterUrl={school?.twitterUrl}
        linkedinUrl={school?.linkedinUrl}
        youtubeUrl={school?.youtubeUrl}
        website={school?.website}
        academicsHref={academicsHref}
        academicsLabel={academicsLabel}
      />
    </div>
  );
}
