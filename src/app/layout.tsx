import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Manrope } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const manrope = Manrope({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BurnRate | See What Your Subscriptions Really Cost",
  description:
    "A free subscription tracker that shows your real monthly and yearly burn rate, tracks free trials before they auto-charge, and helps you find savings. No account needed — runs entirely in your browser.",
  metadataBase: new URL("https://burnrate-bay.vercel.app"),
  openGraph: {
    title: "BurnRate | See What Your Subscriptions Really Cost",
    description:
      "Track every subscription, spot free trials before they charge, and simulate cancellations to find savings. 100% free, no sign-up, runs in your browser.",
    url: "https://burnrate-bay.vercel.app",
    siteName: "BurnRate",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BurnRate — Subscription Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BurnRate |See What Your Subscriptions Really Cost",
    description:
      "Free subscription tracker. See your real burn rate, track trials, simulate cancellations.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
