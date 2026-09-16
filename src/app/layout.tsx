import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME, DEFAULT_BRAND_MARK_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: `Modern school management system for South African schools, colleges and TVETs by ${COMPANY_NAME}.`,
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: DEFAULT_BRAND_MARK_URL, type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA" className="h-full">
      <body className="min-h-full antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
