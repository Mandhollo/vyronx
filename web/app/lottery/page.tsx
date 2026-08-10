'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import {
  Ticket, Trophy, Users, DollarSign, Loader2, AlertCircle,
  Check, Clock, Sparkles, TrendingUp, Wallet, Gift, Medal, Award, Crown,
} from 'lucide-react';
import { LOTTERY_ADDRESS, USDT_ADDRESS, LotteryABI } from '@/lib/contracts';
import { parseUnits, formatUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';
import ParticleField from '@/components/fx/ParticleField';

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

// RoundStatus enum: 0=Inactive, 1=Active, 2=Drawing, 3=Completed
const STATUS_LABELS = ['Inactive', 'Active', 'Drawing', 'Completed'];
const STATUS_COLORS = ['text-gray-400', 'text-green-400', 'text-yellow-400', 'text-blue-400'];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const LOTTERY_TYPES = [0, 1, 2, 3] as const;
const DEFAULT_NAMES = ['Mega Lottery', 'Big Lottery', 'Medium Lottery', 'Small Lottery'];
const PRESETS = [1, 5, 10, 50];

// Preview mode: mock data shown when lottery contract not deployed yet
const LOTTERY_NOT_DEPLOYED = LOTTERY_ADDRESS === '0x0000000000000000000000000000000000000000';
const NOW_TS = 1755000000; // fixed timestamp to avoid prerender issues
const MOCK_ROUNDS: ParsedRound[] = [
  { roundId: 1, lotteryType: 0, status: 1, prizeTarget: parseUnits('10000', 18), totalCollected: parseUnits('6230', 18), ticketCount: 6230, participantCount: 847, startTime: NOW_TS - 3600, endTime: NOW_TS + 82800, closeThreshold: parseUnits('10000', 18), winner1: ZERO_ADDRESS, winner2: ZERO_ADDRESS, winner3: ZERO_ADDRESS, prize1: BigInt(0), prize2: BigInt(0), prize3: BigInt(0) },
  { roundId: 1, lotteryType: 1, status: 1, prizeTarget: parseUnits('5000', 18), totalCollected: parseUnits('1840', 18), ticketCount: 1840, participantCount: 312, startTime: NOW_TS - 7200, endTime: NOW_TS + 172800, closeThreshold: parseUnits('5000', 18), winner1: ZERO_ADDRESS, winner2: ZERO_ADDRESS, winner3: ZERO_ADDRESS, prize1: BigInt(0), prize2: BigInt(0), prize3: BigInt(0) },
  { roundId: 1, lotteryType: 2, status: 1, prizeTarget: parseUnits('25000', 18), totalCollected: parseUnits('4270', 18), ticketCount: 4270, participantCount: 698, startTime: NOW_TS - 86400, endTime: NOW_TS + 518400, closeThreshold: parseUnits('25000', 18), winner1: ZERO_ADDRESS, winner2: ZERO_ADDRESS, winner3: ZERO_ADDRESS, prize1: BigInt(0), prize2: BigInt(0), prize3: BigInt(0) },
  { roundId: 1, lotteryType: 3, status: 1, prizeTarget: parseUnits('100000', 18), totalCollected: parseUnits('8920', 18), ticketCount: 8920, participantCount: 1204, startTime: NOW_TS - 172800, endTime: NOW_TS + 2592000, closeThreshold: parseUnits('100000', 18), winner1: ZERO_ADDRESS, winner2: ZERO_ADDRESS, winner3: ZERO_ADDRESS, prize1: BigInt(0), prize2: BigInt(0), prize3: BigInt(0) },
];
const MOCK_PRICES = [parseUnits('1', 18), parseUnits('1', 18), parseUnits('1', 18), parseUnits('1', 18)];
const MOCK_W_BPS = [BigInt(5000), BigInt(3000), BigInt(1500), BigInt(300), BigInt(200)];

// ── RoundView tuple (18 fields, indexed 0..17) ──────────────────────
// [0] roundId, [1] lotteryType, [2] status, [3] prizeTarget,
// [4] totalCollected, [5] ticketCount, [6] participantCount,
// [7] startTime, [8] endTime, [9] closeThreshold,
// [10] winner1, [11] winner2, [12] winner3,
// [13] prize1, [14] prize2, [15] prize3,
// [16] buybackAmount, [17] walletPayoutTotal
type RoundTuple = readonly [
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  `0x${string}`, `0x${string}`, `0x${string}`,
  bigint, bigint, bigint, bigint, bigint
];

interface ParsedRound {
  roundId: number;
  lotteryType: number;
  status: number;
  prizeTarget: bigint;
  totalCollected: bigint;
  ticketCount: number;
  participantCount: number;
  startTime: number;
  endTime: number;
  closeThreshold: bigint;
  winner1: string;
  winner2: string;
  winner3: string;
  prize1: bigint;
  prize2: bigint;
  prize3: bigint;
}

function parseRound(d: RoundTuple | undefined | any): ParsedRound | null {
  if (!d) return null;
  // wagmi may return tuple as array OR as named object — handle both
  const get = (i: number, key: string) => {
    if (Array.isArray(d)) return d[i];
    if (typeof d === 'object' && d[key] !== undefined) return d[key];
    return undefined;
  };
  const r0 = get(0, 'roundId'), r1 = get(1, 'lotteryType'), r2 = get(2, 'status');
  if (r0 === undefined && r1 === undefined) return null;
  return {
    roundId: Number(r0 ?? 0),
    lotteryType: Number(r1 ?? 0),
    status: Number(r2 ?? 0),
    prizeTarget: BigInt(get(3, 'prizeTarget') ?? 0),
    totalCollected: BigInt(get(4, 'totalCollected') ?? 0),
    ticketCount: Number(get(5, 'ticketCount') ?? 0),
    participantCount: Number(get(6, 'participantCount') ?? 0),
    startTime: Number(get(7, 'startTime') ?? 0),
    endTime: Number(get(8, 'endTime') ?? 0),
    closeThreshold: BigInt(get(9, 'closeThreshold') ?? 0),
    winner1: String(get(10, 'winner1') ?? '0x0000000000000000000000000000000000000000'),
    winner2: String(get(11, 'winner2') ?? '0x0000000000000000000000000000000000000000'),
    winner3: String(get(12, 'winner3') ?? '0x0000000000000000000000000000000000000000'),
    prize1: BigInt(get(13, 'prize1') ?? 0),
    prize2: BigInt(get(14, 'prize2') ?? 0),
    prize3: BigInt(get(15, 'prize3') ?? 0),
  };
}

const fmtUSDT = (val: bigint) =>
  parseFloat(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 });

