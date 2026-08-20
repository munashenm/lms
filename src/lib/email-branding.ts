import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  normalizeHexColor,
} from "./school-branding";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(body: string): string {
  const escaped = escapeHtml(body);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:inherit;text-decoration:underline">$1</a>'
  );
  return linked.replace(/\n/g, "<br/>");
}

export function absoluteAssetUrl(path: string | null | undefined, appUrl?: string): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function brandedEmailHtml(opts: {
  schoolName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  title: string;
  bodyText: string;
}): string {
  const primary = normalizeHexColor(opts.primaryColor, DEFAULT_PRIMARY_COLOR);
  const accent = normalizeHexColor(opts.accentColor, DEFAULT_ACCENT_COLOR);
  const logo = absoluteAssetUrl(opts.logoUrl);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 0">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
          <tr>
            <td style="background:${primary};padding:20px 28px;color:#ffffff">
              ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(opts.schoolName)}" height="48" style="max-height:48px;max-width:180px;display:block;margin-bottom:10px;background:#ffffff;padding:6px;border-radius:8px" />` : ""}
              <p style="margin:0;font-size:16px;font-weight:bold">${escapeHtml(opts.schoolName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px">
              <p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:${primary}">${escapeHtml(opts.title)}</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#334155">${textToHtml(opts.bodyText)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f8fafc;border-top:3px solid ${accent};font-size:11px;color:#64748b">
              © ${year} ${escapeHtml(opts.schoolName)}. This message was sent by your school portal.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
