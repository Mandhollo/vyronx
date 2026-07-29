import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Web3Provider } from "@/components/web3/Web3Provider";
import { Toaster } from "react-hot-toast";

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
  openGraph: {
    title: "VyronX ($VYR) — AI-Powered DeFi Ecosystem",
    description: "AI arbitrage agents, multi-tier staking pools, and a comprehensive utility-driven token economy on BNB Smart Chain.",
    type: "website",
    locale: "en_US",
    siteName: "VyronX",
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
        <Web3Provider>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Web3Provider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#141414',
              color: '#fff',
              border: '1px solid #2a2a2a',
            },
            success: { iconTheme: { primary: '#d4af37', secondary: '#0a0a0a' } },
          }}
        />
      </body>
    </html>
  );
}
