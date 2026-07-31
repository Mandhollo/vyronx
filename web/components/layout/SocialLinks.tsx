'use client';

import { Send, MessageCircle } from 'lucide-react';

// Custom X (Twitter) icon
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

interface SocialLinksProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function SocialLinks({ size = 'md', className = '' }: SocialLinksProps) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const btnSize = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Telegram Group */}
      <a
        href="https://t.me/vyrontoken"
        target="_blank"
        rel="noreferrer"
        className={`${btnSize} flex items-center justify-center rounded-lg border border-dark-border bg-dark-card/50 text-beige hover:text-gold hover:border-gold/40 hover:bg-gold/5 transition-all magnetic-btn`}
        title="Telegram Group"
        aria-label="Telegram Group"
      >
        <MessageCircle className={iconSize} />
      </a>

      {/* Telegram Channel */}
      <a
        href="https://t.me/tokenvyron"
        target="_blank"
        rel="noreferrer"
        className={`${btnSize} flex items-center justify-center rounded-lg border border-dark-border bg-dark-card/50 text-beige hover:text-gold hover:border-gold/40 hover:bg-gold/5 transition-all magnetic-btn`}
        title="Telegram Channel"
        aria-label="Telegram Channel"
      >
        <Send className={iconSize} />
      </a>

      {/* X (Twitter) */}
      <a
        href="https://x.com/vyronx_io"
        target="_blank"
        rel="noreferrer"
        className={`${btnSize} flex items-center justify-center rounded-lg border border-dark-border bg-dark-card/50 text-beige hover:text-gold hover:border-gold/40 hover:bg-gold/5 transition-all magnetic-btn`}
        title="X (Twitter)"
        aria-label="X (Twitter)"
      >
        <XIcon className={iconSize} />
      </a>

      {/* Instagram */}
      <a
        href="https://www.instagram.com/vyronx.io/"
        target="_blank"
        rel="noreferrer"
        className={`${btnSize} flex items-center justify-center rounded-lg border border-dark-border bg-dark-card/50 text-beige hover:text-gold hover:border-gold/40 hover:bg-gold/5 transition-all magnetic-btn`}
        title="Instagram"
        aria-label="Instagram"
      >
        <InstagramIcon className={iconSize} />
      </a>
    </div>
  );
}
