import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Masthead, themeScript } from "@/components/masthead";
import { weatherLabel } from "@/components/weather";
import { config } from "@/lib/core/config";
import { aiMode, siteStatus } from "@/lib/data/queries";
import { formatTime } from "@/lib/core/utils";
import { getRates, getWeather } from "@/lib/data/widgets";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: { default: "Median — Știrile zilei, cântărite", template: "%s · Median" },
  description:
    "Median sintetizează știrile din zeci de publicații românești: un singur articol complet pe subiect, cu toate sursele la vedere. Actualizat la fiecare 5 minute.",
  applicationName: "Median",
  openGraph: { type: "website", siteName: "Median", locale: "ro_RO" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  robots: { index: true, follow: true, "max-image-preview": "large" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [rates, weather] = await Promise.all([getRates().catch(() => null), getWeather().catch(() => null)]);
  const status = siteStatus();
  const buc = weather?.[0];
  const eur = rates?.rates.find((r) => r.code === "EUR");
  const usd = rates?.rates.find((r) => r.code === "USD");
  const utility = (
    <>
      {buc && (
        <span>
          București <b className="mono font-medium text-ink">{buc.temp}°</b> · {weatherLabel(buc.code)}
        </span>
      )}
      {eur && (
        <span>
          EUR <b className="mono font-medium text-ink">{eur.value.toFixed(4).replace(".", ",")}</b>
        </span>
      )}
      {usd && (
        <span>
          USD <b className="mono font-medium text-ink">{usd.value.toFixed(4).replace(".", ",")}</b>
        </span>
      )}
      {status.lastFetch > 0 && (
        <span className="hidden lg:inline" suppressHydrationWarning>
          Actualizat la <b className="mono font-medium text-ink">{formatTime(status.lastFetch)}</b>
        </span>
      )}
    </>
  );
  return (
    <html lang="ro" suppressHydrationWarning>
      <body>
        <Script id="tema" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <a href="#continut" className="ui sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink">
          Sari la conținut
        </a>
        <Masthead utility={utility} />
        {status.demo && (
          <div className="ui border-b border-rule bg-surface">
            <p className="mx-auto max-w-[1320px] px-4 py-2 text-[12px] text-ink-2 sm:px-8">
              <b className="text-ink">Mod demonstrativ.</b> Publicațiile, persoanele și știrile afișate sunt fictive, generate pentru testarea
              sistemului. În producție, Median preia fluxurile reale ale publicațiilor românești.
            </p>
          </div>
        )}
        <div id="continut">{children}</div>
        <Footer ai={aiMode()} />
      </body>
    </html>
  );
}
