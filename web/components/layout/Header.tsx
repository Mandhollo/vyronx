'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown } from 'lucide-react';
import ConnectButton from '@/components/web3/ConnectButton';

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Presale', href: '/presale' },
  { label: 'Staking', href: '/staking' },
  { label: 'Whitepaper', href: '/whitepaper' },
  { label: 'Roadmap', href: '/roadmap' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'glass border-b border-dark-border/50 py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-gold-light via-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/30 group-hover:scale-105 transition-transform">
              <span className="text-dark font-black text-sm">V</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-moss border border-dark" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-white">Vyron</span>
              <span className="text-gold-gradient">X</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    active
                      ? 'text-gold bg-gold/10'
                      : 'text-beige hover:text-gold hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA Button — replaced with real Web3 ConnectButton */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/presale"
              className="px-5 py-2.5 text-sm font-bold rounded-lg border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors"
            >
              Buy $VYR
            </Link>
            <ConnectButton />
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-white hover:text-gold transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="absolute top-0 right-0 h-full w-72 glass border-l border-dark-border p-6 pt-24 flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-3 text-base font-medium rounded-lg transition-all ${
                    active
                      ? 'text-gold bg-gold/10'
                      : 'text-beige hover:text-gold hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/presale"
              className="mt-4 px-5 py-3 text-center text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark"
            >
              Buy $VYR
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
