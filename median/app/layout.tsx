import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { UtilityBar } from "@/components/UtilityBar";
import { themeScript } from "@/components/ThemeToggle";
import { getState } from "@/lib/store";
import { getRates, getWeather } from "@/lib/widgets";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Median — Știri din România și din lume, actualizate la 5 minute", template: "%s · Median" },
  description:
    "Median adună automat știrile din zeci de publicații românești și le grupează pe subiecte: actualitate, politică, economie, internațional, sport, tech, lifestyle și multe altele.",
  applicationName: "Median",
  keywords: ["știri", "stiri", "România", "ultima oră", "agregator", "actualitate", "politică", "economie", "sport"],
  openGraph: { type: "website", siteName: "Median", locale: "ro_RO" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [state, rates, weather] = await Promise.all([getState(), getRates(), getWeather()]);
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a href="#continut" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
          Sari la conținut
        </a>
        <Header utility={<UtilityBar rates={rates} weather={weather} updatedAt={state.updatedAt} sourcesOk={state.sourcesOk} />} />
        {state.demo && (
          <div className="border-b border-amber-300/50 bg-amber-100 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="mx-auto max-w-7xl px-4 py-2 text-center text-xs sm:px-6">
              <b>Mod demo:</b> serverul nu poate accesa momentan sursele de știri, așa că afișăm conținut demonstrativ. Știrile reale apar automat
              imediat ce conexiunea este disponibilă.
            </p>
          </div>
        )}
        <div id="continut">{children}</div>
        <Footer sourcesTotal={state.sourcesTotal} />
        <BottomNav />
      </body>
    </html>
  );
}
