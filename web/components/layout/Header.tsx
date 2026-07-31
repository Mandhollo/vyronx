'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown } from 'lucide-react';
import ConnectButton from '@/components/web3/ConnectButton';
import LanguageSelector from '@/components/layout/LanguageSelector';
import Coin3D from '@/components/fx/Coin3D';
import { SocialLinks } from '@/components/layout/SocialLinks';
import { useI18n } from '@/lib/i18n';

const NAV_ITEMS = [
  { labelKey: 'nav.home', href: '/' },
  { labelKey: 'nav.presale', href: '/presale' },
  { labelKey: 'nav.staking', href: '/staking' },
  { labelKey: 'nav.dashboard', href: '/dashboard' },
  { labelKey: 'nav.admin', href: '/admin' },
  { labelKey: 'nav.whitepaper', href: '/whitepaper' },
  { labelKey: 'nav.roadmap', href: '/roadmap' },
];

export default function Header() {
  const { t } = useI18n();
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
            <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform">
              <Coin3D size={36} />
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
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          {/* CTA Button — replaced with real Web3 ConnectButton */}
          <div className="hidden lg:flex items-center gap-2">
            <SocialLinks size="sm" />
            <LanguageSelector />
            <Link
              href="/presale"
              className="px-5 py-2.5 text-sm font-bold rounded-lg border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors"
            >
              {t('nav.buy')}
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
                  {t(item.labelKey)}
                </Link>
              );
            })}
            <Link
              href="/presale"
              className="mt-4 px-5 py-3 text-center text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark"
            >
              {t('nav.buy')}
            </Link>
            <div className="mt-4"><LanguageSelector /></div>
            <div className="mt-3"><SocialLinks /></div>
          </nav>
        </div>
      )}
    </>
  );
}
