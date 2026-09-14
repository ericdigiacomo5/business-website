import type { Metadata } from "next";
import { Bodoni_Moda, Yesteryear, Jost } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { FooterGate } from "@/components/layout/footer-gate";
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
          <main className="flex-1">{children}</main>
          <FooterGate />
        </Providers>
      </body>
    </html>
  );
}
