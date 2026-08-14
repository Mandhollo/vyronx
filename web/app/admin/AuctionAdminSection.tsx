'use client';

import { useState, useId } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useSwitchChain } from 'wagmi';
import {
  Gavel, Loader2, Play, Power, DollarSign, Percent, Timer,
  Check, AlertCircle, Settings, Flame, Coins, Trophy, Ban, PauseCircle, Wallet, Image as ImageIcon, Upload,
} from 'lucide-react';
import { AUCTION_ADDRESS, AuctionABI, TOKEN_ADDRESS, TokenABI } from '@/lib/contracts';
import { formatUnits, parseUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } } };

// Auction struct (11 fields):
// [0]prizeUsdt [1]currentPrice [2]bidCount [3]lastBidder [4]winner [5]startTime
// [6]endTime [7]finalizeTime [8]finalPricePaid [9]prizeClaimed [10]status
type AuctionTuple = readonly [
  bigint, bigint, bigint, `0x${string}`, `0x${string}`, bigint,
  bigint, bigint, bigint, boolean, bigint
];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NOT_DEPLOYED = AUCTION_ADDRESS === ZERO_ADDRESS;

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

/// @notice Upload an image file to the VyronX image service (VPS) → returns public URL
const uploadImage = async (file: File): Promise<string> => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('https://arb.vyronx.io/auction-img/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.url as string;
};

