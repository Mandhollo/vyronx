import Link from 'next/link';
import { Mail, Shield, FileText } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-dark-border bg-dark-card mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gold-light via-gold to-gold-dark flex items-center justify-center">
                <span className="text-dark font-black text-xs">V</span>
              </div>
              <span className="text-lg font-bold">
                <span className="text-white">Vyron</span>
                <span className="text-gold">X</span>
              </span>
            </Link>
            <p className="text-sm text-beige-muted leading-relaxed">
              AI-powered DeFi ecosystem on BNB Smart Chain. Stake, earn, and participate in the future of decentralized finance.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Platform</h3>
            <ul className="space-y-3">
              <li><Link href="/presale" className="text-sm text-beige hover:text-gold transition-colors">Presale</Link></li>
              <li><Link href="/staking" className="text-sm text-beige hover:text-gold transition-colors">Staking Pools</Link></li>
              <li><Link href="/dashboard" className="text-sm text-beige hover:text-gold transition-colors">Dashboard</Link></li>
              <li><Link href="/whitepaper" className="text-sm text-beige hover:text-gold transition-colors">Whitepaper</Link></li>
              <li><Link href="/roadmap" className="text-sm text-beige hover:text-gold transition-colors">Roadmap</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Resources</h3>
            <ul className="space-y-3">
              <li><Link href="/whitepaper#tokenomics" className="text-sm text-beige hover:text-gold transition-colors">Tokenomics</Link></li>
              <li><Link href="/whitepaper#staking" className="text-sm text-beige hover:text-gold transition-colors">Staking</Link></li>
              <li><Link href="/whitepaper#affiliates" className="text-sm token-beige hover:text-gold transition-colors">Affiliate Program</Link></li>
              <li><Link href="/whitepaper#security" className="text-sm text-beige hover:text-gold transition-colors">Security</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Contact</h3>
            <ul className="space-y-3">
              <li>
                <a href="mailto:contato@vyronx.io" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <Mail className="h-4 w-4" /> contato@vyronx.io
                </a>
              </li>
              <li>
                <Link href="/whitepaper#disclaimer" className="flex items-center gap-2 text-sm text-beige hover:text-gold transition-colors">
                  <Shield className="h-4 w-4" /> Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-dark-border flex flex-col md:flex-row justify-between items-center gap-4">
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
