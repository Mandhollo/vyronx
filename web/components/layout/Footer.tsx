'use client';

import Link from 'next/link';
import { Mail, Shield, FileText, Send, MessageCircle } from 'lucide-react';
import ContractAddress from '@/components/web3/ContractAddress';
import { TOKEN_ADDRESS, PRESALE_ADDRESS, STAKING_ADDRESS, USDT_ADDRESS } from '@/lib/contracts';

// Custom X icon
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Custom Instagram icon
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
import { useI18n } from '@/lib/i18n';
import Coin3D from '@/components/fx/Coin3D';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-dark-border bg-dark-card mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Coin3D size={32} />
              <span className="text-lg font-bold">
                <span className="text-white">Vyron</span>
                <span className="text-gold">X</span>
              </span>
            </Link>
            <p className="text-sm text-beige-muted leading-relaxed">
              {t('footer.tagline')}
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">{t('footer.platform')}</h3>
            <ul className="space-y-3">
              <li><Link href="/presale" className="text-sm text-beige hover:text-gold transition-colors">{t('nav.presale')}</Link></li>
              <li><Link href="/staking" className="text-sm text-beige hover:text-gold transition-colors">{t('nav.staking')}</Link></li>
              <li><Link href="/dashboard" className="text-sm text-beige hover:text-gold transition-colors">{t('nav.dashboard')}</Link></li>
              {/* Admin hidden from footer — authorized wallets only */}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">{t('footer.resources')}</h3>
            <ul className="space-y-3">
              <li><Link href="/whitepaper" className="text-sm text-beige hover:text-gold transition-colors">{t('nav.whitepaper')}</Link></li>
              <li><Link href="/roadmap" className="text-sm text-beige hover:text-gold transition-colors">{t('nav.roadmap')}</Link></li>
              <li><Link href="/whitepaper#tokenomics" className="text-sm text-beige hover:text-gold transition-colors">{t('section.tokenomics')}</Link></li>
              <li><Link href="/whitepaper#staking" className="text-sm text-beige hover:text-gold transition-colors">{t('section.staking')}</Link></li>
              <li><Link href="/whitepaper#affiliates" className="text-sm token-beige hover:text-gold transition-colors">{t('stats.levels')}</Link></li>
              <li><Link href="/whitepaper#security" className="text-sm text-beige hover:text-gold transition-colors">{t('feat.secure')}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">{t('footer.contact')}</h3>
            <ul className="space-y-3">
              <li>
                <a href="https://t.me/vyrontoken" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <MessageCircle className="h-4 w-4" /> Telegram Group
                </a>
              </li>
              <li>
                <a href="https://t.me/tokenvyron" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <Send className="h-4 w-4" /> Telegram Channel
                </a>
              </li>
              <li>
                <a href="https://x.com/vyronx_io" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <XIcon className="h-4 w-4" /> X (Twitter)
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/vyronx.io/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <InstagramIcon className="h-4 w-4" /> Instagram
                </a>
              </li>
              <li>
                <a href="mailto:contato@vyronx.io" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <Mail className="h-4 w-4" /> contato@vyronx.io
                </a>
              </li>
              <li>
                <Link href="/whitepaper#disclaimer" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <Shield className="h-4 w-4" /> {t('footer.disclaimer')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Contract Addresses */}
        <div className="mt-10 pt-8 border-t border-dark-border">
          <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Verified Contracts (BSC)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ContractAddress address={TOKEN_ADDRESS} label="VYR Token" />
            <ContractAddress address={PRESALE_ADDRESS} label="Presale" />
            <ContractAddress address={STAKING_ADDRESS} label="Staking" />
            <ContractAddress address={USDT_ADDRESS} label="USDT" showLink={false} />
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-dark-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-beige-muted">
            © 2026 VyronX. All rights reserved.
          </p>
          <p className="text-xs text-beige-muted max-w-xl">
            $VYR is a utility token on BNB Smart Chain. Participation in DeFi involves inherent risks. Always DYOR (Do Your Own Research).
          </p>
        </div>
      </div>
    </footer>
  );
}
