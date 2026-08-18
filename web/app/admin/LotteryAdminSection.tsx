'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useSwitchChain } from 'wagmi';
import {
  Gift, Loader2, Play, Power, DollarSign, Percent, Ticket,
  Trophy, Check, AlertCircle, Settings, Sparkles, Tag, Flame,
  Image as ImageIcon, Upload, Trash2, Wallet,
} from 'lucide-react';
import { LOTTERY_ADDRESS, LotteryABI, TOKEN_ADDRESS, TokenABI } from '@/lib/contracts';
import { formatUnits, parseUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } } };

// RoundView tuple (18 fields):
// [0]roundId [1]lotteryType [2]status [3]prizeTarget [4]totalCollected
// [5]ticketCount [6]participantCount [7]startTime [8]endTime [9]closeThreshold
// [10]winner1 [11]winner2 [12]winner3 [13]prize1 [14]prize2 [15]prize3
// [16]buybackAmount [17]walletPayoutTotal
type RoundTuple = readonly [
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  bigint, `0x${string}`, `0x${string}`, `0x${string}`,
  bigint, bigint, bigint, bigint, bigint
];

const STATUS_LABELS = ['Inactive', 'Active', 'Drawing', 'Completed'];
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

const LOTTERY_META = [
  { type: 0, label: 'Mega', color: 'gold', icon: Sparkles, highlight: true },
  { type: 1, label: 'Big', color: 'purple', icon: Trophy, highlight: false },
  { type: 2, label: 'Medium', color: 'blue', icon: Gift, highlight: false },
  { type: 3, label: 'Small', color: 'green', icon: Ticket, highlight: false },
];

interface Props {
  writeContractAsync: (config: any) => Promise<`0x${string}`>;
  pending: string | null;
  setPending: (v: string | null) => void;
}

const waitForTx = async (txHash: string) => {
  for (let i = 0; i < 90; i++) {
    try {
      const receipt = await fetch('https://bsc-dataseed.binance.org', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [txHash], id: 1 })
      }).then(r => r.json());
      if (receipt.result) return;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
};

