import { Fraunces, Mulish } from "next/font/google";

export const publicSerif = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-serif",
});

export const publicSans = Mulish({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-sans",
});
