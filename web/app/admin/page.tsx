'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import {
  Shield, Lock, Coins, Users, TrendingUp, Flame, Settings,
  Loader2, AlertCircle, Check, ExternalLink, Power, Gauge,
  DollarSign, Wallet, ArrowRight, Banknote
} from 'lucide-react';
import {
  TOKEN_ADDRESS, STAKING_ADDRESS, USDT_ADDRESS,
  PRESALE_ADDRESS, PresaleABI, StakingABI, TokenABI, STAKING_POOLS
} from '@/lib/contracts';
import { formatUnits } from 'viem';
import { bscTestnet } from 'wagmi/chains';
import toast from 'react-hot-toast';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

// Owner wallet — must match deployer
const OWNER_ADDRESS = '0xd7A8484fD713D28870FCd4ad198fAB9e3ffDedB1';

type TabId = 'overview' | 'presale' | 'staking' | 'token';

export default function AdminPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [pending, setPending] = useState<string | null>(null);

  const onCorrectChain = chainId === bscTestnet.id;
  const isOwner = address === OWNER_ADDRESS;

  // === READS ===
  // Presale info
  const { data: presaleInfo } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'getPresaleInfo', chainId: bscTestnet.id,
  }) as { data: readonly [bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean] | undefined };

  // Token trading status
  const { data: tradingEnabled } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'tradingEnabled', chainId: bscTestnet.id,
  }) as { data: boolean | undefined };

  // Staking reward pool
  const { data: rewardPool } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'balanceOf', args: [STAKING_ADDRESS], chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  // Pool statuses
  const [poolStatuses, setPoolStatuses] = useState<Record<number, boolean>>({});
  const [poolRates, setPoolRates] = useState<Record<number, number>>({});

  // Fetch pool data
  useState(() => {
    const fetchPools = async () => {
      const statuses: Record<number, boolean> = {};
      const rates: Record<number, number> = {};
      for (let i = 0; i < 4; i++) {
        try {
          const res = await fetch(`https://data-seed-prebsc-1-s1.binance.org:8545`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: STAKING_ADDRESS, data: '' }, 'latest'], id: i })
          });
        } catch {}
      }
    };
    fetchPools();
  });

  // VYR price
  const { data: vyrPrice } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'vyrPriceInUsdt', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  // Distribution due
  const { data: distDue } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'isDistributionDue', chainId: bscTestnet.id,
  }) as { data: boolean | undefined };

  const { data: distTime } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'timeUntilNextDistribution', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  const fmt = (val: bigint | undefined, decimals: number, display: number) => {
    if (!val) return '0';
    const n = parseFloat(formatUnits(val, decimals));
    return n.toLocaleString('en-US', { maximumFractionDigits: display });
  };

  // === WRITE HELPERS ===
  const exec = async (name: string, fn: () => Promise<unknown>) => {
    setPending(name);
    const tid = toast.loading(`${name}...`);
    try {
      await fn();
      toast.success(`${name} successful!`, { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${name} failed`, { id: tid });
    } finally {
      setPending(null);
    }
  };

  const handleEnableTrading = () => exec('Enable Trading', () =>
    writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'enableTrading', chainId: bscTestnet.id })
  );

  const handleStartPresale = () => exec('Start Presale', () =>
    writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'startPresale', chainId: bscTestnet.id })
  );

  const handlePausePresale = () => exec('Pause Presale', () =>
    writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'pausePresale', chainId: bscTestnet.id })
  );

  const handleDistribute = () => exec('Distribute Funds', () =>
    writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'distributeFunds', chainId: bscTestnet.id })
  );

  const handleTogglePool = (poolId: number, active: boolean) => exec(`${active ? 'Open' : 'Close'} Pool ${poolId}`, () =>
    writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setPoolActive', args: [BigInt(poolId), active], chainId: bscTestnet.id })
  );

  const handleSetPrice = (newPrice: string) => {
    const priceWei = BigInt(Math.floor(parseFloat(newPrice) * 1e6));
    exec('Update VYR Price', () =>
      writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setVyrPrice', args: [priceWei], chainId: bscTestnet.id })
    );
  };

  const [priceInput, setPriceInput] = useState('');

  // === ACCESS GATE ===
  if (!isConnected) {
    return (
      <div className="relative min-h-screen pt-24 pb-20 flex items-center justify-center">
        <div className="absolute inset-0 bg-grid-pattern" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative text-center max-w-md mx-auto px-4">
          <Lock className="h-16 w-16 text-gold mx-auto mb-6 float" />
          <h1 className="text-3xl font-bold text-white mb-3">Admin Access</h1>
          <p className="text-beige-muted mb-4">Connect the owner wallet to access the admin panel.</p>
          <p className="text-xs text-beige-muted">← Click "Connect Wallet" in the header</p>
        </motion.div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="relative min-h-screen pt-24 pb-20 flex items-center justify-center">
        <div className="absolute inset-0 bg-grid-pattern" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-red-500/10 blur-[120px]" />
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative text-center max-w-md mx-auto px-4">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-3">Access Denied</h1>
          <p className="text-beige-muted">This wallet is not the contract owner.</p>
          <p className="text-xs text-beige-muted mt-2">Owner: {OWNER_ADDRESS.slice(0, 6)}...{OWNER_ADDRESS.slice(-4)}</p>
        </motion.div>
      </div>
    );
  }

  // === TABS ===
  const TABS: { id: TabId; label: string; icon: typeof Shield }[] = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'presale', label: 'Presale', icon: Coins },
    { id: 'staking', label: 'Staking', icon: TrendingUp },
    { id: 'token', label: 'Token', icon: Shield },
  ];

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-8">
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
              <Settings className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">Admin Panel</h1>
              <p className="text-xs text-beige-muted flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Owner: {address?.slice(0, 6)}...{address?.slice(-4)}
                {!onCorrectChain && <span className="text-red-400 ml-2">⚠ Switch to BSC Testnet</span>}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gold/15 text-gold border border-gold/30'
                  : 'text-beige hover:text-gold hover:bg-white/5 border border-transparent'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* === OVERVIEW === */}
        {activeTab === 'overview' && (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-gradient-to-b from-dark-card to-gold/5 p-5 glow-gold">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-gold" />
                  <span className="text-xs text-beige-muted uppercase">USDT Raised</span>
                </div>
                <div className="text-2xl font-black text-gold-gradient">${fmt(presaleInfo?.[3], 18, 0)}</div>
              </motion.div>
              <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-5 w-5 text-gold" />
                  <span className="text-xs text-beige-muted uppercase">VYR Sold</span>
                </div>
                <div className="text-2xl font-black text-white">{fmt(presaleInfo?.[4], 18, 0)}</div>
              </motion.div>
              <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-gold" />
                  <span className="text-xs text-beige-muted uppercase">Total Buyers</span>
                </div>
                <div className="text-2xl font-black text-white">{String(presaleInfo?.[5] || BigInt(0))}</div>
              </motion.div>
              <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="h-5 w-5 text-gold" />
                  <span className="text-xs text-beige-muted uppercase">Reward Pool</span>
                </div>
                <div className="text-2xl font-black text-white">{fmt(rewardPool, 18, 0)} <span className="text-sm text-beige-muted">VYR</span></div>
              </motion.div>
            </div>

            {/* Quick Status */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6 mb-8">
              <h3 className="text-lg font-bold text-white mb-4">System Status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatusCard label="Trading" active={tradingEnabled === true} />
                <StatusCard label="Presale" active={presaleInfo?.[6] === true} />
                <StatusCard label="Distribution Due" active={distDue === true} highlight={distDue === true} />
                <StatusCard label="Next Distribution" text={distTime ? `${Number(distTime) / 3600 | 0}h` : '--'} />
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleEnableTrading} disabled={pending === 'Enable Trading' || tradingEnabled === true}
                  className="px-4 py-2.5 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/30 disabled:opacity-40 flex items-center gap-2">
                  {pending === 'Enable Trading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  {tradingEnabled ? 'Trading Active' : 'Enable Trading'}
                </button>
                {distDue && (
                  <button onClick={handleDistribute} disabled={pending === 'Distribute Funds'}
                    className="px-4 py-2.5 text-sm font-bold rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 flex items-center gap-2">
                    {pending === 'Distribute Funds' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                    Distribute Funds Now
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* === PRESALE === */}
        {activeTab === 'presale' && (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Presale Control</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted">Current Phase</div>
                  <div className="text-xl font-bold text-gold">{String(Number(presaleInfo?.[0] || BigInt(0)) + 1)}</div>
                </div>
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted">Price / VYR</div>
                  <div className="text-xl font-bold text-white">${presaleInfo ? (Number(presaleInfo[1]) / 1e6 * 100).toFixed(2) : '--'}</div>
                </div>
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted">Bonus</div>
                  <div className="text-xl font-bold text-green-400">{presaleInfo ? Number(presaleInfo[2]) : 0}%</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleStartPresale} disabled={pending === 'Start Presale' || presaleInfo?.[6] === true}
                  className="px-4 py-2.5 text-sm font-bold rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-40 flex items-center gap-2">
                  {pending === 'Start Presale' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  {presaleInfo?.[6] ? 'Presale Active' : 'Start Presale'}
                </button>
                <button onClick={handlePausePresale} disabled={pending === 'Pause Presale' || presaleInfo?.[6] !== true}
                  className="px-4 py-2.5 text-sm font-bold rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 flex items-center gap-2">
                  {pending === 'Pause Presale' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Pause Presale
                </button>
                <button onClick={handleDistribute} disabled={pending === 'Distribute Funds'}
                  className="px-4 py-2.5 text-sm font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-40 flex items-center gap-2">
                  {pending === 'Distribute Funds' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  Force Distribution
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* === STAKING === */}
        {activeTab === 'staking' && (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            {/* VYR Price Control */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Oracle Price (VYR/USDT)</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="rounded-xl bg-dark-elevated p-4 flex-1">
                  <div className="text-xs text-beige-muted">Current Price</div>
                  <div className="text-xl font-bold text-gold">${vyrPrice ? (Number(vyrPrice) / 1e6).toFixed(4) : '--'}</div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="1.00" step="0.01"
                    className="w-28 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold/50"
                  />
                  <button onClick={() => handleSetPrice(priceInput)} disabled={!priceInput || pending === 'Update VYR Price'}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark disabled:opacity-40 flex items-center gap-2">
                    {pending === 'Update VYR Price' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Set
                  </button>
                </div>
              </div>
              <p className="text-xs text-beige-muted">Price in USDT per 1 VYR token. Used for stake → VYR conversion.</p>
            </motion.div>

            {/* Pool Controls */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Staking Pools</h3>
              <div className="space-y-3">
                {STAKING_POOLS.map((pool) => (
                  <div key={pool.id} className="flex items-center justify-between rounded-xl bg-dark-elevated p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gold/10 border border-gold/20">
                        <TrendingUp className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{pool.tier}</div>
                        <div className="text-xs text-beige-muted">{pool.duration} • {pool.dailyRate}%/day</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTogglePool(pool.id, false)}
                      disabled={pending === `Close Pool ${pool.id}`}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 disabled:opacity-40"
                    >
                      {pending === `Close Pool ${pool.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Close'}
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { for (let i = 0; i < 4; i++) handleTogglePool(i, true); }}
                className="mt-4 px-4 py-2 text-sm font-bold rounded-lg bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 flex items-center gap-2"
              >
                <Power className="h-4 w-4" /> Open All Pools
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* === TOKEN === */}
        {activeTab === 'token' && (
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Token Controls</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-dark-elevated p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Trading Status</div>
                    <div className="text-xs text-beige-muted">{tradingEnabled ? 'Trading is enabled' : 'Trading is locked'}</div>
                  </div>
                  <button onClick={handleEnableTrading} disabled={tradingEnabled === true || pending === 'Enable Trading'}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark disabled:opacity-40 flex items-center gap-2">
                    {pending === 'Enable Trading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    {tradingEnabled ? 'Active' : 'Enable'}
                  </button>
                </div>
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-sm font-bold text-white mb-2">Contract Addresses</div>
                  <div className="space-y-2 text-xs font-mono">
                    <AddrRow label="Token" addr={TOKEN_ADDRESS} />
                    <AddrRow label="Presale" addr={PRESALE_ADDRESS} />
                    <AddrRow label="Staking" addr={STAKING_ADDRESS} />
                    <AddrRow label="USDT" addr={USDT_ADDRESS} />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// === Sub-components ===
function StatusCard({ label, active, text, highlight }: { label: string; active?: boolean; text?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${
      highlight ? 'bg-red-500/10 border-red-500/30 pulse-glow'
                : active ? 'bg-green-500/10 border-green-500/20'
                : 'bg-dark-elevated border-dark-border'
    }`}>
      <div className="text-xs text-beige-muted">{label}</div>
      <div className={`text-lg font-bold ${active ? 'text-green-400' : highlight ? 'text-red-400' : 'text-white'}`}>
        {text || (active ? 'Active' : 'Inactive')}
      </div>
    </div>
  );
}

function AddrRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-beige-muted">{label}</span>
      <a href={`https://testnet.bscscan.com/address/${addr}`} target="_blank" rel="noreferrer"
        className="flex items-center gap-1 text-gold hover:text-gold-light">
        {addr.slice(0, 8)}...{addr.slice(-6)}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
