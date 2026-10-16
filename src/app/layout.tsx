import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Yesteryear, Jost } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { FooterGate } from "@/components/layout/footer-gate";
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
        <Providers session={session}>
          <Header />
          <ProfileBanner />
          <main className="flex-1">{children}</main>
          <FooterGate />
        </Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
