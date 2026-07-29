'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState } from 'react';
import { Wallet, Loader2, Check, ChevronDown, Copy, LogOut, ExternalLink } from 'lucide-react';
import { bscTestnet } from 'wagmi/chains';

export default function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const onCorrectChain = chain?.id === bscTestnet.id;

  // Not connected
  if (!isConnected) {
    return (
      <button
        onClick={async () => {
          const c = connectors[0];
          if (c) await connectAsync({ connector: c });
        }}
        disabled={isPending}
        className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 hover:scale-[1.03] transition-all disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  // Connected
  return (
    <div className="hidden lg:block relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg border border-dark-border bg-dark-card text-white hover:border-gold/30 transition-colors"
      >
        <span className={`h-2 w-2 rounded-full ${onCorrectChain ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        {shortAddr}
        <ChevronDown className="h-4 w-4 text-beige-muted" />
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-dark-border bg-dark-card shadow-xl z-50 p-2">
            <div className="px-3 py-2 border-b border-dark-border">
              <div className="text-xs text-beige-muted">Connected to</div>
              <div className="text-sm font-mono text-white truncate">{address}</div>
            </div>
            {!onCorrectChain && (
              <div className="px-3 py-2 m-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="text-xs text-red-400 font-bold">⚠ Wrong Network</div>
                <div className="text-xs text-beige-muted mt-0.5">Switch to BSC Testnet</div>
              </div>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(address || '')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-beige hover:text-gold hover:bg-gold/5 rounded-lg transition-colors"
            >
              <Copy className="h-4 w-4" /> Copy Address
            </button>
            <a
              href={`https://testnet.bscscan.com/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-beige hover:text-gold hover:bg-gold/5 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> View on BscScan
            </a>
            <button
              onClick={async () => { await disconnectAsync(); setDropdownOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" /> Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
