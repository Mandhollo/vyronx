import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Web3Provider } from "@/components/web3/Web3Provider";
import RefCapture from "@/components/web3/RefCapture";
import { Toaster } from "react-hot-toast";
import CoinConfetti from "@/components/effects/CoinConfetti";
import { ScrollProgress, CustomCursor } from "@/components/fx/CursorFX";
import { I18nProvider } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VyronX ($VYR) — AI-Powered DeFi Ecosystem on BNB Chain",
    template: "%s | VyronX",
  },
  description:
    "VyronX is a next-generation DeFi ecosystem on BNB Smart Chain featuring AI arbitrage agents, multi-tier staking pools, and a comprehensive utility-driven token economy.",
  keywords: ["VyronX", "VYR", "DeFi", "BEP-20", "BNB Chain", "Staking", "AI Arbitrage", "Presale"],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: "VyronX ($VYR) — AI-Powered DeFi Ecosystem",
    description: "AI arbitrage agents, multi-tier staking pools, and a comprehensive utility-driven token economy on BNB Smart Chain.",
    type: "website",
    locale: "en_US",
    siteName: "VyronX",
    images: ['/vyronx-og.jpeg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: "VyronX ($VYR) — AI-Powered DeFi Ecosystem",
    description: "AI arbitrage agents, multi-tier staking pools, and a comprehensive utility-driven token economy on BNB Smart Chain.",
    images: ['/vyronx-og.jpeg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ScrollProgress />
        <CustomCursor />
        <I18nProvider>
        <Web3Provider>
          <RefCapture />
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Web3Provider>
        </I18nProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: Infinity,
            style: {
              background: '#141414',
              color: '#fff',
              border: '1px solid #2a2a2a',
            },
            success: { iconTheme: { primary: '#d4af37', secondary: '#0a0a0a' } },
            error: { duration: Infinity },
            loading: { duration: Infinity },
          }}
        />
        <CoinConfetti />
      </body>
    </html>
  );
}
