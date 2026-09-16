import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";
import { schoolThemeCssVars } from "@/lib/school-branding";
import {
  formatSchoolAddress,
  publicAcademicsHref,
  publicAcademicsLabel,
  type PublicSchool,
} from "@/lib/public-site";
import { applyCtaLabel, admissionYearLabel } from "@/lib/admissions";

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
  const applyLabel = applyCtaLabel(admissionYearLabel(school?.admissionYear));

  return (
    <div
      className="flex min-h-screen flex-col"
      style={schoolThemeCssVars(primary, accent)}
    >
      <PublicHeader
        schoolName={name}
        logoUrl={logo}
        academicsHref={academicsHref}
        academicsLabel={academicsLabel}
        applyLabel={applyLabel}
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
