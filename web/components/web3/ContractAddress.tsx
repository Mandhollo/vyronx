'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  address: string;
  label?: string;
  short?: boolean;
  showLink?: boolean;
  className?: string;
}

export default function ContractAddress({ address, label, short = true, showLink = true, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success(`${label || 'Address'} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const display = short
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs text-beige-muted">{label}:</span>}
      <code className="text-xs sm:text-sm font-mono text-gold truncate">{display}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1 rounded hover:bg-gold/10 transition-colors"
        title="Copy address"
      >
        {copied
          ? <Check className="h-3.5 w-3.5 text-green-400" />
          : <Copy className="h-3.5 w-3.5 text-beige-muted hover:text-gold" />}
      </button>
      {showLink && (
        <a
          href={`https://bscscan.com/address/${address}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 p-1 rounded hover:bg-gold/10 transition-colors"
          title="View on BscScan"
        >
          <ExternalLink className="h-3.5 w-3.5 text-beige-muted hover:text-gold" />
        </a>
      )}
    </div>
  );
}
