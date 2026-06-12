import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: `Modern school management system for South African schools, colleges and TVETs by ${COMPANY_NAME}.`,
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
