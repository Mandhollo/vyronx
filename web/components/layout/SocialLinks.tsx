'use client';

import { Send, MessageCircle } from 'lucide-react';

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
    </div>
  );
}
