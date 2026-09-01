'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import {
  Gavel, Loader2, DollarSign, Users, Trophy, Zap,
  AlertCircle, Timer, Flame, Coins, ShieldCheck, TrendingDown, Sparkles, Crown,
} from 'lucide-react';
import { AUCTION_ADDRESS, AuctionABI, TOKEN_ADDRESS, USDT_ADDRESS, STAKING_ADDRESS, StakingABI } from '@/lib/contracts';
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
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
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

  useEffect(() => {
    const iv = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const onCorrectChain = chainId === bsc.id;
  const fmt = (val: bigint | undefined, display = 2) =>
    val ? parseFloat(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: display }) : '0';

  // ── Reads ──
  // Live VYR price + bonus for the bids-with-VYR preview (matches buyBidPackWithVYR math)
  const { data: vyrPrice } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'vyrPriceInUsdt', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: vyBonusBps } = useReadContract({ address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI, functionName: 'vyBonusBps', chainId: bsc.id, query: { enabled: !PREVIEW_MODE } }) as { data: bigint | undefined };

  const { data: activeIds, refetch: refetchActive } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getActiveAuctionIds', chainId: bsc.id, query: { enabled: !PREVIEW_MODE, refetchInterval: 5000 },
  }) as { data: readonly bigint[] | undefined; refetch: () => void };

  const { data: stats } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getRecentWinners', args: [BigInt(12)], chainId: bsc.id, query: { enabled: !PREVIEW_MODE, refetchInterval: 10000 },
  }) as { data: readonly [readonly bigint[], readonly `0x${string}`[], readonly bigint[], readonly bigint[]] | undefined; refetch: () => void };

  const { data: totalBurned } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'totalVyrBurned', chainId: bsc.id, query: { enabled: !PREVIEW_MODE, refetchInterval: 10000 },
  }) as { data: bigint | undefined };

  const { data: totalBids } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'totalBidsPlaced', chainId: bsc.id, query: { enabled: !PREVIEW_MODE, refetchInterval: 10000 },
  }) as { data: bigint | undefined };

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

  // 6 auction slots
  const a0 = useAuction(PREVIEW_MODE, activeIds?.[0]);
  const a1 = useAuction(PREVIEW_MODE, activeIds?.[1]);
  const a2 = useAuction(PREVIEW_MODE, activeIds?.[2]);
  const a3 = useAuction(PREVIEW_MODE, activeIds?.[3]);
  const a4 = useAuction(PREVIEW_MODE, activeIds?.[4]);
  const a5 = useAuction(PREVIEW_MODE, activeIds?.[5]);
  const auctions = [a0, a1, a2, a3, a4, a5].filter((a) => a !== null) as AuctionInfo[];
  const emptySlots = Math.max(0, 6 - auctions.length);

  const refetchAll = () => { refetchActive(); auctions.forEach((a) => a.refetch()); };

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
      for (let i = 0; i < 90; i++) {
        const r = await fetch('https://bsc-dataseed.binance.org', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [hash], id: 1 }),
        }).then((r) => r.json());
        if (r.result) { if (r.result.status === '0x0') throw new Error('Transaction reverted'); break; }
        await new Promise((r) => setTimeout(r, 2000));
      }
      toast.success(`${label} OK!`, { id: tid });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`, { id: tid });
      return false;
    } finally { setPending(null); }
  };

  const handleArmButler = async (auctionId: bigint, bids: number, maxPrice: number) => {
    if (!isConnected) return toast.error(t('auc.connectFirst'));
    if (await ensureChain() === false) return;
    const ok = await doTx('Arm Butler', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'armButler', args: [auctionId, BigInt(bids), parseUnits(String(maxPrice), 18)], chainId: bsc.id,
    }));
    if (ok) {
      // register with the butler service so the bot sees it instantly (RPC logs are throttled)
      fetch(`https://arb.vyronx.io/butler/arm?aid=${Number(auctionId)}&user=${address}`, { method: 'POST' }).catch(() => {});
      refetchAll();
    }
  };

  const handleDisarmButler = async (auctionId: bigint) => {
    const ok = await doTx('Disarm Butler', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'disarmButler', args: [auctionId], chainId: bsc.id,
    }));
    if (ok) refetchAll();
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
    if (ok) refetchAll();
  };

  const handleApprove = async (token: 'usdt' | 'vyr') => {
    const tokenAddr = token === 'usdt' ? USDT_ADDRESS : TOKEN_ADDRESS;
    return doTx('Approve', () => writeContractAsync({
      address: tokenAddr as `0x${string}`, abi: ERC20_ABI,
      functionName: 'approve', args: [AUCTION_ADDRESS as `0x${string}`, BigInt(2) ** BigInt(256) - BigInt(1)], chainId: bsc.id,
    }));
  };

  const handleBuyUSDT = async (n: number) => {
    if (!isConnected) return toast.error(t('auc.connectFirst'));
    if (!usdtAllow || usdtAllow < parseUnits(String(n), 18)) {
      const ok = await handleApprove('usdt');
      if (!ok) return;
    }
    const ok = await doTx(`Buy ${n} bids`, () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'buyBidPackUSDT', args: [BigInt(n)], chainId: bsc.id,
    }));
    if (ok) refetchAll();
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
    // winner pays the final price (cents) via transferFrom → needs USDT allowance
    if (!usdtAllow || usdtAllow < parseUnits('1000', 18)) {
      const ok = await handleApprove('usdt');
      if (!ok) return;
    }
    const ok = await doTx('Claim prize', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'claimPrize', args: [auctionId], chainId: bsc.id,
    }));
    if (ok) { triggerCoinConfetti(); refetchAll(); }
  };

  const handleFinalize = async (auctionId: bigint) => {
    const ok = await doTx('Finalize', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'finalize', args: [auctionId], chainId: bsc.id,
    }));
    if (ok) refetchAll();
  };

  const winners = stats && stats[0] && stats[0].length > BigInt(0)
    ? Array.from({ length: Number(stats[0].length) }).map((_, i) => ({
        id: Number(stats[0][i]), winner: stats[1][i], prize: stats[2][i], finalPrice: stats[3][i],
      }))
    : [];

  return (
    <main className="relative min-h-screen bg-dark overflow-x-hidden">
      <ParticleField count={10} />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* ══ HERO (DealDash-style: headline + 3 value props + stats bar) ══ */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="text-center mb-10">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 mb-4">
            <Gavel className="w-4 h-4 text-gold" />
            <span className="text-xs font-bold text-gold tracking-wider">VYRONX PENNY AUCTION</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-6xl font-black text-white mb-4 leading-tight">
            {t('auc.title')} <span className="text-gold">95% OFF</span>
          </motion.h1>
          <motion.div variants={fadeUp} className="relative rounded-2xl overflow-hidden border border-gold/25 shadow-2xl shadow-gold/10 mb-4 max-w-4xl mx-auto">
            <Image
              src="/auction/hero-banner.jpg"
              alt="VyronX Penny Auction"
              width={1600}
              height={853}
              priority
              className="w-full h-[170px] sm:h-[240px] lg:h-[300px] object-cover object-[center_40%]"
              sizes="(max-width: 768px) 100vw, 900px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark/40 via-transparent to-transparent pointer-events-none" />
          </motion.div>
          <motion.p variants={fadeUp} className="text-beige-muted max-w-2xl mx-auto mb-8">
            {t('auc.subtitle')}
          </motion.p>

          {/* Stats bar */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {[
              { icon: Flame, label: 'VYR Burned', value: `${fmt(totalBurned, 0)} 🔥` },
              { icon: Gavel, label: 'Total Bids', value: Number(totalBids ?? 0).toLocaleString() },
              { icon: Trophy, label: 'Winners Paid', value: winners.length ? String(winners.length) : '0' },
              { icon: ShieldCheck, label: 'On-Chain', value: '100%' },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-dark-border bg-dark-card/80 px-3 py-3 text-center">
                <s.icon className="w-4 h-4 text-gold mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-beige-muted uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ══ WINNERS STRIP (DealDash's social proof wall) ══ */}
        {winners.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-10 rounded-2xl border border-gold/25 bg-gradient-to-r from-gold/10 via-dark-card to-gold/10 p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-gold" />
              <span className="text-sm font-bold text-gold tracking-wide uppercase">Recent Winners</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {winners.map((w) => (
                <div key={w.id} className="shrink-0 rounded-xl border border-dark-border bg-dark-elevated px-4 py-2.5 min-w-[180px]">
                  <div className="text-[10px] text-beige-muted">#{w.id} · {w.winner.slice(0, 6)}...{w.winner.slice(-4)}</div>
                  <div className="text-sm font-bold text-gold">${fmt(w.prize, 0)} <span className="text-beige-muted font-normal">for</span> <span className="text-green-400 font-mono">${fmt(w.finalPrice)}</span></div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ LIVE AUCTIONS — 6 cards, DealDash-style ══ */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-gold" /> {t('auc.live')}
          </h2>
          {isConnected && !PREVIEW_MODE && (
            <div className="text-right">
              <span className="text-xs text-beige-muted">{t('auc.credits')}: </span>
              <span className="text-sm font-bold text-gold">{Number(bidBal ?? 0)}</span>
            </div>
          )}
        </div>

        {PREVIEW_MODE ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <PreviewCard key={i} t={t} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                onArmButler={(b, mp) => handleArmButler(BigInt(a.id), b, mp)}
                onDisarmButler={() => handleDisarmButler(BigInt(a.id))}
                onClaim={() => handleClaim(BigInt(a.id))}
                onFinalize={() => handleFinalize(BigInt(a.id))}
              />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-2xl border border-dashed border-dark-border bg-dark-card/40 p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
                <Gavel className="w-10 h-10 text-gold/20 mb-3" />
                <span className="text-sm text-beige-muted">{t('auc.none')}</span>
              </div>
            ))}
          </div>
        )}

        {/* ══ BID PACKS (DealDash: packs front and center) ══ */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mt-12 rounded-2xl border border-gold/30 bg-dark-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-gold" /> {t('auc.buyTitle')}
              </h2>
              <p className="text-sm text-beige-muted mt-1">{t('auc.buySub')}</p>
            </div>
            {isConnected && !PREVIEW_MODE && (
              <div className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-2 text-center">
                <div className="text-[10px] text-beige-muted uppercase">{t('auc.credits')}</div>
                <div className="text-2xl font-black text-gold">{Number(bidBal ?? 0)}</div>
              </div>
            )}
          </div>

          {PREVIEW_MODE ? (
            <p className="text-beige-muted text-sm">Coming soon.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-xl border border-dark-border bg-dark-elevated p-4">
                <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" /> {t('auc.withUSDT')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BID_PACKS.map((n) => (
                    <button key={n} onClick={() => handleBuyUSDT(n)} disabled={pending !== null || !isConnected}
                      className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark font-bold text-sm hover:opacity-90 disabled:opacity-50">
                      {n} bids: ${n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
                <div className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gold" /> {t('auc.withVYR')}
                </div>
                <p className="text-xs text-beige-muted mb-3">50% burned 🔥 + 50% treasury</p>
                <button onClick={handleBuyVYR} disabled={pending !== null || !isConnected || !vyrBal || vyrBal === BigInt(0)}
                  className="w-full px-3 py-2.5 rounded-lg bg-dark-elevated border border-gold/40 text-gold font-bold text-sm hover:bg-gold/10 disabled:opacity-50">
                  {t('auc.buy')} {fmt(vyrBal, 0)} VYR → {Math.floor((parseFloat(formatUnits(vyrBal ?? BigInt(0), 18)) * parseFloat(formatUnits(vyrPrice ?? BigInt(0), 18)) * (10000 + Number(vyBonusBps ?? 0))) / 10000)} bids
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* ══ HOW IT WORKS (3 steps, DealDash-style) ══ */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mt-8 rounded-2xl border border-dark-border bg-dark-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gold" /> {t('auc.howTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[t('auc.how1'), t('auc.how2'), t('auc.how3')].map((txt, i) => (
              <div key={i} className="flex gap-3 rounded-xl bg-dark-elevated p-4">
                <span className="w-7 h-7 shrink-0 rounded-full bg-gold/20 text-gold text-sm font-bold flex items-center justify-center">{i + 1}</span>
                <p className="text-sm text-beige-muted">{txt}</p>
              </div>
            ))}
          </div>
          {/* Timer tier bar */}
          <div className="mt-6 rounded-xl bg-dark-elevated p-4">
            <div className="text-xs text-beige-muted mb-3 text-center">⏱️ Timer acelera conforme a meta: 20s → 15s → 10s → 7s → 5s → 3s</div>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {[20, 15, 10, 7, 5, 3].map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`px-3 py-1 rounded-full border text-xs font-bold ${i === 5 ? 'border-red-400/50 bg-red-500/10 text-red-400' : 'border-gold/30 bg-gold/10 text-gold'}`}>{s}s</span>
                  {i < 5 && <span className="text-beige-muted text-[10px]">→</span>}
                </div>
              ))}
            </div>
            <div className="text-center text-[10px] text-beige-muted mt-2">0% · 20% · 40% · 60% · 80% · 100% {t('auc.goal')}</div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-beige-muted">
            <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
            <span>{t('auc.how4')}</span>
          </div>
        </motion.div>

        {/* Trust badges */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, title: 'No bots. No shill bids.', sub: 'Every bid is a public BSC transaction' },
            { icon: Timer, title: 'Immutable timer', sub: ' Governed by block.timestamp' },
            { icon: Sparkles, title: 'Prizes in escrow', sub: 'USDT locked in the contract until claimed' },
          ].map((b, i) => (
            <div key={i} className="rounded-xl border border-dark-border bg-dark-card/60 p-4 flex items-start gap-3">
              <b.icon className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-white">{b.title}</div>
                <div className="text-xs text-beige-muted">{b.sub}</div>
              </div>
            </div>
          ))}
        </div>
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
    chainId: bsc.id, query: { enabled: !preview && id !== undefined, refetchInterval: 3000 },
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
  if (left <= 0) return <span className="text-red-400 font-mono font-black text-3xl">00:00</span>;
  const m = Math.floor(left / 60);
  const s = left % 60;
  const urgent = left <= 10;
  return (
    <span className={`font-mono font-black text-3xl tabular-nums ${urgent ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function AuctionCard({ info, tick, address, isConnected, bidBal, winLimited, paused, pending, t, onBid, onClaim, onFinalize, onArmButler, onDisarmButler }: {
  info: AuctionInfo; tick: number; address: string | undefined; isConnected: boolean;
  bidBal: bigint | undefined; winLimited: boolean; paused: boolean; pending: string | null;
  t: (k: string) => string;
  onBid: () => void; onClaim: () => void; onFinalize: () => void;
  onArmButler: (bids: number, maxPrice: number) => void; onDisarmButler: () => void;
}) {
  const { data: myButler } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'butlers', args: address ? [BigInt(info.id), address] : undefined,
    chainId: bsc.id, query: { enabled: !!address && info.status === 0, refetchInterval: 5000 },
  }) as { data: readonly [bigint, bigint, boolean] | undefined };
  const butlerActive = !!(myButler && myButler[2] && myButler[0] > BigInt(0));
  const [butlerBids, setButlerBids] = useState(10);
  const [butlerMax, setButlerMax] = useState('1.00');
  const fmt = (val: bigint, display = 2) => parseFloat(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: display });
  const fmt2 = (val: bigint) => '$' + parseFloat(formatUnits(val, 18)).toFixed(2);
  const expired = Math.floor(Date.now() / 1000) > Number(info.endTime);
  const notStarted = Math.floor(Date.now() / 1000) < Number(info.startTime);
  const isWinner = address && info.winner && info.winner.toLowerCase() === address.toLowerCase() && !info.prizeClaimed;
  const progress = info.prize > BigInt(0)
    ? Math.min(100, Number((info.bidCount * BigInt(1e18) * BigInt(100)) / info.prize))
    : 0;
  const discount = info.prize > BigInt(0)
    ? Math.max(0, 100 - Number((info.price * BigInt(10000)) / info.prize) / 100)
    : 0;

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-gold/25 bg-dark-card overflow-hidden flex flex-col hover:border-gold/50 transition-colors">
      {/* Image */}
      <div className="relative h-44 bg-dark-elevated border-b border-gold/15">
        {info.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.image} alt={info.title || 'Prize'} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/10 to-transparent">
            <Trophy className="w-14 h-14 text-gold/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-transparent to-transparent pointer-events-none" />
        {/* Discount badge (DealDash signature) */}
        {discount > 50 && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-gradient-to-r from-green-500 to-green-700 text-white text-xs font-black shadow-lg">
            -{discount.toFixed(0)}%
          </div>
        )}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-dark/85 border border-gold/40 text-gold text-[10px] font-bold">
          #{info.id}
        </div>
        {info.title && (
          <div className="absolute bottom-2 left-3 right-3">
            <span className="text-sm font-bold text-white drop-shadow-md">{info.title}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Prize + countdown */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] text-beige-muted uppercase tracking-wide">{t('auc.prize')}</div>
            <div className="text-2xl font-black text-gold leading-none">${fmt(info.prize, 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-beige-muted uppercase tracking-wide">{t('auc.timer')}</div>
            <Countdown endTime={info.endTime} tick={tick} />
          </div>
        </div>

        {/* Price + bids */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-dark-elevated px-3 py-2 text-center">
            <div className="text-[10px] text-beige-muted">{t('auc.current')}</div>
            <div className="text-lg font-black text-white font-mono leading-none mt-0.5">${fmt(info.price)}</div>
          </div>
          <div className="rounded-lg bg-dark-elevated px-3 py-2 text-center">
            <div className="text-[10px] text-beige-muted">{t('auc.bids')}</div>
            <div className="text-lg font-black text-white leading-none mt-0.5">{Number(info.bidCount)}</div>
          </div>
        </div>

        {/* Progress to goal */}
        <div>
          <div className="flex justify-between text-[10px] text-beige-muted mb-1">
            <span>{t('auc.goal')}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-dark-elevated overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Last bidder */}
        {info.lastBidder && info.lastBidder !== ZERO_ADDRESS && (
          <div className="flex items-center gap-1.5 text-[11px] text-beige-muted">
            <Users className="w-3 h-3 text-gold shrink-0" />
            <span className="font-mono">{info.lastBidder.slice(0, 6)}...{info.lastBidder.slice(-4)}</span>
            <span className="text-gold">is winning</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto space-y-2 pt-1">
          {notStarted && (
            <div className="w-full py-3 rounded-xl bg-gold/10 border border-gold/30 text-center">
              <div className="text-[10px] text-gold uppercase tracking-wide mb-0.5">Começa em</div>
              <div className="text-sm font-bold text-white">
                {new Date(Number(info.startTime) * 1000).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <Countdown endTime={info.startTime} tick={tick} />
            </div>
          )}
          {info.status === 0 && !expired && !notStarted && (
            <button onClick={onBid} disabled={pending !== null || !isConnected || paused || (bidBal === BigInt(0)) || winLimited}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark font-black text-base hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 transition-transform">
              {pending === 'Bid' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
              {t('auc.placeBid')}
            </button>
          )}
          {info.status === 0 && !expired && !notStarted && (
            butlerActive ? (
              <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300">🤖 Butler ativo: {Number(myButler![0])} lances restantes</span>
                  <button onClick={onDisarmButler} disabled={pending !== null}
                    className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-bold hover:bg-red-500/25 disabled:opacity-50">
                    Parar
                  </button>
                </div>
                <p className="text-[10px] text-blue-200/60 mt-1">Ele lanceia por você até {fmt2(myButler![1])}. Zero popups.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dark-border bg-dark-elevated/60 px-3 py-2.5 space-y-2">
                <div className="text-[10px] text-beige/50 font-bold uppercase tracking-wide">🤖 Butler (lance automático)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-beige/40">Qtd lances</label>
                    <input type="number" min="1" value={butlerBids} onChange={(e) => setButlerBids(parseInt(e.target.value) || 1)}
                      className="w-full h-8 rounded-lg bg-dark border border-dark-border text-white px-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] text-beige/40">Preço máx $</label>
                    <input type="text" value={butlerMax} onChange={(e) => setButlerMax(e.target.value)}
                      className="w-full h-8 rounded-lg bg-dark border border-dark-border text-white px-2 text-xs" />
                  </div>
                </div>
                <button onClick={() => onArmButler(butlerBids, parseFloat(butlerMax) || 1)} disabled={pending !== null || !isConnected || (bidBal ?? BigInt(0)) < BigInt(butlerBids)}
                  className="w-full py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-bold hover:bg-blue-600/30 disabled:opacity-50">
                  Armar robô (1 assinatura)
                </button>
              </div>
            )
          )}
          {info.status === 0 && expired && (
            <button onClick={onFinalize} disabled={pending !== null}
              className="w-full py-2.5 rounded-xl bg-dark-elevated border border-gold/40 text-gold font-bold text-sm hover:bg-gold/10 disabled:opacity-50">
              Finalize auction
            </button>
          )}
          {isWinner && (
            <button onClick={onClaim} disabled={pending !== null}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-green-700 text-white font-black text-base hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5" /> {t('auc.won')}
            </button>
          )}
          {!isConnected && (
            <div className="text-center text-[11px] text-beige-muted py-1">{t('auc.connectFirst')}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PreviewCard({ t }: { t: (k: string) => string }) {
  const prizes = [
    { title: 'iPhone 17 Pro', price: '$4.37', bids: 436, img: null },
    { title: 'Samsung 65" 4K', price: '$2.19', bids: 218, img: null },
    { title: '$1,000 USDT', price: '$8.92', bids: 891, img: null },
    { title: 'MacBook Air M4', price: '$6.41', bids: 640, img: null },
    { title: 'PS5 Pro', price: '$3.08', bids: 307, img: null },
    { title: 'AirPods Pro 3', price: '$1.27', bids: 126, img: null },
  ];
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-gold/25 bg-dark-card overflow-hidden flex flex-col">
      <div className="relative h-44 bg-gradient-to-br from-gold/15 to-transparent border-b border-gold/15 flex items-center justify-center">
        <Trophy className="w-14 h-14 text-gold/30" />
        <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-gradient-to-r from-green-500 to-green-700 text-white text-xs font-black">-99%</div>
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-beige-muted uppercase">{t('auc.prize')}</div>
            <div className="text-2xl font-black text-gold leading-none">$1,000</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-beige-muted uppercase">{t('auc.timer')}</div>
            <span className="font-mono font-black text-3xl text-gold">00:20</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-dark-elevated px-3 py-2 text-center">
            <div className="text-[10px] text-beige-muted">{t('auc.current')}</div>
            <div className="text-lg font-black text-white font-mono">{prizes[0].price}</div>
          </div>
          <div className="rounded-lg bg-dark-elevated px-3 py-2 text-center">
            <div className="text-[10px] text-beige-muted">{t('auc.bids')}</div>
            <div className="text-lg font-black text-white">{prizes[0].bids}</div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-dark-elevated overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark" style={{ width: '43%' }} />
        </div>
        <button disabled className="mt-auto w-full py-3.5 rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark font-black text-base opacity-50 flex items-center justify-center gap-2">
          <Gavel className="w-5 h-5" /> {t('auc.placeBid')}
        </button>
        <p className="text-center text-[10px] text-beige-muted">Preview: first auctions coming soon 🚀</p>
      </div>
    </motion.div>
  );
}
