'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useState, useEffect } from 'react';
import { Wallet, Loader2, Check, ChevronDown, Copy, LogOut, ExternalLink, X } from 'lucide-react';
import { bsc } from 'wagmi/chains';
import { useI18n } from '@/lib/i18n';

export default function ConnectButton() {
  const { t } = useI18n();
  const { address, isConnected, chain } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const onCorrectChain = chain?.id === bsc.id;

  // Auto-connect on mobile in-app browser
  useEffect(() => {
    if (!isConnected && !isPending) {
      const provider = (window as unknown as Record<string, unknown>)?.ethereum;
      if (provider) {
        // Auto-attempt connection if wallet is injected (mobile in-app browser)
        const checkAutoConnect = async () => {
          try {
            const accounts = (provider as { request: (args: { method: string }) => Promise<string[]> }).request({ method: 'eth_accounts' });
            if (accounts && (await accounts).length > 0) {
              const c = connectors[0];
              if (c) await connectAsync({ connector: c });
            }
          } catch {
            // Silent fail — user needs to click connect
          }
        };
        // Only auto-connect after a short delay if there's an injected wallet
        const timer = setTimeout(checkAutoConnect, 500);
        return () => clearTimeout(timer);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect if running inside a wallet's in-app browser
  const isInWalletApp = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('metamask') || ua.includes('trust') || ua.includes('binance') || ua.includes('tokenpocket') || ua.includes('mathwallet') || ua.includes('safepal');
  };

  // Not connected
  if (!isConnected) {
    return (
      <>
        <button
          onClick={async () => {
            // If inside wallet app browser (mobile), connect directly
            if (isInWalletApp() || connectors.length === 1) {
              const c = connectors[0];
              if (c) {
                try { await connectAsync({ connector: c }); }
                catch { setShowWalletModal(true); }
              }
            } else {
              setShowWalletModal(true);
            }
          }}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 hover:scale-[1.03] transition-all disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          <span className="hidden sm:inline">{isPending ? t('common.connecting') : t('nav.connect')}</span>
          <span className="sm:hidden">{isPending ? '...' : t('nav.connect')}</span>
        </button>

        {/* Wallet Selection Modal */}
        {showWalletModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowWalletModal(false)}>
            <div className="bg-dark-card border border-gold/30 rounded-2xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Connect Wallet</h3>
                <button onClick={() => setShowWalletModal(false)} className="text-beige-muted hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-2">
                {connectors.length > 0 ? connectors.map((c) => (
                  <button
                    key={c.uid}
                    onClick={async () => { try { await connectAsync({ connector: c }); setShowWalletModal(false); } catch { } }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-border bg-dark-elevated hover:border-gold/30 hover:bg-gold/5 transition-all"
                  >
                    <Wallet className="h-5 w-5 text-gold" />
                    <span className="text-sm font-bold text-white">{c.name}</span>
                  </button>
                )) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-beige-muted mb-4">No wallet detected.</p>
                    <p className="text-xs text-beige-muted mb-3">Open this site inside your wallet&apos;s browser (MetaMask, Trust Wallet, etc.) or install a wallet extension.</p>
                    <div className="flex flex-col gap-2 mt-4">
                      <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Download MetaMask</a>
                      <a href="https://trustwallet.com/download" target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">Download Trust Wallet</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Connected
  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-bold rounded-lg border border-dark-border bg-dark-card text-white hover:border-gold/30 transition-colors"
      >
        <span className={`h-2 w-2 rounded-full ${onCorrectChain ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="font-mono">{shortAddr}</span>
        <ChevronDown className="h-4 w-4 text-beige-muted" />
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-dark-border bg-dark-card shadow-xl z-50 p-2">
            <div className="px-3 py-2 border-b border-dark-border">
              <div className="text-xs text-beige-muted">{t('common.connectedTo')}</div>
              <div className="text-sm font-mono text-white truncate">{address}</div>
            </div>
            {!onCorrectChain && (
              <button onClick={() => switchChainAsync({ chainId: bsc.id })} className="flex items-center gap-2 w-full px-3 py-2 m-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
                <span className="text-xs font-bold">⚠ Switch to BSC Mainnet</span>
              </button>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(address || '')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-beige hover:text-gold hover:bg-gold/5 rounded-lg transition-colors"
            >
              <Copy className="h-4 w-4" /> {t('common.copy')}
            </button>
            <a
              href={`https://bscscan.com/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-beige hover:text-gold hover:bg-gold/5 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> {t('common.view')}
            </a>
            <button
              onClick={async () => { await disconnectAsync(); setDropdownOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" /> {t('common.disconnect')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
