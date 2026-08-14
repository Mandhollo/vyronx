'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import {
  Gavel, Loader2, Clock, DollarSign, Users, Trophy, Zap, Wallet,
  Check, AlertCircle, Timer, Flame, Coins,
} from 'lucide-react';
import { AUCTION_ADDRESS, AuctionABI, TOKEN_ADDRESS, USDT_ADDRESS } from '@/lib/contracts';
import { parseUnits, formatUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';
import ParticleField from '@/components/fx/ParticleField';
import { triggerCoinConfetti } from '@/components/effects/CoinConfetti';
import { useI18n } from '@/lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const ERC20_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const PREVIEW_MODE = AUCTION_ADDRESS === ZERO_ADDRESS;
const BID_PACKS = [10, 25, 50, 100];

// Auction struct (11 fields):
// [0]prizeUsdt [1]currentPrice [2]bidCount [3]lastBidder [4]winner [5]startTime
// [6]endTime [7]finalizeTime [8]finalPricePaid [9]prizeClaimed [10]status
type AuctionTuple = readonly [
  bigint, bigint, bigint, `0x${string}`, `0x${string}`, bigint,
  bigint, bigint, bigint, boolean, bigint
];

export default function AuctionPage() {
  const { t } = useI18n();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // 1s heartbeat for countdowns
  useEffect(() => {
    const iv = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const onCorrectChain = chainId === bsc.id;

  const fmt = (val: bigint | undefined, display = 2) =>
    val ? parseFloat(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: display }) : '0';

  // ── Reads ──
  const { data: activeIds, refetch: refetchActive } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getActiveAuctionIds', chainId: bsc.id,
    query: { enabled: !PREVIEW_MODE },
  }) as { data: readonly bigint[] | undefined; refetch: () => void };

  const { data: bidBal } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'bidBalance', args: address ? [address] : undefined,
    chainId: bsc.id, query: { enabled: !PREVIEW_MODE && !!address },
  }) as { data: bigint | undefined };

  const { data: winsWeek } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getWinsThisWeek', args: address ? [address] : undefined,
    chainId: bsc.id, query: { enabled: !PREVIEW_MODE && !!address },
  }) as { data: bigint | undefined };

  const { data: winLimit } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'weeklyWinLimit', chainId: bsc.id, query: { enabled: !PREVIEW_MODE },
  }) as { data: bigint | undefined };

  const { data: paused_ } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'paused', chainId: bsc.id, query: { enabled: !PREVIEW_MODE },
  }) as { data: boolean | undefined };

  const { data: vyrBal } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: ERC20_ABI,
    functionName: 'balanceOf', args: address ? [address] : undefined,
    chainId: bsc.id, query: { enabled: !!address },
  }) as { data: bigint | undefined };

  const { data: usdtAllow } = useReadContract({
    address: USDT_ADDRESS as `0x${string}`, abi: ERC20_ABI,
    functionName: 'allowance', args: address ? [address, AUCTION_ADDRESS] : undefined,
    chainId: bsc.id, query: { enabled: !PREVIEW_MODE && !!address },
  }) as { data: bigint | undefined };

  const { data: vyrAllow } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: ERC20_ABI,
    functionName: 'allowance', args: address ? [address, AUCTION_ADDRESS] : undefined,
    chainId: bsc.id, query: { enabled: !PREVIEW_MODE && !!address },
  }) as { data: bigint | undefined };

  // 6 auction slots (fixed grid layout)
  const a0 = useAuction(PREVIEW_MODE, activeIds?.[0]);
  const a1 = useAuction(PREVIEW_MODE, activeIds?.[1]);
  const a2 = useAuction(PREVIEW_MODE, activeIds?.[2]);
  const a3 = useAuction(PREVIEW_MODE, activeIds?.[3]);
  const a4 = useAuction(PREVIEW_MODE, activeIds?.[4]);
  const a5 = useAuction(PREVIEW_MODE, activeIds?.[5]);
  const auctions = [a0, a1, a2, a3, a4, a5].filter((a) => a !== null) as AuctionInfo[];
  const emptySlots = Math.max(0, 6 - auctions.length);

  // ── Actions ──
  const ensureChain = async () => {
    if (!onCorrectChain) { await switchChainAsync({ chainId: bsc.id }); return false; }
    return true;
  };

  const doTx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    setPending(label);
    const tid = toast.loading(`${label}...`);
    try {
      const hash = await fn();
      // wait receipt
      for (let i = 0; i < 90; i++) {
        const r = await fetch('https://bsc-dataseed.binance.org', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [hash], id: 1 }),
        }).then((r) => r.json());
        if (r.result) { if (r.result.status === '0x0') throw new Error('Transaction reverted'); return true; }
        await new Promise((r) => setTimeout(r, 2000));
      }
      toast.success(`${label} OK!`, { id: tid });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`, { id: tid });
      return false;
    } finally { setPending(null); }
  };

  const handleBid = async (auctionId: bigint) => {
    if (!isConnected) return toast.error(t('auc.connectFirst'));
    if (!bidBal || bidBal === BigInt(0)) return toast.error(t('auc.noCredits'));
    if (winLimit && winsWeek && winLimit > BigInt(0) && winsWeek >= winLimit) return toast.error(t('auc.winLimit'));
    if (await ensureChain() === false) return;
    const ok = await doTx('Bid', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'placeBid', args: [auctionId], chainId: bsc.id,
    }));
    if (ok) { refetchActive(); auctions.forEach((a) => a.refetch()); }
  };

  const handleApprove = async (token: 'usdt' | 'vyr') => {
    if (!address) return;
    const tokenAddr = token === 'usdt' ? USDT_ADDRESS : TOKEN_ADDRESS;
    const ok = await doTx('Approve', () => writeContractAsync({
      address: tokenAddr as `0x${string}`, abi: ERC20_ABI,
      functionName: 'approve', args: [AUCTION_ADDRESS as `0x${string}`, BigInt(2) ** BigInt(256) - BigInt(1)], chainId: bsc.id,
    }));
    return ok;
  };

  const handleBuyUSDT = async (n: number) => {
    if (!isConnected) return toast.error(t('auc.connectFirst'));
    if (!usdtAllow || usdtAllow < parseUnits(String(n), 18)) {
      const ok = await handleApprove('usdt');
      if (!ok) return;
    }
    await doTx(`Buy ${n} bids`, () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'buyBidPackUSDT', args: [BigInt(n)], chainId: bsc.id,
    }));
  };

  const handleBuyVYR = async () => {
    if (!isConnected) return toast.error(t('auc.connectFirst'));
    if (!vyrBal || vyrBal === BigInt(0)) return toast.error('No VYR balance');
    if (!vyrAllow || vyrAllow < vyrBal) {
      const ok = await handleApprove('vyr');
      if (!ok) return;
    }
    await doTx('Buy bids with VYR', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'buyBidPackWithVYR', args: [vyrBal!], chainId: bsc.id,
    }));
  };

  const handleClaim = async (auctionId: bigint) => {
    if (await ensureChain() === false) return;
    const ok = await doTx('Claim prize', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'claimPrize', args: [auctionId], chainId: bsc.id,
    }));
    if (ok) { triggerCoinConfetti(); refetchActive(); }
  };

  const handleFinalize = async (auctionId: bigint) => {
    await doTx('Finalize', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'finalize', args: [auctionId], chainId: bsc.id,
    }));
    refetchActive();
  };

  return (
    <main className="relative min-h-screen bg-dark overflow-x-hidden">
      <ParticleField count={10} />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="text-center mb-12">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 mb-4">
            <Gavel className="w-4 h-4 text-gold" />
            <span className="text-xs font-bold text-gold tracking-wider">VYRONX PENNY AUCTION</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-black text-white mb-4">
            {t('auc.title')}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-beige-muted max-w-2xl mx-auto">
            {t('auc.subtitle')}
          </motion.p>
        </motion.div>

        {/* Live auctions */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-gold" /> {t('auc.live')}
          </h2>

          {PREVIEW_MODE ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2, 3, 4, 5].map((i) => <PreviewCard key={i} t={t} />)}
            </div>
          ) : auctions.length === 0 ? (
            <div className="rounded-2xl border border-dark-border bg-dark-card p-8 text-center text-beige-muted">
              {t('auc.none')}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {auctions.map((a) => (
                  <AuctionCard
                    key={a.id}
                    info={a}
                    tick={tick}
                    address={address}
                    isConnected={isConnected}
                    bidBal={bidBal}
                    winLimited={!!(winLimit && winsWeek && winLimit > BigInt(0) && winsWeek >= winLimit)}
                    paused={!!paused_}
                    pending={pending}
                    t={t}
                    onBid={() => handleBid(BigInt(a.id))}
                    onClaim={() => handleClaim(BigInt(a.id))}
                    onFinalize={() => handleFinalize(BigInt(a.id))}
                  />
                ))}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} className="rounded-2xl border border-dashed border-dark-border bg-dark-card/40 p-8 flex flex-col items-center justify-center text-center min-h-[280px]">
                    <Gavel className="w-10 h-10 text-gold/20 mb-3" />
                    <span className="text-sm text-beige-muted">{t('auc.none')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Buy bid packs */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl border border-gold/30 bg-dark-card p-6 sm:p-8 mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-gold" /> {t('auc.buyTitle')}
              </h2>
              <p className="text-sm text-beige-muted mt-1">{t('auc.buySub')}</p>
            </div>
            {isConnected && !PREVIEW_MODE && (
              <div className="flex flex-col gap-1 text-right">
                <span className="text-sm text-beige-muted">{t('auc.credits')}: <strong className="text-gold">{Number(bidBal ?? 0)}</strong></span>
                <span className="text-xs text-beige-muted">{t('auc.vyrBalance')}: <strong className="text-white">{fmt(vyrBal, 0)} VYR</strong></span>
              </div>
            )}
          </div>

          {PREVIEW_MODE ? (
            <p className="text-beige-muted text-sm">Coming soon.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* USDT */}
              <div className="rounded-xl border border-dark-border bg-dark-elevated p-4">
                <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" /> {t('auc.withUSDT')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BID_PACKS.map((n) => (
                    <button key={n} onClick={() => handleBuyUSDT(n)} disabled={pending !== null || !isConnected}
                      className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark font-bold text-sm hover:opacity-90 disabled:opacity-50">
                      {n} {t('auc.buy')} — ${n}
                    </button>
                  ))}
                </div>
              </div>
              {/* VYR */}
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
                <div className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gold" /> {t('auc.withVYR')}
                </div>
                <p className="text-xs text-beige-muted mb-3">50% queimado 🔥 + 50% treasury</p>
                <button onClick={handleBuyVYR} disabled={pending !== null || !isConnected || !vyrBal || vyrBal === BigInt(0)}
                  className="w-full px-3 py-2.5 rounded-lg bg-dark-elevated border border-gold/40 text-gold font-bold text-sm hover:bg-gold/10 disabled:opacity-50">
                  {t('auc.buy')} {fmt(vyrBal, 0)} VYR → {Math.floor(parseFloat(fmt(vyrBal, 2)) * 1.1)} {t('auc.bids')}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* How it works */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl border border-dark-border bg-dark-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gold" /> {t('auc.howTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[t('auc.how1'), t('auc.how2'), t('auc.how3'), t('auc.how4')].map((txt, i) => (
              <div key={i} className="flex gap-3 rounded-xl bg-dark-elevated p-4">
                <span className="w-6 h-6 shrink-0 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <p className="text-sm text-beige-muted">{txt}</p>
              </div>
            ))}
          </div>
          {/* Timer tiers */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {[20, 15, 10, 7, 5, 3].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold text-xs font-bold">{s}s</span>
                {i < 5 && <span className="text-beige-muted text-xs">→</span>}
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-beige-muted mt-2">0% · 20% · 40% · 60% · 80% · 100% {t('auc.goal')}</div>
        </motion.div>
      </div>
    </main>
  );
}

// ── Hooks & sub-components ──

interface AuctionInfo {
  id: number;
  prize: bigint; price: bigint; bidCount: bigint; lastBidder: string; winner: string;
  startTime: bigint; endTime: bigint; finalizeTime: bigint; finalPricePaid: bigint;
  prizeClaimed: boolean; status: number;
  title: string; image: string;
  refetch: () => void;
}

function useAuction(preview: boolean, id: bigint | undefined): AuctionInfo | null {
  const { data, refetch } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getAuction', args: id !== undefined ? [id] : undefined,
    chainId: bsc.id, query: { enabled: !preview && id !== undefined },
  }) as { data: AuctionTuple | undefined; refetch: () => void };

  const { data: meta } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getAuctionMeta', args: id !== undefined ? [id] : undefined,
    chainId: bsc.id, query: { enabled: !preview && id !== undefined },
  }) as { data: readonly [string, string] | undefined };

  if (preview || id === undefined || !data) return null;
  return {
    id: Number(id),
    prize: data[0], price: data[1], bidCount: data[2], lastBidder: data[3], winner: data[4],
    startTime: data[5], endTime: data[6], finalizeTime: data[7], finalPricePaid: data[8],
    prizeClaimed: data[9], status: Number(data[10]),
    title: meta?.[0] ?? '', image: meta?.[1] ?? '',
    refetch,
  };
}

function Countdown({ endTime, tick }: { endTime: bigint; tick: number }) {
  void tick;
  const now = Math.floor(Date.now() / 1000);
  const left = Number(endTime) - now;
  if (left <= 0) return <span className="text-red-400 font-mono font-black text-2xl">00:00</span>;
  const m = Math.floor(left / 60);
  const s = left % 60;
  const urgent = left <= 10;
  return (
    <span className={`font-mono font-black text-2xl ${urgent ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function AuctionCard({ info, tick, address, isConnected, bidBal, winLimited, paused, pending, t, onBid, onClaim, onFinalize }: {
  info: AuctionInfo; tick: number; address: string | undefined; isConnected: boolean;
  bidBal: bigint | undefined; winLimited: boolean; paused: boolean; pending: string | null;
  t: (k: string) => string;
  onBid: () => void; onClaim: () => void; onFinalize: () => void;
}) {
  const fmt = (val: bigint, display = 2) => parseFloat(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: display });
  const expired = Math.floor(Date.now() / 1000) > Number(info.endTime);
  const isWinner = address && info.winner && info.winner.toLowerCase() === address.toLowerCase() && !info.prizeClaimed;
  const progress = info.prize > BigInt(0)
    ? Math.min(100, Number((info.bidCount * BigInt(1e18) * BigInt(100)) / info.prize))
    : 0;

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-dark-card overflow-hidden flex flex-col">
      {/* Illustrative image */}
      <div className="relative h-44 sm:h-48 bg-dark-elevated border-b border-gold/20">
        {info.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.image} alt={info.title || 'Prize'} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Trophy className="w-14 h-14 text-gold/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark/80 to-transparent pointer-events-none" />
        {info.title && (
          <div className="absolute bottom-2 left-3 right-3">
            <span className="text-sm font-bold text-white drop-shadow">{info.title}</span>
          </div>
        )}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-dark/80 border border-gold/40 text-gold text-xs font-bold">
          #{info.id}
        </div>
      </div>

      {/* Prize header */}
      <div className="bg-gradient-to-r from-gold/15 to-transparent p-4 border-b border-gold/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-beige-muted">{t('auc.prize')}</div>
            <div className="text-2xl font-black text-gold">${fmt(info.prize, 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-beige-muted">{t('auc.timer')}</div>
            <Countdown endTime={info.endTime} tick={tick} />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Current price + progress */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-dark-elevated p-3 text-center">
            <div className="text-xs text-beige-muted">{t('auc.current')}</div>
            <div className="text-xl font-black text-white font-mono">${fmt(info.price)}</div>
          </div>
          <div className="rounded-xl bg-dark-elevated p-3 text-center">
            <div className="text-xs text-beige-muted">{t('auc.bids')}</div>
            <div className="text-xl font-black text-white">{Number(info.bidCount)}</div>
          </div>
        </div>

        {/* Goal progress */}
        <div>
          <div className="flex justify-between text-xs text-beige-muted mb-1">
            <span>{t('auc.goal')}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-dark-elevated overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Last bidder */}
        {info.lastBidder && info.lastBidder !== ZERO_ADDRESS && (
          <div className="flex items-center gap-2 text-xs text-beige-muted">
            <Users className="w-3.5 h-3.5 text-gold" />
            {t('auc.lastBidder')}: <span className="font-mono text-white">{info.lastBidder.slice(0, 6)}...{info.lastBidder.slice(-4)}</span>
          </div>
        )}

        {/* Actions */}
        {info.status === 0 && !expired && (
          <button onClick={onBid} disabled={pending !== null || !isConnected || paused || (bidBal === BigInt(0)) || winLimited}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark font-black text-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {pending === 'Bid' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
            {t('auc.placeBid')}
          </button>
        )}

        {info.status === 0 && expired && (
          <button onClick={onFinalize} disabled={pending !== null}
            className="w-full py-3 rounded-xl bg-dark-elevated border border-gold/40 text-gold font-bold hover:bg-gold/10 disabled:opacity-50">
            Finalize auction
          </button>
        )}

        {isWinner && (
          <button onClick={onClaim} disabled={pending !== null}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-green-700 text-white font-black text-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" /> {t('auc.won')}
          </button>
        )}

        {!isConnected && (
          <div className="text-center text-xs text-beige-muted py-2">{t('auc.connectFirst')}</div>
        )}
      </div>
    </motion.div>
  );
}

function PreviewCard({ t }: { t: (k: string) => string }) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-dark-card overflow-hidden">
      <div className="bg-gradient-to-r from-gold/15 to-transparent p-5 border-b border-gold/20 flex items-start justify-between">
        <div>
          <div className="text-xs text-beige-muted">{t('auc.prize')}</div>
          <div className="text-3xl font-black text-gold">$1,000</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-beige-muted">{t('auc.timer')}</div>
          <span className="font-mono font-black text-2xl text-gold">00:20</span>
        </div>
      </div>
      <div className="p-5 space-y-4 opacity-70">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-dark-elevated p-3 text-center">
            <div className="text-xs text-beige-muted">{t('auc.current')}</div>
            <div className="text-xl font-black text-white font-mono">$4.37</div>
          </div>
          <div className="rounded-xl bg-dark-elevated p-3 text-center">
            <div className="text-xs text-beige-muted">{t('auc.bids')}</div>
            <div className="text-xl font-black text-white">436</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-dark-elevated overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark" style={{ width: '43%' }} />
        </div>
        <button disabled className="w-full py-4 rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark font-black text-lg opacity-50 flex items-center justify-center gap-2">
          <Gavel className="w-5 h-5" /> {t('auc.placeBid')}
        </button>
        <p className="text-center text-xs text-beige-muted">Preview — first auction coming soon 🚀</p>
      </div>
    </motion.div>
  );
}