const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

// ── Main page ───────────────────────────────────────────────────────
export default function LotteryPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const onCorrectChain = chainId === bsc.id;

  // 4 getCurrentRound reads — one per lottery type (hooks must not be in a loop)
  const readMega = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [0], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const readBig = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [1], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const readMedium = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [2], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const readSmall = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [3], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const reads = [readMega, readBig, readMedium, readSmall];

  // Names + prices (read once each)
  const { data: namesData } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`,
    abi: LotteryABI,
    functionName: 'getLotteryNames',
    chainId: bsc.id,
  }) as { data: readonly [string, string, string, string] | undefined };

  const { data: pricesData } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`,
    abi: LotteryABI,
    functionName: 'getTicketPrices',
    chainId: bsc.id,
  }) as { data: readonly [bigint, bigint, bigint, bigint] | undefined };

  // Distribution bps
  const { data: w1Bps } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'winner1ShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: w2Bps } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'winner2ShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: w3Bps } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'winner3ShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: bbBps } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'buybackShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: wlBps } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'walletShareBps', chainId: bsc.id }) as { data: bigint | undefined };

  // USDT balance + allowance (shared)
  const { data: usdtBalanceData } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'], chainId: bsc.id,
  });
  const usdtBalance = usdtBalanceData ?? BigInt(0);

  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [address || '0x0', LOTTERY_ADDRESS as `0x${string}`], chainId: bsc.id,
  });
  const allowance = allowanceData ?? BigInt(0);

  // User history
  const { data: userHistoryData } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`,
    abi: LotteryABI,
    functionName: 'getUserHistory',
    args: [address || '0x0'],
    chainId: bsc.id,
  }) as {
    data: readonly {
      roundId: bigint;
      lotteryType: number;
      ticketCount: bigint;
      totalPaid: bigint;
      timestamp: bigint;
    }[] | undefined;
  };

  // Parse rounds — use mock data if contract not deployed, null-safe otherwise
  const rounds = LOTTERY_NOT_DEPLOYED ? MOCK_ROUNDS : reads.map((r) => parseRound(r?.data));
  const names = LOTTERY_NOT_DEPLOYED ? DEFAULT_NAMES : (namesData && Array.isArray(namesData) ? [namesData[0], namesData[1], namesData[2], namesData[3]] : DEFAULT_NAMES);
  const prices = LOTTERY_NOT_DEPLOYED ? MOCK_PRICES : (pricesData && Array.isArray(pricesData)
    ? [pricesData[0] ?? BigInt(0), pricesData[1] ?? BigInt(0), pricesData[2] ?? BigInt(0), pricesData[3] ?? BigInt(0)]
    : [BigInt(0), BigInt(0), BigInt(0), BigInt(0)]);
  const w1 = LOTTERY_NOT_DEPLOYED ? MOCK_W_BPS[0] : (w1Bps ?? BigInt(5000));
  const w2 = LOTTERY_NOT_DEPLOYED ? MOCK_W_BPS[1] : (w2Bps ?? BigInt(3000));
  const w3 = LOTTERY_NOT_DEPLOYED ? MOCK_W_BPS[2] : (w3Bps ?? BigInt(1500));
  const bb = LOTTERY_NOT_DEPLOYED ? MOCK_W_BPS[3] : (bbBps ?? BigInt(300));
  const wl = LOTTERY_NOT_DEPLOYED ? MOCK_W_BPS[4] : (wlBps ?? BigInt(200));

  // waitForTx via RPC polling
  const waitForTx = async (txHash: string) => {
    const maxTries = 60;
    for (let i = 0; i < maxTries; i++) {
      try {
        const receipt = await fetch('https://bsc-dataseed.binance.org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [txHash], id: 1 }),
        }).then((r) => r.json());
        if (receipt.result) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const handleApprove = async () => {
    if (!onCorrectChain) {
      await switchChainAsync?.({ chainId: bsc.id });
      return;
    }
    const toastId = toast.loading('Approving USDT...');
    try {
      const tx = await writeContractAsync({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [LOTTERY_ADDRESS as `0x${string}`, parseUnits('1000000', 18)],
        chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success('USDT approved!', { id: toastId, duration: 4000 });
      refetchAllowance();
    } catch (e: any) {
      toast.error(e?.shortMessage || 'Approval failed', { duration: 8000 });
      throw e;
    }
  };

  const handleBuy = async (lotteryType: number, ticketCount: number) => {
    if (LOTTERY_NOT_DEPLOYED) { toast.success('Preview mode — lottery contract not deployed yet.'); return; }
    if (!onCorrectChain) {
      await switchChainAsync?.({ chainId: bsc.id });
      return;
    }
    const toastId = toast.loading(`Buying ${ticketCount} ticket(s)...`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`,
        abi: LotteryABI,
        functionName: 'buyTickets',
        args: [lotteryType, BigInt(ticketCount)],
        chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success(`Successfully purchased ${ticketCount} ticket(s)!`, { id: toastId, duration: 5000 });
      reads.forEach((r) => r.refetch());
      refetchAllowance();
    } catch (e: any) {
      toast.error(e?.shortMessage || 'Purchase failed', { duration: 8000 });
      throw e;
    }
  };

  const dist = [
    { label: 'Winner 1', bps: w1, color: 'from-gold to-gold-dark', text: 'text-gold', icon: Trophy },
    { label: 'Winner 2', bps: w2, color: 'from-gray-300 to-gray-500', text: 'text-silver', icon: Medal },
    { label: 'Winner 3', bps: w3, color: 'from-orange-400 to-orange-600', text: 'text-orange-400', icon: Award },
    { label: 'Buy-Back', bps: bb, color: 'from-blue-400 to-blue-600', text: 'text-blue-400', icon: TrendingUp },
    { label: 'Project', bps: wl, color: 'from-purple-400 to-purple-600', text: 'text-purple-400', icon: Wallet },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 relative overflow-hidden">
      <ParticleField count={15} />
      <div className="absolute inset-0 bg-gradient-to-b from-gold/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Preview Banner */}
        {LOTTERY_NOT_DEPLOYED && (
          <motion.div variants={fadeUp} className="mb-6 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/10 to-transparent p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-gold font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              PREVIEW MODE — Lottery contracts not deployed yet. Data shown is illustrative.
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center mb-12">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 mb-4">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold font-medium">VyronX Lottery</span>
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent mb-3">
            4 Lotteries. One Ticket Away.
          </motion.h1>
          <motion.p variants={fadeUp} className="text-beige/60 text-lg max-w-2xl mx-auto">
            Mega, Big, Medium e Small rodando em paralelo. Compre bilhetes com USDT e concorra a prêmios instantâneos.
          </motion.p>
        </motion.div>

        {/* Mega card (type 0) — full width, featured */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-8">
          <LotteryCard
            lotteryType={0}
            name={names[0]}
            ticketPrice={prices[0]}
            round={rounds[0]}
            userTickets={BigInt(0)}
            usdtBalance={usdtBalance}
            allowance={allowance}
            isConnected={isConnected}
            onCorrectChain={onCorrectChain}
            onApprove={handleApprove}
            onBuy={handleBuy}
            onSwitchChain={() => switchChainAsync?.({ chainId: bsc.id })}
            isMega
          />
        </motion.div>

        {/* Smaller cards: Big / Medium / Small */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {[1, 2, 3].map((lt) => (
            <motion.div key={lt} initial="hidden" animate="visible" variants={fadeUp}>
              <LotteryCard
                lotteryType={lt}
                name={names[lt]}
                ticketPrice={prices[lt]}
                round={rounds[lt]}
                userTickets={BigInt(0)}
                usdtBalance={usdtBalance}
                allowance={allowance}
                isConnected={isConnected}
                onCorrectChain={onCorrectChain}
                onApprove={handleApprove}
                onBuy={handleBuy}
                onSwitchChain={() => switchChainAsync?.({ chainId: bsc.id })}
              />
            </motion.div>
          ))}
        </div>

        {/* Prize Distribution */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp}
          className="rounded-2xl border border-dark-border bg-dark-card/60 backdrop-blur-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gold" /> Prize Distribution
          </h2>
          <div className="space-y-4">
            {dist.map((d) => {
              const pct = Number(d.bps) / 100;
              return (
                <div key={d.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2 text-beige/60">
                      <d.icon className={`w-4 h-4 ${d.text}`} /> {d.label}
                    </span>
                    <span className={`font-bold ${d.text}`}>{pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-dark-elevated overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full bg-gradient-to-r ${d.color} rounded-full`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* User History */}
        {isConnected && userHistoryData && Array.isArray(userHistoryData) && userHistoryData.length > 0 && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp}
            className="rounded-2xl border border-dark-border bg-dark-card/60 backdrop-blur-sm p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-gold" /> Your Purchase History
            </h2>
            <div className="space-y-2">
              {userHistoryData.slice().reverse().slice(0, 20).map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-dark-elevated px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-4 h-4 text-gold" />
                    <span className="text-sm text-beige/60">Round #{Number(h.roundId)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold/80">
                      {names[h.lotteryType] ?? `Type ${h.lotteryType}`}
                    </span>
                    <span className="text-xs text-beige/40">{Number(h.ticketCount)} tickets</span>
                  </div>
                  <span className="text-sm text-white font-medium">${fmtUSDT(h.totalPaid)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── LotteryCard subcomponent ────────────────────────────────────────
interface LotteryCardProps {
  lotteryType: number;
  name: string;
  ticketPrice: bigint;
  round: ParsedRound | null;
  userTickets: bigint;
  usdtBalance: bigint;
  allowance: bigint;
  isConnected: boolean;
  onCorrectChain: boolean;
  onApprove: () => Promise<void>;
  onBuy: (lotteryType: number, ticketCount: number) => Promise<void>;
  onSwitchChain: () => void;
  isMega?: boolean;
}

function LotteryCard({
  lotteryType, name, ticketPrice, round, userTickets, usdtBalance, allowance,
  isConnected, onCorrectChain, onApprove, onBuy, onSwitchChain, isMega,
}: LotteryCardProps) {
  const [ticketCount, setTicketCount] = useState('1');
  const [txPending, setTxPending] = useState(false);

  const status = round?.status ?? 0;
  const isActive = status === 1;
  const isInactive = status === 0;
  const isCompleted = status === 3;
  const numTickets = parseInt(ticketCount) || 0;
  const totalCost = BigInt(numTickets) * ticketPrice;
  const needsApproval = allowance < totalCost;

  const progressPct = round && round.closeThreshold > BigInt(0)
    ? Math.min(100, Number((round.totalCollected * BigInt(10000)) / round.closeThreshold) / 100)
    : 0;

  const handleApproveClick = async () => {
    setTxPending(true);
    try { await onApprove(); } catch {} finally { setTxPending(false); }
  };

  const handleBuyClick = async () => {
    if (numTickets < 1) { toast.error('Minimum 1 ticket'); return; }
    setTxPending(true);
    try {
      await onBuy(lotteryType, numTickets);
      setTicketCount('1');
    } catch {} finally { setTxPending(false); }
  };

  const cardBase = isMega
    ? 'rounded-3xl border-2 border-gold/60 bg-gradient-to-br from-dark-card via-dark-card to-gold/10 p-6 sm:p-8 shadow-[0_0_40px_rgba(212,175,55,0.25)]'
    : 'rounded-2xl border border-dark-border bg-dark-card/60 backdrop-blur-sm p-6';

  return (
    <div className={cardBase}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          {isMega && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-gold-light to-gold-dark text-black text-xs font-bold uppercase tracking-wider mb-2 pulse-scale">
              <Crown className="w-3.5 h-3.5" /> Prêmio Principal
            </div>
          )}
          <h2 className={`font-bold text-white ${isMega ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>{name}</h2>
          {round && (
            <div className="text-xs text-beige/40 mt-1">Round #{round.roundId}</div>
          )}
        </div>
        {round && (
          <span className={`text-xs px-2.5 py-1 rounded-full bg-dark-elevated font-medium ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        )}
      </div>

      {/* Prize target */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-beige/50 flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-gold/70" /> Prize Target
        </span>
        <span className={`font-bold text-gold ${isMega ? 'text-2xl' : 'text-lg'}`}>
          ${round ? fmtUSDT(round.prizeTarget) : '—'}
        </span>
      </div>

      {/* Progress bar */}
      {round && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-beige/40">Progresso</span>
            <span className="text-gold font-medium">{progressPct.toFixed(1)}%</span>
          </div>
          <div className={`rounded-full bg-dark-elevated overflow-hidden ${isMega ? 'h-3.5' : 'h-2.5'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-gold to-gold-dark rounded-full"
            />
          </div>
          <div className="flex justify-between text-xs text-beige/30 mt-1">
            <span>${fmtUSDT(round.totalCollected)}</span>
            <span>${fmtUSDT(round.closeThreshold)}</span>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {round && (
        <div className={`grid grid-cols-3 gap-2 mb-4 ${isMega ? 'sm:grid-cols-3' : ''}`}>
          <div className="rounded-xl bg-dark-elevated p-3 text-center">
            <Ticket className="w-4 h-4 text-gold/60 mx-auto mb-1" />
            <div className="text-base font-bold text-white">{round.ticketCount.toLocaleString()}</div>
            <div className="text-[10px] text-beige/40">Bilhetes</div>
          </div>
          <div className="rounded-xl bg-dark-elevated p-3 text-center">
            <Users className="w-4 h-4 text-gold/60 mx-auto mb-1" />
            <div className="text-base font-bold text-white">{round.participantCount}</div>
            <div className="text-[10px] text-beige/40">Participantes</div>
          </div>
          <div className="rounded-xl bg-gold/5 border border-gold/20 p-3 text-center">
            <Ticket className="w-4 h-4 text-gold mx-auto mb-1" />
            <div className="text-base font-bold text-gold">{Number(userTickets)}</div>
            <div className="text-[10px] text-beige/40">Seus bilhetes</div>
          </div>
        </div>
      )}

      {/* Winners (if completed) */}
      {isCompleted && round && (
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-semibold text-beige/50 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-gold" /> Ganhadores
          </h3>
          {String(round.winner1) !== ZERO_ADDRESS && (
            <div className="flex items-center justify-between rounded-lg bg-dark-elevated px-3 py-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs text-beige/50">1º</span>
                <span className="text-xs text-beige/40 font-mono">{shortAddr(round.winner1)}</span>
              </div>
              <span className="text-gold font-bold text-sm">${fmtUSDT(round.prize1)}</span>
            </div>
          )}
          {String(round.winner2) !== ZERO_ADDRESS && (
            <div className="flex items-center justify-between rounded-lg bg-dark-elevated px-3 py-2">
              <div className="flex items-center gap-2">
                <Medal className="w-3.5 h-3.5 text-silver" />
                <span className="text-xs text-beige/50">2º</span>
                <span className="text-xs text-beige/40 font-mono">{shortAddr(round.winner2)}</span>
              </div>
              <span className="text-silver font-bold text-sm">${fmtUSDT(round.prize2)}</span>
            </div>
          )}
          {String(round.winner3) !== ZERO_ADDRESS && (
            <div className="flex items-center justify-between rounded-lg bg-dark-elevated px-3 py-2">
              <div className="flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-beige/50">3º</span>
                <span className="text-xs text-beige/40 font-mono">{shortAddr(round.winner3)}</span>
              </div>
              <span className="text-orange-400 font-bold text-sm">${fmtUSDT(round.prize3)}</span>
            </div>
          )}
        </div>
      )}

      {/* Inactive notice */}
      {isInactive && (
        <div className="text-center py-6 rounded-xl bg-dark-elevated">
          <Clock className="w-8 h-8 text-beige/30 mx-auto mb-2" />
          <p className="text-beige/50 text-sm">Aguardando abertura</p>
        </div>
      )}

      {/* Buy form (active only) */}
      {isActive && (
        <>
          {/* Ticket price */}
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-beige/50">Preço por bilhete</span>
            <span className="text-white font-medium">${fmtUSDT(ticketPrice)} USDT</span>
          </div>

          {/* Input */}
          <label className="block text-xs text-beige/50 mb-1.5">Quantidade de bilhetes</label>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setTicketCount(String(Math.max(1, numTickets - 1)))}
              className="w-9 h-9 rounded-lg bg-dark-elevated text-white hover:bg-dark-border transition-colors flex items-center justify-center text-lg"
            >−</button>
            <input
              type="number"
              value={ticketCount}
              onChange={(e) => setTicketCount(e.target.value)}
              min="1"
              className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white text-center text-base font-semibold focus:border-gold/50 outline-none"
            />
            <button
              onClick={() => setTicketCount(String(numTickets + 1))}
              className="w-9 h-9 rounded-lg bg-dark-elevated text-white hover:bg-dark-border transition-colors flex items-center justify-center text-lg"
            >+</button>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map((n) => (
              <button key={n} onClick={() => setTicketCount(String(n))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  numTickets === n
                    ? 'bg-gold/20 text-gold border border-gold/30'
                    : 'bg-dark-elevated text-beige/60 hover:text-white border border-transparent'
                }`}>
                {n}
              </button>
            ))}
          </div>

          {/* Total + balance */}
          <div className="flex items-center justify-between py-2 border-t border-dark-border text-sm mb-3">
            <span className="text-beige/50">Total</span>
            <span className="text-white font-bold">${fmtUSDT(totalCost)} USDT</span>
          </div>
          <div className="flex items-center justify-between text-xs text-beige/40 mb-3">
            <span>Seu saldo USDT</span>
            <span>${fmtUSDT(usdtBalance)}</span>
          </div>

          {/* Wallet states */}
          {!isConnected ? (
            <div className="text-center py-4">
              <Wallet className="w-8 h-8 text-beige/30 mx-auto mb-2" />
              <p className="text-beige/50 text-sm">Conecte sua carteira</p>
            </div>
          ) : !onCorrectChain ? (
            <button onClick={onSwitchChain}
              className="w-full py-3 rounded-xl bg-dark-elevated text-white font-semibold hover:bg-dark-border transition-colors flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" /> Trocar para BNB Smart Chain
            </button>
          ) : needsApproval ? (
            <button
              onClick={handleApproveClick}
              disabled={txPending || usdtBalance < totalCost}
              className="w-full py-3 rounded-xl bg-dark-elevated text-white font-semibold hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {txPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {txPending ? 'Processando...' : 'Approve USDT'}
            </button>
          ) : (
            <button
              onClick={handleBuyClick}
              disabled={txPending || usdtBalance < totalCost}
              className={`w-full py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isMega ? 'shadow-lg shadow-gold/30' : ''
              }`}
            >
              {txPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
              {txPending ? 'Processando...' : `Comprar ${numTickets} bilhete(s)`}
            </button>
          )}

          {usdtBalance < totalCost && isConnected && onCorrectChain && (
            <p className="text-center text-xs text-red-400 mt-2">Saldo USDT insuficiente</p>
          )}
        </>
      )}
    </div>
  );
}