export default function LotteryAdminSection({ writeContractAsync, pending, setPending }: Props) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const onCorrectChain = chainId === bsc.id;

  // Per-type state
  const [targets, setTargets] = useState<string[]>(['10000', '5000', '1000', '500']);
  const [adjustTarget, setAdjustTarget] = useState<string[]>(['', '', '', '']);
  const [names, setNames] = useState<string[]>(['Mega', 'Big', 'Medium', 'Small']);
  const [prices, setPrices] = useState<string[]>(['1', '1', '1', '1']);

  // Distribution state
  const [w1Bps, setW1Bps] = useState('5000');
  const [w2Bps, setW2Bps] = useState('600');
  const [w3Bps, setW3Bps] = useState('400');
  const [bbBps, setBbBps] = useState('2000');
  const [wlBps, setWlBps] = useState('2000');
  // Fee wallet addresses (4) + buyback wallet — editable
  const [lotFeeWallets, setLotFeeWallets] = useState<[string, string, string, string]>(['', '', '', '']);
  const [lotBuyback, setLotBuyback] = useState('');

  // Reads: 4 current rounds (inlined to respect Rules of Hooks)
  const r0 = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [0], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const r1 = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [1], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const r2 = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [2], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const r3 = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getCurrentRound', args: [3], chainId: bsc.id,
  }) as { data: RoundTuple | undefined; refetch: () => void };
  const roundReads = [r0, r1, r2, r3];

  // Read names, prices, bps
  const { data: nameData } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getLotteryNames', chainId: bsc.id,
  }) as { data: readonly [string, string, string, string] | undefined };

  const { data: priceData } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getTicketPrices', chainId: bsc.id,
  }) as { data: readonly [bigint, bigint, bigint, bigint] | undefined };

  // Read lottery images from chain
  const { data: imageData, refetch: refetchImages } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'getLotteryImages', chainId: bsc.id,
  }) as { data: readonly [string, string, string, string] | undefined; refetch: () => void };

  const { data: curW1 } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'winner1ShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: curW2 } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'winner2ShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: curW3 } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'winner3ShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: curBb } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'buybackShareBps', chainId: bsc.id }) as { data: bigint | undefined };
  const { data: curWl } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'walletShareBps', chainId: bsc.id }) as { data: bigint | undefined };

  // Current fee wallets on-chain (array of 4) + buyback wallet
  const { data: curFeeWallets } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'getFeeWallets', chainId: bsc.id }) as { data: readonly [string, string, string, string] | undefined };
  const { data: curLotBuyback } = useReadContract({ address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'buybackWallet', chainId: bsc.id }) as { data: string | undefined };

  const handleSetLotFeeWallets = async () => {
    const ws = lotFeeWallets.map(w => w.trim()) as [string, string, string, string];
    const bb = lotBuyback.trim();
    if (!ws.every(w => /^0x[a-fA-F0-9]{40}$/.test(w))) return toast.error('Fill ALL 4 fee wallets (0x...)');
    if (!/^0x[a-fA-F0-9]{40}$/.test(bb)) return toast.error('Fill the buyback wallet (0x...)');
    if (!onCorrectChain) { await switchChainAsync?.({ chainId: bsc.id }); return; }
    setPending('Update Lottery Wallets');
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setFeeWallets', args: [ws, bb], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success('Lottery fee wallets updated!');
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const { data: totalRounds, refetch: refetchTotalRounds } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI, functionName: 'totalRoundsCompleted', chainId: bsc.id,
  }) as { data: bigint | undefined; refetch: () => void };

  const fmt = (val: bigint | undefined) => val ? parseFloat(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0';

  const parseRound = (data: RoundTuple | undefined, lt: number) => {
    if (!data || data[0] === BigInt(0)) return null;
    return {
      roundId: Number(data[0]),
      lotteryType: Number(data[1]),
      status: Number(data[2]),
      prizeTarget: data[3],
      totalCollected: data[4],
      ticketCount: Number(data[5]),
      participantCount: Number(data[6]),
      closeThreshold: data[9],
      winner1: data[10],
      winner2: data[11],
      winner3: data[12],
      prize1: data[13],
      prize2: data[14],
      prize3: data[15],
    };
  };

  const handleOpenRound = async (lt: number) => {
    if (!onCorrectChain) { await switchChainAsync?.({ chainId: bsc.id }); return; }
    const target = targets[lt];
    if (!target || parseFloat(target) <= 0) { toast.error('Invalid target'); return; }
    setPending(`Open ${LOTTERY_META[lt].label}`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'openRound', args: [lt, parseUnits(target, 18)], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success(`${LOTTERY_META[lt].label} round opened! Target: $${target}`);
      roundReads[lt].refetch();
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const handleAdjustTarget = async (lt: number) => {
    const val = adjustTarget[lt];
    if (!val || parseFloat(val) <= 0) { toast.error('Invalid target'); return; }
    setPending(`Set Target ${LOTTERY_META[lt].label}`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setPrizeTarget', args: [lt, parseUnits(val, 18)], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success(`Target updated to $${val}`);
      setAdjustTarget(prev => { const n = [...prev]; n[lt] = ''; return n; });
      roundReads[lt].refetch();
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const handleForceClose = async (lt: number) => {
    if (!confirm(`Force close ${LOTTERY_META[lt].label} round and draw winners?`)) return;
    setPending(`Force Close ${LOTTERY_META[lt].label}`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'forceCloseRound', args: [lt], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success(`${LOTTERY_META[lt].label} closed & winners drawn!`);
      roundReads[lt].refetch();
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const handleSetDistribution = async () => {
    const w1 = parseInt(wlBps), w2 = parseInt(bbBps), w3 = parseInt(w1Bps), w4 = parseInt(w2Bps), w5 = parseInt(w3Bps);
    if (w1 + w2 + w3 + w4 + w5 !== 10000) { toast.error(`Total: ${w1 + w2 + w3 + w4 + w5} (must be 10000)`); return; }
    setPending('Set Distribution');
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setDistributionBps', args: [BigInt(w1), BigInt(w2), BigInt(w3), BigInt(w4), BigInt(w5)], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success('Distribution updated!');
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const handleSetName = async (lt: number) => {
    const name = names[lt];
    if (!name) { toast.error('Empty name'); return; }
    setPending(`Rename ${LOTTERY_META[lt].label}`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setLotteryName', args: [lt, name], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success('Name updated!');
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const handleSetPrice = async (lt: number) => {
    const price = prices[lt];
    if (!price || parseFloat(price) <= 0) { toast.error('Invalid price'); return; }
    setPending(`Price ${LOTTERY_META[lt].label}`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setTicketPrice', args: [lt, parseUnits(price, 18)], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success('Ticket price updated!');
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const totalSum = parseInt(wlBps) + parseInt(bbBps) + parseInt(w1Bps) + parseInt(w2Bps) + parseInt(w3Bps);

  const refetchAll = () => {
    roundReads.forEach((r) => r.refetch());
    refetchTotalRounds();
    refetchImages();
  };

  return (
    <>
      {/* Overview bar */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-gold" />
          <span className="text-sm font-semibold text-white">Total Rounds Completed: {Number(totalRounds ?? BigInt(0))}</span>
        </div>
        <div className="text-xs text-beige/40">
          {nameData ? `Names: ${nameData[0]} / ${nameData[1]} / ${nameData[2]} / ${nameData[3]}` : 'Loading...'}
        </div>
      </motion.div>

      {/* 4 Lottery Management Cards */}
      {LOTTERY_META.map((meta) => {
        const round = parseRound(roundReads[meta.type].data, meta.type);
        const isActive = round?.status === 1;
        const isCompleted = round?.status === 3;
        const Icon = meta.icon;
        const borderClass = meta.highlight
          ? 'border-gold/40 shadow-lg shadow-gold/10'
          : meta.type === 1 ? 'border-purple-500/30'
          : meta.type === 2 ? 'border-blue-500/30'
          : 'border-green-500/30';

        return (
          <motion.div key={meta.type} variants={fadeUp} className={`rounded-2xl border ${borderClass} bg-dark-card/60 p-6`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon className={`w-6 h-6 ${meta.highlight ? 'text-gold' : meta.type === 1 ? 'text-purple-400' : meta.type === 2 ? 'text-blue-400' : 'text-green-400'}`} />
                <h3 className="text-lg font-bold text-white">{meta.label}</h3>
                {meta.highlight && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/30">★ HIGHLIGHTED</span>
                )}
                {round && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-green-500/10 text-green-400' : isCompleted ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>
                    {STATUS_LABELS[round.status]}
                  </span>
                )}
              </div>
            </div>

            {/* Round info */}
            {round ? (
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg bg-dark-elevated p-3 text-center">
                    <div className="text-xs text-beige/40">Prize-1</div>
                    <div className="text-sm font-bold text-gold">${fmt(round.prizeTarget)}</div>
                  </div>
                  <div className="rounded-lg bg-dark-elevated p-3 text-center">
                    <div className="text-xs text-beige/40">Collected</div>
                    <div className="text-sm font-bold text-white">${fmt(round.totalCollected)}</div>
                  </div>
                  <div className="rounded-lg bg-dark-elevated p-3 text-center">
                    <div className="text-xs text-beige/40">Tickets</div>
                    <div className="text-sm font-bold text-white">{round.ticketCount}</div>
                  </div>
                  <div className="rounded-lg bg-dark-elevated p-3 text-center">
                    <div className="text-xs text-beige/40">Participants</div>
                    <div className="text-sm font-bold text-white">{round.participantCount}</div>
                  </div>
                </div>
                <div className="text-xs text-beige/30">
                  Close threshold: ${fmt(round.closeThreshold)} | Round #{round.roundId}
                </div>

                {/* Winners */}
                {isCompleted && String(round.winner1) !== ZERO_ADDR && (
                  <div className="space-y-1">
                    <div className="text-xs text-gold">🥇 {String(round.winner1).slice(0,10)}... → ${fmt(round.prize1)}</div>
                    {String(round.winner2) !== ZERO_ADDR && <div className="text-xs text-silver">🥈 {String(round.winner2).slice(0,10)}... → ${fmt(round.prize2)}</div>}
                    {String(round.winner3) !== ZERO_ADDR && <div className="text-xs text-orange-400">🥉 {String(round.winner3).slice(0,10)}... → ${fmt(round.prize3)}</div>}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-beige/40 mb-4">No active round (Type {meta.type})</div>
            )}

            {/* Controls */}
            <div className="space-y-3">
              {/* Open Round */}
              {!isActive && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="number" value={targets[meta.type]}
                    onChange={(e) => setTargets(prev => { const n = [...prev]; n[meta.type] = e.target.value; return n; })}
                    placeholder="Prize-1 target (USDT)"
                    className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-gold/50 outline-none" />
                  <button onClick={() => handleOpenRound(meta.type)} disabled={pending !== null}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-1 justify-center">
                    {pending === `Open ${meta.label}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Open Round
                  </button>
                </div>
              )}

              {/* Adjust Target */}
              {isActive && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="number" value={adjustTarget[meta.type]}
                    onChange={(e) => setAdjustTarget(prev => { const n = [...prev]; n[meta.type] = e.target.value; return n; })}
                    placeholder="New prize target"
                    className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-gold/50 outline-none" />
                  <button onClick={() => handleAdjustTarget(meta.type)} disabled={pending !== null}
                    className="px-4 py-2 rounded-lg bg-dark-elevated text-white font-bold text-sm hover:bg-dark-border disabled:opacity-50 flex items-center gap-1 justify-center">
                    {pending === `Set Target ${meta.label}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                    Adjust Target
                  </button>
                </div>
              )}

              {/* Force Close */}
              {isActive && (
                <button onClick={() => handleForceClose(meta.type)} disabled={pending !== null}
                  className="w-full px-4 py-2 rounded-lg bg-red-600/20 text-red-400 font-bold text-sm hover:bg-red-600/30 border border-red-500/30 disabled:opacity-50 flex items-center gap-1 justify-center">
                  {pending === `Force Close ${meta.label}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  Force Close & Draw
                </button>
              )}

              {/* Name + Price (inline) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-dark-border">
                <div className="flex gap-1">
                  <input type="text" value={names[meta.type]}
                    onChange={(e) => setNames(prev => { const n = [...prev]; n[meta.type] = e.target.value; return n; })}
                    placeholder="Name"
                    className="flex-1 h-8 rounded bg-dark-elevated border border-dark-border text-white px-2 text-xs focus:border-gold/50 outline-none" />
                  <button onClick={() => handleSetName(meta.type)} disabled={pending !== null}
                    className="px-2 py-1 rounded bg-dark-elevated text-beige/60 hover:text-white text-xs flex items-center gap-1 disabled:opacity-50">
                    <Tag className="w-3 h-3" /> Set
                  </button>
                </div>
                <div className="flex gap-1">
                  <input type="number" value={prices[meta.type]}
                    onChange={(e) => setPrices(prev => { const n = [...prev]; n[meta.type] = e.target.value; return n; })}
                    placeholder="$ / ticket"
                    className="flex-1 h-8 rounded bg-dark-elevated border border-dark-border text-white px-2 text-xs focus:border-gold/50 outline-none" />
                  <button onClick={() => handleSetPrice(meta.type)} disabled={pending !== null}
                    className="px-2 py-1 rounded bg-dark-elevated text-beige/60 hover:text-white text-xs flex items-center gap-1 disabled:opacity-50">
                    <Ticket className="w-3 h-3" /> Set
                  </button>
                </div>
              </div>

              {/* Image upload — compressed to data-URI and stored on-chain */}
              <LotteryImageUploader
                lotteryType={meta.type}
                label={meta.label}
                currentImage={imageData?.[meta.type] ?? ''}
                onSaved={refetchAll}
                writeContractAsync={writeContractAsync}
                pending={pending}
                setPending={setPending}
              />
            </div>
          </motion.div>
        );
      })}

      {/* Global Distribution Settings */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Percent className="w-5 h-5 text-gold" /> Distribution % (Global — applies to all 4 lotteries)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-beige/50 mb-1">4 Wallets ({Number(curWl ?? BigInt(2000)) / 100}%)</label>
            <input type="number" value={wlBps} onChange={(e) => setWlBps(e.target.value)} className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">Buy-Back ({Number(curBb ?? BigInt(2000)) / 100}%)</label>
            <input type="number" value={bbBps} onChange={(e) => setBbBps(e.target.value)} className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">Winner 1 ({Number(curW1 ?? BigInt(5000)) / 100}%)</label>
            <input type="number" value={w1Bps} onChange={(e) => setW1Bps(e.target.value)} className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">Winner 2 ({Number(curW2 ?? BigInt(600)) / 100}%)</label>
            <input type="number" value={w2Bps} onChange={(e) => setW2Bps(e.target.value)} className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">Winner 3 ({Number(curW3 ?? BigInt(400)) / 100}%)</label>
            <input type="number" value={w3Bps} onChange={(e) => setW3Bps(e.target.value)} className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div className="flex items-end">
            <div className={`w-full text-center rounded-lg px-3 py-2 text-sm font-bold ${totalSum === 10000 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              Total: {totalSum} / 10000
            </div>
          </div>
        </div>
        <button onClick={handleSetDistribution} disabled={pending !== null || totalSum !== 10000}
          className="px-6 py-2.5 rounded-xl bg-dark-elevated text-white font-bold hover:bg-dark-border disabled:opacity-50 flex items-center gap-2">
          {pending === 'Set Distribution' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Update Distribution
        </button>
      </motion.div>

      {/* Fee Wallet Addresses — 4 recipients + buyback */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-gold" /> Fee Wallet Addresses
        </h3>
        <p className="text-xs text-beige/50 mb-4">The "4 Wallets" share above is split equally between these addresses. All 5 fields required to update.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          {(['Wallet 1', 'Wallet 2', 'Wallet 3', 'Wallet 4'] as const).map((lbl, i) => (
            <div key={lbl}>
              <div className="text-xs text-beige/50 mb-1">{lbl} — Current</div>
              <code className="text-xs text-gold break-all">{curFeeWallets?.[i] || '...'}</code>
            </div>
          ))}
          <div>
            <div className="text-xs text-beige/50 mb-1">Buyback — Current</div>
            <code className="text-xs text-gold break-all">{curLotBuyback || '...'}</code>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {([0, 1, 2, 3] as const).map((i) => (
            <div key={i}>
              <label className="block text-xs text-beige/50 mb-1">New Wallet {i + 1}</label>
              <input type="text" placeholder="0x..."
                value={lotFeeWallets[i]}
                onChange={(e) => setLotFeeWallets(prev => { const n = [...prev] as [string, string, string, string]; n[i] = e.target.value; return n; })}
                className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-xs font-mono focus:border-gold/50 outline-none" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-beige/50 mb-1">New Buyback Wallet</label>
            <input type="text" placeholder="0x..."
              value={lotBuyback}
              onChange={(e) => setLotBuyback(e.target.value)}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-xs font-mono focus:border-gold/50 outline-none" />
          </div>
        </div>
        <button onClick={handleSetLotFeeWallets} disabled={pending !== null}
          className="px-6 py-2.5 rounded-xl bg-gold/10 text-gold border border-gold/30 font-bold hover:bg-gold/20 disabled:opacity-50 flex items-center gap-2">
          {pending === 'Update Lottery Wallets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Update Wallets (All 5)
        </button>
      </motion.div>

      {/* Token Fee Exclusion — CRÍTICO para buy-back funcionar sem perder 8% */}
      <FeeExclusionSection writeContractAsync={writeContractAsync} pending={pending} setPending={setPending} />

      {/* Buy-Back Settings */}
      <BuybackSettings writeContractAsync={writeContractAsync} pending={pending} setPending={setPending} />

      {/* Contract info */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-4">
        <div className="flex items-center gap-2 text-xs text-beige/40">
          <Settings className="w-4 h-4" />
          <span className="font-mono">{LOTTERY_ADDRESS}</span>
        </div>
      </motion.div>
    </>
  );
}

// ════════════════════════════════════════════════════
// Buyback Settings Sub-component
// ════════════════════════════════════════════════════

function BuybackSettings({ writeContractAsync, pending, setPending }: {
  writeContractAsync: (config: any) => Promise<`0x${string}`>;
  pending: string | null;
  setPending: (v: string | null) => void;
}) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const onCorrectChain = chainId === bsc.id;

  const { data: autoEnabled } = useReadContract({
    address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
    functionName: 'autoBuybackEnabled', chainId: bsc.id,
  }) as { data: boolean | undefined };

  const handleToggle = async () => {
    if (!onCorrectChain) { await switchChainAsync?.({ chainId: bsc.id }); return; }
    setPending('Toggle Buyback');
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setAutoBuybackEnabled', args: [!autoEnabled], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success(`Auto buy-back ${!autoEnabled ? 'ENABLED' : 'DISABLED'}!`);
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-gold" /> Auto Buy-Back & Burn
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-dark-elevated">
          <div>
            <div className="text-sm font-semibold text-white">Swap USDT → VYR + Burn</div>
            <div className="text-xs text-beige/40 mt-1">
              {autoEnabled
                ? '✅ Active — Buys VYR on PancakeSwap and burns automatically after each draw'
                : '⚠️ Disabled — Buy-back USDT goes directly to fallback wallet'}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={pending !== null}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 ${
              autoEnabled
                ? 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                : 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
            }`}
          >
            {pending === 'Toggle Buyback' ? <Loader2 className="w-4 h-4 animate-spin" /> : autoEnabled ? 'DISABLE' : 'ENABLE'}
          </button>
        </div>
        <div className="text-xs text-beige/30 leading-relaxed">
          <strong className="text-beige/50">How it works:</strong> When a lottery closes, 20% of the pool is sent
          to PancakeSwap V2, buys $VYR with USDT, and the purchased tokens are <strong className="text-red-400">permanently burned</strong>.
          This reduces circulating supply and supports the chart price. If the swap fails (low liquidity), USDT goes to the fallback wallet.
        </div>
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════
// Fee Exclusion Sub-component (leigo-friendly)
// ════════════════════════════════════════════════════

function FeeExclusionSection({ writeContractAsync, pending, setPending }: {
  writeContractAsync: (config: any) => Promise<`0x${string}`>;
  pending: string | null;
  setPending: (v: string | null) => void;
}) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const onCorrectChain = chainId === bsc.id;
  const [customAddr, setCustomAddr] = useState('');

  // Check if lottery is excluded from fees
  const { data: isExcludedFees } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI,
    functionName: 'isExcludedFromFees', args: [LOTTERY_ADDRESS as `0x${string}`], chainId: bsc.id,
  }) as { data: boolean | undefined };

  // Check if lottery is authorized
  const { data: isAuthorized } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI,
    functionName: 'isAuthorized', args: [LOTTERY_ADDRESS as `0x${string}`], chainId: bsc.id,
  }) as { data: boolean | undefined };

  // Check if lottery is excluded from limits
  const { data: isExcludedLimits } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI,
    functionName: 'isExcludedFromLimits', args: [LOTTERY_ADDRESS as `0x${string}`], chainId: bsc.id,
  }) as { data: boolean | undefined };

  const allConfigured = isExcludedFees && isAuthorized && isExcludedLimits;

  const doTx = async (label: string, fn: string, args: any[]) => {
    if (!onCorrectChain) { await switchChainAsync?.({ chainId: bsc.id }); return; }
    setPending(label);
    try {
      const tx = await writeContractAsync({ address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI, functionName: fn, args, chainId: bsc.id });
      await waitForTx(tx);
      toast.success(`${label} OK!`);
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); }
    finally { setPending(null); }
  };

  const handleAllInOne = async () => {
    // Excluir taxas + autorizar + excluir limites em sequência (1 clique para o leigo)
    if (!onCorrectChain) { await switchChainAsync?.({ chainId: bsc.id }); return; }
    setPending('Configurando Loteria (3 transações)...');
    try {
      // 1. setExcludedFromFees
      const tx1 = await writeContractAsync({ address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI, functionName: 'setExcludedFromFees', args: [LOTTERY_ADDRESS as `0x${string}`, true], chainId: bsc.id });
      await waitForTx(tx1);
      toast.success('1/3 — Taxas excluídas');

      // 2. setAuthorized
      const tx2 = await writeContractAsync({ address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI, functionName: 'setAuthorized', args: [LOTTERY_ADDRESS as `0x${string}`, true], chainId: bsc.id });
      await waitForTx(tx2);
      toast.success('2/3 — Autorizada');

      // 3. setExcludedFromLimits
      const tx3 = await writeContractAsync({ address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI, functionName: 'setExcludedFromLimits', args: [LOTTERY_ADDRESS as `0x${string}`, true], chainId: bsc.id });
      await waitForTx(tx3);
      toast.success('3/3 — Limites excluídos. Loteria pronta! ✅');
    } catch (e: any) {
      toast.error(e?.shortMessage || 'Failed — verifique e tente novamente');
    } finally { setPending(null); }
  };

  const handleExcludeCustom = async () => {
    if (!customAddr || !customAddr.startsWith('0x') || customAddr.length !== 42) {
      toast.error('Endereço inválido');
      return;
    }
    await doTx('Excluir taxa (custom)', 'setExcludedFromFees', [customAddr as `0x${string}`, true]);
    setCustomAddr('');
  };

  return (
    <motion.div variants={fadeUp} className={`rounded-2xl border p-6 ${allConfigured ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <AlertCircle className={`w-5 h-5 ${allConfigured ? 'text-green-400' : 'text-red-400'}`} />
        Configuração de Taxas do Token
      </h3>

      <p className="text-sm text-beige/60 mb-4">
        A loteria precisa ser <strong className="text-white">isenta de taxas</strong> no token VYR.
        Sem isso, o buy-back perde 8% em cada operação e os usuários perdem tokens ao interagir.
      </p>

      {/* Status visual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className={`rounded-xl p-3 text-center ${isExcludedFees ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="text-xs text-beige/40 mb-1">Sem Taxa</div>
          <div className={`text-sm font-bold ${isExcludedFees ? 'text-green-400' : 'text-red-400'}`}>
            {isExcludedFees === undefined ? '⏳' : isExcludedFees ? '✅ Isento' : '❌ Não'}
          </div>
        </div>
        <div className={`rounded-xl p-3 text-center ${isAuthorized ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="text-xs text-beige/40 mb-1">Autorizada</div>
          <div className={`text-sm font-bold ${isAuthorized ? 'text-green-400' : 'text-red-400'}`}>
            {isAuthorized === undefined ? '⏳' : isAuthorized ? '✅ Sim' : '❌ Não'}
          </div>
        </div>
        <div className={`rounded-xl p-3 text-center ${isExcludedLimits ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="text-xs text-beige/40 mb-1">Sem Limites</div>
          <div className={`text-sm font-bold ${isExcludedLimits ? 'text-green-400' : 'text-red-400'}`}>
            {isExcludedLimits === undefined ? '⏳' : isExcludedLimits ? '✅ Isento' : '❌ Não'}
          </div>
        </div>
      </div>

      {/* Botão 1-clique */}
      {!allConfigured && (
        <button
          onClick={handleAllInOne}
          disabled={pending !== null}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-800 text-white font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {pending || '⚡ CONFIGURAR TUDO AUTOMÁTICO (3 transações)'}
        </button>
      )}

      {allConfigured && (
        <div className="text-center text-sm text-green-400 font-semibold py-2">
          ✅ Lottery configured correctly! All fees and limits are exempt.
        </div>
      )}

      {/* Manual fee exclusion */}
      <div className="mt-4 pt-4 border-t border-dark-border">
        <div className="text-xs text-beige/50 mb-2">Exclude another address from fees (optional):</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customAddr}
            onChange={(e) => setCustomAddr(e.target.value)}
            placeholder="0x... wallet or contract address"
            className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-xs font-mono focus:border-gold/50 outline-none"
          />
          <button
            onClick={handleExcludeCustom}
            disabled={pending !== null || !customAddr}
            className="px-4 py-2 rounded-lg bg-dark-elevated text-white font-bold text-xs hover:bg-dark-border disabled:opacity-50"
          >
            Excluir
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════
// Lottery Image Uploader — compresses in browser, stores data-URI on-chain
// ════════════════════════════════════════════════════

const IMG_MAX_BYTES = 96 * 1024; // 96KB contract limit (131072 chars ≈ 96KB binary)

async function compressImage(file: File): Promise<string> {
  // Load file
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  // Load image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  // Downscale loop: 640 → 512 → 420 → 320 px, JPEG quality 0.82 → lower
  const sizes = [640, 512, 420, 320];
  const qualities = [0.82, 0.75, 0.68, 0.6];
  for (let i = 0; i < sizes.length; i++) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, sizes[i] / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', qualities[i]);
    if (out.length <= IMG_MAX_BYTES) return out;
  }
  throw new Error('Imagem muito grande mesmo após compressão. Use uma imagem menor.');
}

function LotteryImageUploader({ lotteryType, label, currentImage, onSaved, writeContractAsync, pending, setPending }: {
  lotteryType: number;
  label: string;
  currentImage: string;
  onSaved: () => void;
  writeContractAsync: (config: any) => Promise<`0x${string}`>;
  pending: string | null;
  setPending: (v: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [compressed, setCompressed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = preview ?? (currentImage || null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Arquivo não é imagem'); return; }
    setBusy(true);
    try {
      const dataUri = await compressImage(file);
      setCompressed(dataUri);
      setPreview(dataUri);
      toast.success('Imagem pronta! Clique em SALVAR para enviar ao blockchain.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao comprimir imagem');
      setPreview(null);
      setCompressed(null);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!compressed) return;
    setPending(`Imagem ${label}`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setLotteryImage', args: [lotteryType, compressed], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success(`Imagem da ${label} salva no blockchain!`);
      setPreview(null);
      setCompressed(null);
      onSaved();
    } catch (e: any) { toast.error(e?.shortMessage || 'Falha ao salvar'); }
    finally { setPending(null); }
  };

  const handleClear = async () => {
    setPending(`Imagem ${label}`);
    try {
      const tx = await writeContractAsync({
        address: LOTTERY_ADDRESS as `0x${string}`, abi: LotteryABI,
        functionName: 'setLotteryImage', args: [lotteryType, ''], chainId: bsc.id,
      });
      await waitForTx(tx);
      toast.success(`Imagem da ${label} removida`);
      setPreview(null);
      setCompressed(null);
      onSaved();
    } catch (e: any) { toast.error(e?.shortMessage || 'Falha ao remover'); }
    finally { setPending(null); }
  };

  return (
    <div className="pt-2 border-t border-dark-border mt-2">
      <div className="text-xs text-beige/50 mb-2">Imagem da loteria (aparece no site):</div>
      <div className="flex gap-3 items-start">
        {/* Preview */}
        <div className="w-20 h-20 rounded-lg border border-dark-border bg-dark-elevated overflow-hidden flex items-center justify-center shrink-0">
          {shown ? (
            <img src={shown} alt={`${label} image`} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-beige/30" />
          )}
        </div>
        {/* Actions */}
        <div className="flex-1 flex flex-col gap-2">
          <label className={`px-3 py-2 rounded-lg bg-dark-elevated border border-dark-border text-white text-xs font-semibold hover:bg-dark-border cursor-pointer text-center flex items-center justify-center gap-1.5 ${busy || pending ? 'opacity-50 pointer-events-none' : ''}`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {busy ? 'Comprimindo...' : '📤 Escolher imagem'}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
          {compressed && (
            <button onClick={handleSave} disabled={pending !== null}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-gold to-gold-dark text-black font-bold text-xs hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {pending === `Imagem ${label}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              SALVAR NO BLOCKCHAIN
            </button>
          )}
          {currentImage && !compressed && (
            <button onClick={handleClear} disabled={pending !== null}
              className="px-3 py-2 rounded-lg bg-red-600/10 text-red-400 border border-red-500/30 text-xs font-semibold hover:bg-red-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Remover imagem
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
