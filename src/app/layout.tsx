import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Yesteryear, Jost } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { FooterGate } from "@/components/layout/footer-gate";
import { Footer } from "@/components/layout/footer";
import { ProfileBanner } from "@/components/layout/profile-banner";
import { RegisterServiceWorker } from "@/components/pwa/service-worker-registration";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni-moda",
  subsets: ["latin"],
});

const yesteryear = Yesteryear({
  variable: "--font-yesteryear",
  weight: "400",
  subsets: ["latin"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_TAGLINE,
  // iOS ignores the web app manifest's icons and uses these instead when the
  // site is added to the home screen; appleWebApp makes it open full-screen
  // (no Safari address bar), like the manifest's display: "standalone".
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Nail Image", statusBarStyle: "default" },
};

// Colors the browser/OS chrome (Android status bar, installed-app title bar)
// to match the site's navy. Same value as the manifest's theme_color.
export const viewport: Viewport = {
  themeColor: "#16212c",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${bodoniModa.variable} ${yesteryear.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* First thing a keyboard or screen-reader user reaches: jumps past
            the sticky header's links. Hidden until focused. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-foreground focus:px-4 focus:py-3 focus:text-background"
        >
          Skip to content
        </a>
        <Providers session={session}>
          <Header />
          <ProfileBanner />
          {/* tabIndex -1 so the skip link moves focus here, not just the
              scroll position. */}
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <FooterGate>
            <Footer />
          </FooterGate>
        </Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