export default function AuctionAdminSection({ writeContractAsync, pending, setPending }: Props) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const onCorrectChain = chainId === bsc.id;

  // ── Form state ──
  const [newPrize, setNewPrize] = useState('1000');
  const [newStartAt, setNewStartAt] = useState('');
  const [newDelay, setNewDelay] = useState('3600');
  const [newTitle, setNewTitle] = useState('');
  const [newImage, setNewImage] = useState('');
  const [fundAmount, setFundAmount] = useState('5000');
  const [bidPriceInput, setBidPriceInput] = useState('1');
  const [incInput, setIncInput] = useState('0.01');
  const [timerInputs, setTimerInputs] = useState<string[]>(['20', '15', '10', '7', '5', '3']);
  const [winLimitInput, setWinLimitInput] = useState('3');
  const [vyBonusInput, setVyBonusInput] = useState('10');
  const [burnShareInput, setBurnShareInput] = useState('100');
  const [splitInputs, setSplitInputs] = useState({ bb: '40', pool: '25', wl: '20', mlm: '15' });

  // ── Reads (config + stats) ──
  const cfg = (name: string) => useReadContract({ address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI, functionName: name, chainId: bsc.id, query: { enabled: !NOT_DEPLOYED  }}) as { data: any };

  const { data: bidPrice } = cfg('bidPrice');
  const { data: inc } = cfg('priceIncrement');
  const { data: timers } = useReadContract({ address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI, functionName: 'getTimerSeconds', chainId: bsc.id, query: { enabled: !NOT_DEPLOYED  }}) as { data: readonly [bigint, bigint, bigint, bigint, bigint, bigint] | undefined };
  const { data: winLimit } = cfg('weeklyWinLimit');
  const { data: vyBonus } = cfg('vyBonusBps');
  const { data: burnShare } = cfg('burnShareBps');
  const { data: bbBps } = cfg('buybackShareBps');
  const { data: poolBps } = cfg('prizePoolShareBps');
  const { data: wlBps } = cfg('walletShareBps');
  const { data: mlmBps } = cfg('mlmShareBps');
  const { data: availFunds } = cfg('availablePrizeFunds');
  const { data: lockedFunds } = cfg('lockedPrizeFunds');
  const { data: totalBids } = cfg('totalBidsPlaced');
  const { data: totalRevenue } = cfg('totalUsdtRevenue');
  const { data: totalBurned } = cfg('totalVyrBurned');
  const { data: isPaused } = useReadContract({ address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI, functionName: 'paused', chainId: bsc.id, query: { enabled: !NOT_DEPLOYED  }}) as { data: boolean | undefined };

  const { data: activeIds, refetch: refetchActive } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getActiveAuctionIds', chainId: bsc.id, query: { enabled: !NOT_DEPLOYED },
  }) as { data: readonly bigint[] | undefined; refetch: () => void };

  // first 4 active auction details (inline)
  const a0 = useAuctionDetail(activeIds?.[0]);
  const a1 = useAuctionDetail(activeIds?.[1]);
  const a2 = useAuctionDetail(activeIds?.[2]);
  const a3 = useAuctionDetail(activeIds?.[3]);
  const auctions = [a0, a1, a2, a3].filter(Boolean) as AuctionDetail[];

  const fmt = (val: bigint | undefined, display = 2) => val ? parseFloat(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: display }) : '0';

  const doTx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    if (!onCorrectChain) { await switchChainAsync?.({ chainId: bsc.id }); return; }
    setPending(label);
    try {
      const tx = await fn();
      await waitForTx(tx);
      toast.success(`${label} OK!`);
      return true;
    } catch (e: any) { toast.error(e?.shortMessage || 'Failed'); return false; }
    finally { setPending(null); }
  };

  // ── Handlers ──
  const handleOpen = async () => {
    if (parseFloat(newPrize) <= 0) return toast.error('Invalid prize');
    // datetime-local → unix timestamp (interpreted as local time)
    let startAt = Math.floor(Date.now() / 1000);
    if (newStartAt) {
      startAt = Math.floor(new Date(newStartAt).getTime() / 1000);
      if (isNaN(startAt)) return toast.error('Invalid date/time');
    }
    const opened = await doTx('Open Auction', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'openAuction', args: [parseUnits(newPrize, 18), BigInt(startAt), BigInt(newDelay)], chainId: bsc.id,
    }));
    // set metadata on the just-opened auction (highest id)
    if (opened && (newTitle || newImage)) {
      await doTx('Set Image/Title', () => writeContractAsync({
        address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
        functionName: 'setAuctionMeta', args: [nextIdRef.current, newTitle, newImage], chainId: bsc.id,
      }));
    }
    refetchActive();
  };

  // track next auction id for meta-setting right after open
  const nextIdRef = { current: 0 };
  const { data: nextId_ } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'nextAuctionId', chainId: bsc.id, query: { enabled: !NOT_DEPLOYED },
  }) as { data: bigint | undefined };
  nextIdRef.current = Number(nextId_ ?? 0) + 1;

  const handleSetMeta: (id: number, title: string, image: string) => Promise<boolean | void> = async (id, title, image) => {
    if (image && image.length > 256) { toast.error('URL too long (max 256)'); return; }
    await doTx(`Set Image/Title #${id}`, () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setAuctionMeta', args: [BigInt(id), title, image], chainId: bsc.id,
    }));
  };

  const handleFund = async () => {
    if (parseFloat(fundAmount) <= 0) return toast.error('Invalid amount');
    await doTx('Fund Prize Pool', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'fundPrizePool', args: [parseUnits(fundAmount, 18)], chainId: bsc.id,
    }));
  };

  const handleCancel = async (id: number) => {
    if (!confirm(`Cancel auction #${id}? Prize returns to pool.`)) return;
    await doTx('Cancel Auction', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'cancelAuction', args: [BigInt(id)], chainId: bsc.id,
    }));
    refetchActive();
  };

  const handleSetBidPrice = async () => {
    if (parseFloat(bidPriceInput) <= 0) return toast.error('Invalid');
    await doTx('Set Bid Price', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setBidPrice', args: [parseUnits(bidPriceInput, 18)], chainId: bsc.id,
    }));
  };

  const handleSetInc = async () => {
    await doTx('Set Increment', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setPriceIncrement', args: [parseUnits(incInput, 18)], chainId: bsc.id,
    }));
  };

  const handleSetTimers = async () => {
    const secs = timerInputs.map((s) => BigInt(Math.max(1, parseInt(s || '1'))));
    await doTx('Set Timer Tiers', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setTimerSeconds', args: [secs], chainId: bsc.id,
    }));
  };

  const handleSetWinLimit = async () => {
    await doTx('Set Win Limit', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setWeeklyWinLimit', args: [BigInt(winLimitInput)], chainId: bsc.id,
    }));
  };

  const handleSetVyBonus = async () => {
    await doTx('Set VYR Bonus', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setVyBonusBps', args: [BigInt(Math.round(parseFloat(vyBonusInput) * 100))], chainId: bsc.id,
    }));
  };

  const handleSetBurnShare = async () => {
    const pct = parseFloat(burnShareInput);
    if (isNaN(pct) || pct < 0 || pct > 100) return toast.error('0-100');
    await doTx('Set Burn %', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setBurnShareBps', args: [BigInt(Math.round(pct * 100))], chainId: bsc.id,
    }));
  };

  const handleSetSplit = async () => {
    const bb = Math.round(parseFloat(splitInputs.bb) * 100);
    const pool = Math.round(parseFloat(splitInputs.pool) * 100);
    const wl = Math.round(parseFloat(splitInputs.wl) * 100);
    const mlm = Math.round(parseFloat(splitInputs.mlm) * 100);
    if (bb + pool + wl + mlm !== 10000) return toast.error(`Total: ${(bb + pool + wl + mlm) / 100}% (must be 100%)`);
    await doTx('Set Splits', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setDistribution', args: [BigInt(bb), BigInt(pool), BigInt(wl), BigInt(mlm)], chainId: bsc.id,
    }));
  };

  const handlePause = async () => {
    await doTx(isPaused ? 'Resume' : 'Pause', () => writeContractAsync({
      address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
      functionName: 'setPaused', args: [!isPaused], chainId: bsc.id,
    }));
  };

  if (NOT_DEPLOYED) {
    return (
      <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-dark-card p-8 text-center">
        <Gavel className="w-10 h-10 text-gold mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Auction contract not deployed yet</h3>
        <p className="text-sm text-beige-muted">
          Contract code, tests (42/42) and ABI are ready. Deploy <span className="font-mono text-gold">VyronXAuction</span> to BSC mainnet
          and set <span className="font-mono">NEXT_PUBLIC_AUCTION_ADDRESS</span> to enable this panel.
        </p>
      </motion.div>
    );
  }

  const splitSum = Math.round(parseFloat(splitInputs.bb || '0') * 100) + Math.round(parseFloat(splitInputs.pool || '0') * 100)
    + Math.round(parseFloat(splitInputs.wl || '0') * 100) + Math.round(parseFloat(splitInputs.mlm || '0') * 100);

  return (
    <>
      {/* Overview bar */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-xs text-beige/40">Prize Pool (available)</div>
            <div className="text-lg font-bold text-gold">${fmt(availFunds, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-beige/40">Locked in Auctions</div>
            <div className="text-lg font-bold text-white">${fmt(lockedFunds, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-beige/40">Total Bids (all time)</div>
            <div className="text-lg font-bold text-white">{Number(totalBids ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-beige/40">VYR Burned 🔥</div>
            <div className="text-lg font-bold text-red-400">{fmt(totalBurned, 0)}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-dark-border text-xs text-beige/40">
          Revenue: ${fmt(totalRevenue, 2)} | Bid: ${fmt(bidPrice)} (+${fmt(inc)}/bid) | Win limit: {Number(winLimit ?? 0)}/week | VYR bonus: {Number(vyBonus ?? 0) / 100}%
        </div>
      </motion.div>

      {/* Open new auction */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/5 to-transparent p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-gold" /> Open New Auction
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-beige/50 mb-1">Prize value in USDT (= goal)</label>
            <input type="number" value={newPrize} onChange={(e) => setNewPrize(e.target.value)}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">📅 Data e hora do início (vazio = agora)</label>
            <input type="datetime-local" value={newStartAt} onChange={(e) => setNewStartAt(e.target.value)}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">Countdown inicial (segundos até 1ª expiração sem lances)</label>
            <input type="number" value={newDelay} onChange={(e) => setNewDelay(e.target.value)}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
        </div>
        <div className="mt-3">
          <button onClick={handleOpen} disabled={pending !== null}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-dark text-black font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {pending === 'Open Auction' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
            Open Auction
          </button>
        </div>
        {/* Image + title (illustrative) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-beige/50 mb-1">Imagem ilustrativa (upload do computador ou URL — máx 5MB)</label>
            <ImageUploader value={newImage} onChange={setNewImage} />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">Prize title (e.g. iPhone 17 Pro)</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="iPhone 17 Pro"
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-gold/50 outline-none" />
          </div>
        </div>
        <p className="text-xs text-beige/30 mt-2">Available pool: ${fmt(availFunds, 0)} — fund below if needed.</p>
      </motion.div>

      {/* Fund pool */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5 text-green-400" /> Fund Prize Pool (USDT)
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="number" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="USDT amount"
            className="flex-1 h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          <button onClick={handleFund} disabled={pending !== null}
            className="px-6 py-2.5 rounded-xl bg-green-600/20 text-green-400 border border-green-500/30 font-bold hover:bg-green-600/30 disabled:opacity-50">
            Fund
          </button>
        </div>
        <p className="text-xs text-beige/30 mt-2">Approves + transfers USDT into the contract to finance prizes.</p>
      </motion.div>

      {/* Active auctions */}
      {auctions.length > 0 && (
        <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-gold" /> Active Auctions ({auctions.length})
          </h3>
          <div className="space-y-3">
            {auctions.map((a) => {
              const expired = Math.floor(Date.now() / 1000) > Number(a.endTime);
              const progress = a.prize > BigInt(0) ? Math.min(100, Number((a.bidCount * BigInt(1e18) * BigInt(100)) / a.prize)) : 0;
              return (
                <div key={a.id} className="rounded-xl bg-dark-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white">#{a.id} — ${fmt(a.prize, 0)} prize</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${expired ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {expired ? 'EXPIRED — needs finalize' : 'LIVE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs mb-2">
                    <div><div className="text-beige/40">Price</div><div className="text-white font-bold font-mono">${fmt(a.price)}</div></div>
                    <div><div className="text-beige/40">Bids</div><div className="text-white font-bold">{Number(a.bidCount)}</div></div>
                    <div><div className="text-beige/40">Raised</div><div className="text-gold font-bold">${fmt(a.bidCount * BigInt(1e18), 0)}</div></div>
                    <div><div className="text-beige/40">Goal</div><div className="text-white font-bold">{progress.toFixed(0)}%</div></div>
                  </div>
                  <div className="h-1.5 rounded-full bg-dark-border overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark" style={{ width: `${progress}%` }} />
                  </div>
                  {!expired && (
                    <button onClick={() => handleCancel(a.id)} disabled={pending !== null || a.bidCount > BigInt(0)}
                      className="w-full px-3 py-2 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 text-sm font-bold hover:bg-red-600/30 disabled:opacity-50 flex items-center justify-center gap-1">
                      <Ban className="w-4 h-4" /> {a.bidCount > BigInt(0) ? 'Cancel only before first bid' : 'Cancel (prize returns to pool)'}
                    </button>
                  )}
                  <AuctionMetaEditor auctionId={a.id} onSave={handleSetMeta} pending={pending} />
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Bid economics config */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-gold" /> Bid Economics
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
            <label className="block text-xs text-gold mb-1">Bid price (currently ${fmt(bidPrice)})</label>
            <div className="flex gap-2">
              <input type="number" step="0.01" value={bidPriceInput} onChange={(e) => setBidPriceInput(e.target.value)}
                className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-gold/50 outline-none" />
              <button onClick={handleSetBidPrice} disabled={pending !== null}
                className="px-4 py-2 rounded-lg bg-dark-elevated text-white font-bold text-sm hover:bg-dark-border disabled:opacity-50">Set</button>
            </div>
            <p className="text-[10px] text-beige/30 mt-1">Range: $0.01 – $100</p>
          </div>
          <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
            <label className="block text-xs text-gold mb-1">Price increment per bid (currently ${fmt(inc)})</label>
            <div className="flex gap-2">
              <input type="number" step="0.001" value={incInput} onChange={(e) => setIncInput(e.target.value)}
                className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-gold/50 outline-none" />
              <button onClick={handleSetInc} disabled={pending !== null}
                className="px-4 py-2 rounded-lg bg-dark-elevated text-white font-bold text-sm hover:bg-dark-border disabled:opacity-50">Set</button>
            </div>
            <p className="text-[10px] text-beige/30 mt-1">Range: $0.001 – $0.10</p>
          </div>
        </div>
      </motion.div>

      {/* Dynamic timer config */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Timer className="w-5 h-5 text-gold" /> Dynamic Timer Tiers (seconds)
        </h3>
        <p className="text-xs text-beige/40 mb-4">Each tier activates when arrecadação reaches: 0% · 20% · 40% · 60% · 80% · 100% of the prize goal.</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {timerInputs.map((val, i) => (
            <div key={i} className="text-center">
              <div className="text-[10px] text-beige/40 mb-1">{['<20%', '≥20%', '≥40%', '≥60%', '≥80%', '≥100%'][i]}</div>
              <input type="number" value={val}
                onChange={(e) => setTimerInputs((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-2 text-center text-sm focus:border-gold/50 outline-none" />
              {timers && <div className="text-[10px] text-gold mt-1">now: {Number(timers[i])}s</div>}
            </div>
          ))}
        </div>
        <button onClick={handleSetTimers} disabled={pending !== null}
          className="px-6 py-2.5 rounded-xl bg-dark-elevated text-white font-bold hover:bg-dark-border disabled:opacity-50 flex items-center gap-2">
          {pending === 'Set Timer Tiers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Update Timer Tiers
        </button>
      </motion.div>

      {/* Revenue split config */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Percent className="w-5 h-5 text-gold" /> Revenue Split (%)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-beige/50 mb-1">Buyback 🔥 ({Number(bbBps ?? 0) / 100}%)</label>
            <input type="number" value={splitInputs.bb} onChange={(e) => setSplitInputs({ ...splitInputs, bb: e.target.value })}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">Prize Pool ({Number(poolBps ?? 0) / 100}%)</label>
            <input type="number" value={splitInputs.pool} onChange={(e) => setSplitInputs({ ...splitInputs, pool: e.target.value })}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">4 Wallets ({Number(wlBps ?? 0) / 100}%)</label>
            <input type="number" value={splitInputs.wl} onChange={(e) => setSplitInputs({ ...splitInputs, wl: e.target.value })}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-beige/50 mb-1">MLM ({Number(mlmBps ?? 0) / 100}%)</label>
            <input type="number" value={splitInputs.mlm} onChange={(e) => setSplitInputs({ ...splitInputs, mlm: e.target.value })}
              className="w-full h-10 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 focus:border-gold/50 outline-none" />
          </div>
        </div>
        <div className={`text-center rounded-lg px-3 py-2 text-sm font-bold mb-4 ${splitSum === 10000 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          Total: {splitSum / 100}% {splitSum !== 10000 && '(must be 100%)'}
        </div>
        <button onClick={handleSetSplit} disabled={pending !== null || splitSum !== 10000}
          className="px-6 py-2.5 rounded-xl bg-dark-elevated text-white font-bold hover:bg-dark-border disabled:opacity-50 flex items-center gap-2">
          {pending === 'Set Splits' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Update Split
        </button>
      </motion.div>

      {/* Anti-abuse + bonus config */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gold" /> Limits & Bonus
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
            <label className="block text-xs text-gold mb-1">Weekly win limit (currently {Number(winLimit ?? 0)}, 0 = unlimited)</label>
            <div className="flex gap-2">
              <input type="number" min="0" max="10" value={winLimitInput} onChange={(e) => setWinLimitInput(e.target.value)}
                className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-gold/50 outline-none" />
              <button onClick={handleSetWinLimit} disabled={pending !== null}
                className="px-4 py-2 rounded-lg bg-dark-elevated text-white font-bold text-sm hover:bg-dark-border disabled:opacity-50">Set</button>
            </div>
          </div>
          <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
            <label className="block text-xs text-gold mb-1">VYR→bids bonus % (currently {Number(vyBonus ?? 0) / 100}%)</label>
            <div className="flex gap-2">
              <input type="number" min="0" max="50" value={vyBonusInput} onChange={(e) => setVyBonusInput(e.target.value)}
                className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-gold/50 outline-none" />
              <button onClick={handleSetVyBonus} disabled={pending !== null}
                className="px-4 py-2 rounded-lg bg-dark-elevated text-white font-bold text-sm hover:bg-dark-border disabled:opacity-50">Set</button>
            </div>
          </div>
          <div className="rounded-xl bg-red-500/5 border border-red-500/25 p-4 sm:col-span-2">
            <label className="block text-xs text-red-300 mb-1">🔥 % de QUEIMA do VYR comprado no buyback + lances VYR (atual: {Number(burnShare ?? 10000) / 100}% — resto vai pro treasury)</label>
            <div className="flex gap-2">
              <input type="number" min="0" max="100" value={burnShareInput} onChange={(e) => setBurnShareInput(e.target.value)}
                className="flex-1 h-9 rounded-lg bg-dark-elevated border border-dark-border text-white px-3 text-sm focus:border-red-400/50 outline-none" />
              <button onClick={handleSetBurnShare} disabled={pending !== null}
                className="px-4 py-2 rounded-lg bg-red-600/20 text-red-300 border border-red-500/30 font-bold text-sm hover:bg-red-600/30 disabled:opacity-50">Set</button>
            </div>
            <p className="text-[10px] text-beige/30 mt-1">100% = tudo queimado (padrão). Ex: 50 = metade queimada, metade no treasury.</p>
          </div>
        </div>
      </motion.div>

      {/* Pause */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-gold" /> Emergency Pause
            </h3>
            <p className="text-xs text-beige/40 mt-1">Blocks new bids and bid-pack purchases. Active auctions keep their timers.</p>
          </div>
          <button onClick={handlePause} disabled={pending !== null}
            className={`px-6 py-2.5 rounded-xl font-bold disabled:opacity-50 ${isPaused
              ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
              : 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'}`}>
            {pending === 'Pause' || pending === 'Resume' ? '...' : isPaused ? 'RESUME' : 'PAUSE ALL'}
          </button>
        </div>
      </motion.div>

      {/* Fee exclusion (1-click, padrão loteria) */}
      <AuctionFeeExclusion writeContractAsync={writeContractAsync} pending={pending} setPending={setPending} />

      {/* Contract address */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card/60 p-4">
        <div className="flex items-center gap-2 text-xs text-beige/40">
          <Settings className="w-4 h-4" />
          <span className="font-mono break-all">{AUCTION_ADDRESS}</span>
        </div>
      </motion.div>
    </>
  );
}

// ── Sub-components ──

interface AuctionDetail {
  id: number; prize: bigint; price: bigint; bidCount: bigint;
  lastBidder: string; endTime: bigint; status: number;
}

/// @notice Inline image/title editor for each active auction (reads current on-chain meta)
function AuctionMetaEditor({ auctionId, onSave, pending }: {
  auctionId: number;
  onSave: (id: number, title: string, image: string) => Promise<boolean | void>;
  pending: string | null;
}) {
  const { data: meta } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getAuctionMeta', args: [BigInt(auctionId)], chainId: bsc.id,
  }) as { data: readonly [string, string] | undefined };

  const [title, setTitle] = useState('');
  const [image, setImage] = useState('');
  const [loaded, setLoaded] = useState(false);

  if (meta && !loaded) {
    setTitle(meta[0]);
    setImage(meta[1]);
    setLoaded(true);
  }

  return (
    <div className="mt-3 pt-3 border-t border-dark-border">
      <div className="text-xs text-beige/50 mb-2 flex items-center gap-1">
        <ImageIcon className="w-3.5 h-3.5 text-gold" /> Imagem ilustrativa + título (editável a qualquer momento)
      </div>
      <ImageUploader value={image} onChange={setImage} />
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do prêmio"
          className="flex-1 h-9 rounded-lg bg-dark border border-dark-border text-white px-3 text-xs focus:border-gold/50 outline-none" />
        <button onClick={() => onSave(auctionId, title, image)} disabled={pending !== null}
          className="px-4 py-2 rounded-lg bg-dark-elevated text-gold border border-gold/30 text-xs font-bold hover:bg-gold/10 disabled:opacity-50 flex items-center gap-1 justify-center">
          <Check className="w-3.5 h-3.5" /> Salvar
        </button>
      </div>
    </div>
  );
}

/// @notice File-upload picker (VPS image service) + manual URL fallback + preview
function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setUploading(true);
    const tid = toast.loading('Enviando imagem...');
    try {
      const url = await uploadImage(file);
      onChange(url);
      toast.success('Imagem enviada!', { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed', { id: tid });
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={inputId}
          className="flex-1 h-9 rounded-lg border border-dashed border-gold/40 bg-gold/5 text-gold text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-gold/10">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Enviando...' : 'Enviar imagem do computador'}
          <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])} disabled={uploading} />
        </label>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="ou cole uma URL https://..."
          className="flex-1 h-9 rounded-lg bg-dark border border-dark-border text-white px-3 text-xs font-mono focus:border-gold/50 outline-none" />
      </div>
      {value && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="h-14 w-24 object-cover rounded-lg border border-gold/30" />
          <span className="text-[10px] text-beige/30">Preview (aparece no card público)</span>
        </div>
      )}
    </div>
  );
}

function useAuctionDetail(id: bigint | undefined): AuctionDetail | null {
  const { data } = useReadContract({
    address: AUCTION_ADDRESS as `0x${string}`, abi: AuctionABI,
    functionName: 'getAuction', args: id !== undefined ? [id] : undefined,
    chainId: bsc.id, query: { enabled: !NOT_DEPLOYED && id !== undefined },
  }) as { data: AuctionTuple | undefined };
  if (id === undefined || !data) return null;
  return { id: Number(id), prize: data[0], price: data[1], bidCount: data[2], lastBidder: data[3], endTime: data[6], status: Number(data[10]) };
}

function AuctionFeeExclusion({ writeContractAsync, pending, setPending }: {
  writeContractAsync: (config: any) => Promise<`0x${string}`>;
  pending: string | null; setPending: (v: string | null) => void;
}) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const onCorrectChain = chainId === bsc.id;

  const { data: isExcludedFees } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI,
    functionName: 'isExcludedFromFees', args: [AUCTION_ADDRESS as `0x${string}`], chainId: bsc.id,
  }) as { data: boolean | undefined };

  const { data: isAuthorized } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI,
    functionName: 'isAuthorized', args: [AUCTION_ADDRESS as `0x${string}`], chainId: bsc.id,
  }) as { data: boolean | undefined };

  const { data: isExcludedLimits } = useReadContract({
    address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI,
    functionName: 'isExcludedFromLimits', args: [AUCTION_ADDRESS as `0x${string}`], chainId: bsc.id,
  }) as { data: boolean | undefined };

  const allConfigured = isExcludedFees && isAuthorized && isExcludedLimits;

  const handleAllInOne = async () => {
    if (!onCorrectChain) { await switchChainAsync?.({ chainId: bsc.id }); return; }
    setPending('Configurando Leilão (3 transações)...');
    try {
      const tx1 = await writeContractAsync({ address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI, functionName: 'setExcludedFromFees', args: [AUCTION_ADDRESS as `0x${string}`, true], chainId: bsc.id });
      await waitForTx(tx1);
      toast.success('1/3 — Taxas excluídas');
      const tx2 = await writeContractAsync({ address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI, functionName: 'setAuthorized', args: [AUCTION_ADDRESS as `0x${string}`, true], chainId: bsc.id });
      await waitForTx(tx2);
      toast.success('2/3 — Autorizado');
      const tx3 = await writeContractAsync({ address: TOKEN_ADDRESS as `0x${string}`, abi: TokenABI, functionName: 'setExcludedFromLimits', args: [AUCTION_ADDRESS as `0x${string}`, true], chainId: bsc.id });
      await waitForTx(tx3);
      toast.success('3/3 — Leilão configurado! ✅');
    } catch (e: any) {
      toast.error(e?.shortMessage || 'Failed');
    } finally { setPending(null); }
  };

  return (
    <motion.div variants={fadeUp} className={`rounded-2xl border p-6 ${allConfigured ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <AlertCircle className={`w-5 h-5 ${allConfigured ? 'text-green-400' : 'text-red-400'}`} />
        Configuração de Taxas do Token (Leilão)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className={`rounded-xl p-3 text-center ${isExcludedFees ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="text-xs text-beige/40 mb-1">Sem Taxa</div>
          <div className={`text-sm font-bold ${isExcludedFees ? 'text-green-400' : 'text-red-400'}`}>
            {isExcludedFees === undefined ? '⏳' : isExcludedFees ? '✅ Isento' : '❌ Não'}
          </div>
        </div>
        <div className={`rounded-xl p-3 text-center ${isAuthorized ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="text-xs text-beige/40 mb-1">Autorizado</div>
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
      {!allConfigured ? (
        <button onClick={handleAllInOne} disabled={pending !== null}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-800 text-white font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {pending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {pending || '⚡ CONFIGURAR TUDO AUTOMÁTICO (3 transações)'}
        </button>
      ) : (
        <div className="text-center text-sm text-green-400 font-semibold py-2">
          ✅ Auction configured correctly! All fees and limits are exempt.
        </div>
      )}
    </motion.div>
  );
}
