'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import {
  Settings, Lock, Coins, Users, TrendingUp, Power, Gauge,
  Loader2, DollarSign, Wallet, Banknote, Shield, Flame,
  Percent, Clock, Check, ExternalLink, AlertTriangle, ArrowRight
} from 'lucide-react';
import {
  TOKEN_ADDRESS, STAKING_ADDRESS, USDT_ADDRESS,
  PRESALE_ADDRESS, PresaleABI, StakingABI, TokenABI, STAKING_POOLS
} from '@/lib/contracts';
import { formatUnits } from 'viem';
import { bscTestnet } from 'wagmi/chains';
import toast from 'react-hot-toast';
import ParticleField from '@/components/fx/ParticleField';
import { isAdminWallet } from '@/lib/admin-wallets';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } } };
const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };

type TabId = 'overview' | 'token' | 'presale' | 'staking' | 'ownership';

export default function AdminPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [pending, setPending] = useState<string | null>(null);

  const onCorrectChain = chainId === bscTestnet.id;
  const isOwner = isAdminWallet(address);

  // === READS: TOKEN ===
  const { data: tradingEnabled } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'tradingEnabled', chainId: bscTestnet.id,
  }) as { data: boolean | undefined };

  const { data: buyFeeData } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'buyFee', chainId: bscTestnet.id,
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  const { data: maxWallet } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'maxWalletAmount', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  const { data: maxTx } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'maxTxAmount', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  // === READS: PRESALE ===
  const { data: presaleInfo } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'getPresaleInfo', chainId: bscTestnet.id,
  }) as { data: readonly [bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean] | undefined };

  const { data: distDue } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'isDistributionDue', chainId: bscTestnet.id,
  }) as { data: boolean | undefined };

  const { data: distTime } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'timeUntilNextDistribution', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  // === READS: STAKING ===
  const { data: vyrPrice } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'vyrPriceInUsdt', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  const { data: rewardPool } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'balanceOf', args: [STAKING_ADDRESS], chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  const { data: totalStaked } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'totalStakedUsdt', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  const { data: totalStakers } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'totalStakers', chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  // === READS: POOLS (individual reads) ===
  const { data: pool0 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(0)], chainId: bscTestnet.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const { data: pool1 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(1)], chainId: bscTestnet.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const { data: pool2 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(2)], chainId: bscTestnet.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const { data: pool3 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(3)], chainId: bscTestnet.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const allPools = [pool0, pool1, pool2, pool3];

  // === LOCAL STATE for forms ===
  const [buyRewards, setBuyRewards] = useState('4');
  const [buyLiq, setBuyLiq] = useState('2');
  const [buyBurn, setBuyBurn] = useState('2');
  const [priceInput, setPriceInput] = useState('');
  const [poolRates, setPoolRates] = useState<Record<number, string>>({});
  const [poolLocks, setPoolLocks] = useState<Record<number, string>>({});

  // === HELPERS ===
  const fmt = (val: bigint | undefined, decimals: number, display: number) => {
    if (!val) return '0';
    return parseFloat(formatUnits(val, decimals)).toLocaleString('en-US', { maximumFractionDigits: display });
  };

  const exec = async (name: string, fn: () => Promise<unknown>) => {
    setPending(name);
    const tid = toast.loading(`${name}...`);
    try { await fn(); toast.success(`${name} successful!`, { id: tid }); }
    catch (e) { toast.error(e instanceof Error ? e.message : `${name} failed`, { id: tid }); }
    finally { setPending(null); }
  };

  // === HANDLERS ===
  const handleSetBuyFees = () => exec('Update Buy Fees', () =>
    writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setBuyFees',
      args: [BigInt(buyRewards), BigInt(buyLiq), BigInt(buyBurn)], chainId: bscTestnet.id })
  );

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
    writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setPoolActive',
      args: [BigInt(poolId), active], chainId: bscTestnet.id })
  );

  const handleSetPoolConfig = (poolId: number) => exec(`Update Pool ${poolId}`, () => {
    const rate = BigInt(poolRates[poolId] || '0');
    const lock = BigInt(poolLocks[poolId] || '0');
    const pool = allPools[poolId];
    const active = pool ? pool[2] : true;
    const name = pool ? pool[3] : '';
    return writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setPoolConfig',
      args: [BigInt(poolId), rate, lock, active, name], chainId: bscTestnet.id });
  });

  const handleSetPrice = () => {
    if (!priceInput) return;
    const priceWei = BigInt(Math.floor(parseFloat(priceInput) * 1e6));
    exec('Update VYR Price', () =>
      writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setVyrPrice', args: [priceWei], chainId: bscTestnet.id })
    );
  };

  // === GATE ===
  if (!isConnected) return (
    <GateScreen icon={Lock} title="Admin Access" subtitle="Connect an authorized wallet to access the admin panel." />
  );
  if (!isOwner) return (
    <GateScreen icon={Shield} title="Access Denied" subtitle="This wallet is not authorized to view the admin panel." danger />
  );

  const TABS: { id: TabId; label: string; icon: typeof Shield }[] = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'token', label: 'Token & Fees', icon: Coins },
    { id: 'presale', label: 'Presale', icon: DollarSign },
    { id: 'staking', label: 'Staking Pools', icon: TrendingUp },
    { id: 'ownership', label: 'Ownership', icon: Shield },
  ];

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
      <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-8">
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
              <Settings className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">Admin Panel</h1>
              <p className="text-xs text-beige-muted flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${onCorrectChain ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                Owner: {address?.slice(0, 6)}...{address?.slice(-4)}
                {!onCorrectChain && <span className="text-red-400 ml-2">⚠ Switch to BSC Testnet</span>}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-gold/15 text-gold border border-gold/30' : 'text-beige hover:text-gold hover:bg-white/5 border border-transparent'
              }`}>
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════ OVERVIEW ════════════ */}
        {activeTab === 'overview' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8">
            {/* Global Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="USDT Raised" value={`$${fmt(presaleInfo?.[3], 6, 0)}`} gold />
              <StatCard icon={Coins} label="VYR Sold" value={fmt(presaleInfo?.[4], 18, 0)} />
              <StatCard icon={Users} label="Total Buyers" value={String(presaleInfo?.[5] || BigInt(0))} />
              <StatCard icon={Banknote} label="Reward Pool" value={`${fmt(rewardPool, 18, 0)} VYR`} />
            </div>

            {/* Staking Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={TrendingUp} label="Total Staked" value={`$${fmt(totalStaked, 6, 0)}`} />
              <StatCard icon={Users} label="Total Stakers" value={String(totalStakers || BigInt(0))} />
              <StatCard icon={Percent} label="VYR Price" value={`$${vyrPrice ? (Number(vyrPrice) / 1e6).toFixed(4) : '--'}`} />
              <StatCard icon={Clock} label="Next Dist." value={distTime ? `${Math.floor(Number(distTime) / 3600)}h ${Math.floor((Number(distTime) % 3600) / 60)}m` : 'Due!'} highlight={distDue === true} />
            </div>

            {/* System Status */}
            <div className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">System Status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatusPill label="Trading" active={tradingEnabled === true} />
                <StatusPill label="Presale" active={presaleInfo?.[6] === true} />
                <StatusPill label="Dist. Due" active={distDue === true} highlight={distDue === true} />
                <StatusPill label="Phase" text={String(Number(presaleInfo?.[0] || BigInt(0)) + 1)} />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <ActionBtn onClick={handleEnableTrading} disabled={tradingEnabled === true || pending === 'Enable Trading'} loading={pending === 'Enable Trading'}
                  icon={Power} label={tradingEnabled ? 'Trading Active' : 'Enable Trading'} variant="gold" />
                {distDue && (
                  <ActionBtn onClick={handleDistribute} disabled={pending === 'Distribute Funds'} loading={pending === 'Distribute Funds'}
                    icon={Banknote} label="Distribute Funds Now" variant="danger" />
                )}
              </div>
            </div>

            {/* Contract Addresses */}
            <div className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Contract Addresses</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AddrRow label="Token (VYR)" addr={TOKEN_ADDRESS} />
                <AddrRow label="Presale" addr={PRESALE_ADDRESS} />
                <AddrRow label="Staking" addr={STAKING_ADDRESS} />
                <AddrRow label="USDT (Mock)" addr={USDT_ADDRESS} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════ TOKEN & FEES ════════════ */}
        {activeTab === 'token' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8">
            {/* Current Fees Display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Buy Fees */}
              <motion.div variants={fadeUp} className="rounded-2xl border border-green-moss/30 bg-green-moss-dark/20 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-gold rotate-180" /> Buy Tax — Current: {buyFeeData ? Number(buyFeeData[0]) + Number(buyFeeData[1]) + Number(buyFeeData[2]) : 8}%
                </h3>
                <div className="space-y-3">
                  <FeeInput label="Rewards (Stakers)" value={buyRewards} onChange={setBuyRewards} current={buyFeeData?.[0]} />
                  <FeeInput label="Auto-Liquidity" value={buyLiq} onChange={setBuyLiq} current={buyFeeData?.[1]} />
                  <FeeInput label="Burn" value={buyBurn} onChange={setBuyBurn} current={buyFeeData?.[2]} />
                </div>
                <div className="mt-4 pt-4 border-t border-dark-border">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-beige-muted">Total Buy Tax</span>
                    <span className="text-xl font-black text-gold">{Number(buyRewards) + Number(buyLiq) + Number(buyBurn)}%</span>
                  </div>
                  <ActionBtn onClick={handleSetBuyFees} disabled={pending === 'Update Buy Fees'} loading={pending === 'Update Buy Fees'}
                    icon={Percent} label="Update Buy Fees" variant="gold" full />
                </div>
              </motion.div>
            </div>

            {/* Limits */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Token Limits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted">Max Wallet</div>
                  <div className="text-lg font-bold text-white">{fmt(maxWallet, 18, 0)} VYR</div>
                  <div className="text-xs text-beige-muted">{maxWallet ? ((Number(maxWallet) / 1e27) * 100).toFixed(1) : '0'}% of supply</div>
                </div>
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted">Max Transaction</div>
                  <div className="text-lg font-bold text-white">{fmt(maxTx, 18, 0)} VYR</div>
                  <div className="text-xs text-beige-muted">{maxTx ? ((Number(maxTx) / 1e27) * 100).toFixed(1) : '0'}% of supply</div>
                </div>
              </div>
            </motion.div>

            {/* Trading */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Trading Status</h3>
              <ActionBtn onClick={handleEnableTrading} disabled={tradingEnabled === true || pending === 'Enable Trading'} loading={pending === 'Enable Trading'}
                icon={Power} label={tradingEnabled ? 'Trading Active' : 'Enable Trading'} variant="gold" />
            </motion.div>

            {/* Sell Fees */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Sell Fees (BNB)</h3>
              <p className="text-xs text-beige-muted mb-3">4 wallets × 2% each = 8% total</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0,1,2,3].map((i) => (
                  <div key={i}>
                    <label className="text-xs text-beige-muted block mb-1">Wallet {i+1} %</label>
                    <input type="number" defaultValue="2" id={`sellFee${i}`}
                      className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                  </div>
                ))}
              </div>
              <button onClick={async () => {
                const fees = [0,1,2,3].map(i => BigInt(Number((document.getElementById(`sellFee${i}`) as HTMLInputElement).value) || 0));
                await exec('Set Sell Fees', async () => {
                  await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setSellFees', args: fees });
                });
              }} disabled={pending === 'Set Sell Fees'}
                className="mt-3 px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 flex items-center gap-2">
                {pending === 'Set Sell Fees' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Percent className="h-3.5 w-3.5" />}
                Apply Sell Fees
              </button>
            </motion.div>

            {/* Editable Limits */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Update Token Limits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Max Wallet (tokens, e.g. 20000000)</label>
                  <input type="number" id="maxWalletInput" placeholder="20000000"
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-2" />
                  <button onClick={async () => {
                    const val = BigInt((Number((document.getElementById('maxWalletInput') as HTMLInputElement).value) || 0) * 1e18);
                    if (val === BigInt(0)) return toast.error('Invalid amount');
                    await exec('Set Max Wallet', async () => {
                      await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setMaxWalletAmount', args: [val] });
                    });
                  }} disabled={pending === 'Set Max Wallet'}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50">Set Max Wallet</button>
                </div>
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Max Transaction (tokens, e.g. 10000000)</label>
                  <input type="number" id="maxTxInput" placeholder="10000000"
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-2" />
                  <button onClick={async () => {
                    const val = BigInt((Number((document.getElementById('maxTxInput') as HTMLInputElement).value) || 0) * 1e18);
                    if (val === BigInt(0)) return toast.error('Invalid amount');
                    await exec('Set Max TX', async () => {
                      await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setMaxTxAmount', args: [val] });
                    });
                  }} disabled={pending === 'Set Max TX'}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50">Set Max TX</button>
                </div>
              </div>
            </motion.div>

            {/* Emergency Recovery */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-red-500/20 bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Emergency Recovery</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={async () => {
                  if (!confirm('Withdraw all stuck BNB?')) return;
                  await exec('Withdraw BNB', async () => {
                    await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'withdrawStuckBNB', args: [address!] });
                  });
                }} disabled={pending === 'Withdraw BNB'}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50">
                  Withdraw Stuck BNB
                </button>
                <button onClick={async () => {
                  if (!confirm('Withdraw stuck tokens?')) return;
                  await exec('Withdraw Tokens', async () => {
                    await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'withdrawStuckTokens', args: [USDT_ADDRESS, address!] });
                  });
                }} disabled={pending === 'Withdraw Tokens'}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50">
                  Withdraw Stuck Tokens
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ════════════ PRESALE ════════════ */}
        {activeTab === 'presale' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Presale Status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <InfoBox label="Current Phase" value={`Phase ${String(Number(presaleInfo?.[0] || BigInt(0)) + 1)}`} />
                <InfoBox label="VYR Price" value={`$${presaleInfo ? (Number(presaleInfo[1]) / 1e6).toFixed(4) : '--'}`} />
                <InfoBox label="Status" value={presaleInfo?.[6] ? '🟢 Active' : '🔴 Paused'} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <InfoBox label="USDT Raised" value={`$${fmt(presaleInfo?.[3], 6, 0)}`} gold />
                <InfoBox label="VYR Sold" value={fmt(presaleInfo?.[4], 18, 0)} />
                <InfoBox label="Buyers" value={String(presaleInfo?.[5] || BigInt(0))} />
              </div>
              <div className="flex flex-wrap gap-3">
                <ActionBtn onClick={handleStartPresale} disabled={presaleInfo?.[6] === true || pending === 'Start Presale'} loading={pending === 'Start Presale'}
                  icon={Power} label={presaleInfo?.[6] ? 'Presale Active' : 'Start Presale'} variant="green" />
                <ActionBtn onClick={handlePausePresale} disabled={presaleInfo?.[6] !== true || pending === 'Pause Presale'} loading={pending === 'Pause Presale'}
                  icon={Lock} label="Pause Presale" variant="danger" />
                <ActionBtn onClick={handleDistribute} disabled={pending === 'Distribute Funds'} loading={pending === 'Distribute Funds'}
                  icon={Banknote} label="Force Distribution" variant="gold" />
              </div>
            </motion.div>

            {/* Distribution Info */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Presale Phases (30 days total)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoBox label="Phase 1" value="$0.01 • 15 days" gold />
                <InfoBox label="Phase 2" value="$0.02 • 15 days" />
                <InfoBox label="Launch" value="$0.03 • DEX" />
              </div>
              <div className="mt-4 rounded-xl bg-dark-elevated p-4">
                <div className="text-xs text-beige-muted mb-2">Distribution Breakdown</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="text-beige">Marketing: <span className="text-gold font-bold">10%</span></div>
                  <div className="text-beige">LP: <span className="text-gold font-bold">15%</span></div>
                  <div className="text-beige">Buyback: <span className="text-gold font-bold">15%</span></div>
                  <div className="text-beige">Tech: <span className="text-gold font-bold">20%</span></div>
                  <div className="text-beige">Dev (4×10%): <span className="text-gold font-bold">40%</span></div>
                </div>
              </div>
            </motion.div>

            {/* Presale Management */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-red-500/20 bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Presale Management</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Min Buy (USDT)</label>
                  <input type="number" id="minBuy" placeholder="10"
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-2" />
                  <button onClick={async () => {
                    const val = BigInt((Number((document.getElementById('minBuy') as HTMLInputElement).value) || 0) * 1e6);
                    if (val === BigInt(0)) return toast.error('Invalid amount');
                    await exec('Set Min Buy', async () => {
                      await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setMinBuy', args: [val] });
                    });
                  }} disabled={pending === 'Set Min Buy'}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50">Set Min</button>
                </div>
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Max Buy (USDT)</label>
                  <input type="number" id="maxBuy" placeholder="50000"
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-2" />
                  <button onClick={async () => {
                    const val = BigInt((Number((document.getElementById('maxBuy') as HTMLInputElement).value) || 0) * 1e6);
                    if (val === BigInt(0)) return toast.error('Invalid amount');
                    await exec('Set Max Buy', async () => {
                      await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setMaxBuy', args: [val] });
                    });
                  }} disabled={pending === 'Set Max Buy'}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50">Set Max</button>
                </div>
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Withdraw Unsold To</label>
                  <input type="text" id="unsoldTo" placeholder="0x..."
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-2" />
                  <button onClick={async () => {
                    const to = (document.getElementById('unsoldTo') as HTMLInputElement).value;
                    if (!to.startsWith('0x') || to.length !== 42) return toast.error('Invalid address');
                    await exec('Withdraw Unsold', async () => {
                      await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'withdrawUnsoldTokens', args: [to] });
                    });
                  }} disabled={pending === 'Withdraw Unsold'}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50">Withdraw</button>
                </div>
              </div>
              <div className="pt-4 border-t border-dark-border">
                <button onClick={async () => {
                  if (!confirm('Finalize presale? IRREVERSIBLE — distributes remaining USDT and locks presale!')) return;
                  await exec('Finalize Presale', async () => {
                    await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'finalizePresale' });
                  });
                }} disabled={pending === 'Finalize Presale'}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-2">
                  {pending === 'Finalize Presale' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Finalize Presale (IRREVERSIBLE)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ════════════ STAKING ════════════ */}
        {activeTab === 'staking' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            {/* VYR Price Control */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-gradient-to-b from-dark-card to-gold/5 p-6 glow-gold">
              <h3 className="text-lg font-bold text-white mb-4">Oracle Price (VYR/USDT)</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="rounded-xl bg-dark-elevated p-4 flex-1 w-full">
                  <div className="text-xs text-beige-muted">Current Price</div>
                  <div className="text-xl font-bold text-gold">${vyrPrice ? (Number(vyrPrice) / 1e6).toFixed(4) : '--'}</div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input type="number" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="1.00" step="0.01"
                    className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold/50" />
                  <ActionBtn onClick={handleSetPrice} disabled={!priceInput || pending === 'Update VYR Price'} loading={pending === 'Update VYR Price'}
                    icon={DollarSign} label="Set" variant="gold" />
                </div>
              </div>
              <p className="text-xs text-beige-muted mt-3">Price in USDT per 1 VYR. Used for stake→VYR conversion on withdrawal.</p>
            </motion.div>

            {/* Pool Controls */}
            {STAKING_POOLS.map((pool, idx) => {
              const chain = allPools[idx];
              const active = chain ? chain[2] : false;
              const currentRate = chain ? Number(chain[1]) : 0;
              const currentLock = chain ? Number(chain[0]) : 0;
              return (
                <motion.div key={pool.id} variants={fadeUp} className="rounded-2xl glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${active ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                        <TrendingUp className={`h-5 w-5 ${active ? 'text-green-400' : 'text-red-400'}`} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{chain ? chain[3] : pool.tier}</div>
                        <div className="text-xs text-beige-muted">
                          Rate: {(currentRate / 100).toFixed(2)}%/day • Lock: {currentLock} days • {active ? '🟢 Active' : '🔴 Closed'}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleTogglePool(pool.id, !active)}
                      disabled={pending === `${active ? 'Close' : 'Open'} Pool ${pool.id}`}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border disabled:opacity-50 ${
                        active ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
                               : 'bg-green-500/15 text-green-400 border-green-500/25 hover:bg-green-500/25'
                      }`}>
                      {pending === `${active ? 'Close' : 'Open'} Pool ${pool.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? 'Close' : 'Open'}
                    </button>
                  </div>
                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-beige-muted block mb-1">Daily Rate (bps, e.g., 11 = 0.11%)</label>
                      <input type="number" value={poolRates[pool.id] ?? String(currentRate)} onChange={(e) => setPoolRates({ ...poolRates, [pool.id]: e.target.value })}
                        className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                    </div>
                    <div>
                      <label className="text-xs text-beige-muted block mb-1">Lock Period (days)</label>
                      <input type="number" value={poolLocks[pool.id] ?? String(currentLock)} onChange={(e) => setPoolLocks({ ...poolLocks, [pool.id]: e.target.value })}
                        className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                    </div>
                  </div>
                  <button onClick={() => handleSetPoolConfig(pool.id)} disabled={pending === `Update Pool ${pool.id}`}
                    className="mt-3 px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 flex items-center gap-2">
                    {pending === `Update Pool ${pool.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                    Apply Changes
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ══ OWNERSHIP TAB ══ */}
        {activeTab === 'ownership' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-beige">
                <strong className="text-red-400">DANGER ZONE.</strong> Transferring ownership is irreversible. The new wallet will have full control of all contracts.
              </p>
            </div>

            {/* Transfer Ownership — 3 contracts */}
            <TransferOwnershipCard label="Token" addr={TOKEN_ADDRESS} abi={TokenABI} pending={pending} exec={exec} writeContractAsync={writeContractAsync} />
            <TransferOwnershipCard label="Presale" addr={PRESALE_ADDRESS} abi={PresaleABI} pending={pending} exec={exec} writeContractAsync={writeContractAsync} />
            <TransferOwnershipCard label="Staking" addr={STAKING_ADDRESS} abi={StakingABI} pending={pending} exec={exec} writeContractAsync={writeContractAsync} />

            {/* Staking Wallets */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Staking Wallets</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-beige-muted block mb-1">New Fee Wallet (10%)</label>
                  <input type="text" id="newFeeWallet" placeholder="0x..."
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-2" />
                  <button onClick={async () => {
                    const val = (document.getElementById('newFeeWallet') as HTMLInputElement).value;
                    if (!val.startsWith('0x') || val.length !== 42) return toast.error('Invalid address');
                    await exec('Set Fee Wallet', async () => {
                      await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setFeeWallet', args: [val] });
                    });
                  }} disabled={pending === 'Set Fee Wallet'}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50">Set Fee Wallet</button>
                </div>
                <div>
                  <label className="text-xs text-beige-muted block mb-1">New USDT Collector</label>
                  <input type="text" id="newCollector" placeholder="0x..."
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-2" />
                  <button onClick={async () => {
                    const val = (document.getElementById('newCollector') as HTMLInputElement).value;
                    if (!val.startsWith('0x') || val.length !== 42) return toast.error('Invalid address');
                    await exec('Set Collector', async () => {
                      await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setUsdtCollector', args: [val] });
                    });
                  }} disabled={pending === 'Set Collector'}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50">Set Collector</button>
                </div>
              </div>
            </motion.div>

            {/* Withdraw VYR from Staking */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Withdraw VYR from Staking</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="text" id="withdrawVyrTo" placeholder="Recipient 0x..."
                  className="bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                <input type="number" id="withdrawVyrAmount" placeholder="Amount (whole VYR)"
                  className="bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
              </div>
              <button onClick={async () => {
                const to = (document.getElementById('withdrawVyrTo') as HTMLInputElement).value;
                const amount = BigInt((Number((document.getElementById('withdrawVyrAmount') as HTMLInputElement).value) || 0) * 1e18);
                if (!to.startsWith('0x') || to.length !== 42 || amount === BigInt(0)) return toast.error('Invalid input');
                await exec('Withdraw VYR', async () => {
                  await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'withdrawVYRTokens', args: [to, amount] });
                });
              }} disabled={pending === 'Withdraw VYR'}
                className="mt-3 px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 flex items-center gap-2">
                {pending === 'Withdraw VYR' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                Withdraw VYR Tokens
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════
function GateScreen({ icon: Icon, title, subtitle, danger, extra }: { icon: typeof Lock; title: string; subtitle: string; danger?: boolean; extra?: string }) {
  return (
    <div className="relative min-h-screen pt-24 pb-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
      <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full ${danger ? 'bg-red-500/10' : 'bg-gold/10'} blur-[120px]`} />
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative text-center max-w-md mx-auto px-4">
        <Icon className={`h-16 w-16 mx-auto mb-6 float ${danger ? 'text-red-400' : 'text-gold'}`} />
        <h1 className="text-3xl font-bold text-white mb-3">{title}</h1>
        <p className="text-beige-muted mb-4">{subtitle}</p>
        {extra && <p className="text-xs text-beige-muted font-mono">{extra}</p>}
      </motion.div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, gold, highlight }: { icon: typeof Coins; label: string; value: string; gold?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${gold ? 'border-gold/30 bg-gradient-to-b from-dark-card to-gold/5 glow-gold' : highlight ? 'border-red-500/30 bg-red-500/5' : 'border-dark-border bg-dark-card'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 text-gold" />
        <span className="text-xs text-beige-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-black ${gold ? 'text-gold-gradient' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function StatusPill({ label, active, text, highlight }: { label: string; active?: boolean; text?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${
      highlight ? 'bg-red-500/10 border-red-500/30' : active ? 'bg-green-500/10 border-green-500/20' : 'bg-dark-elevated border-dark-border'
    }`}>
      <div className="text-xs text-beige-muted">{label}</div>
      <div className={`text-sm font-bold ${active ? 'text-green-400' : highlight ? 'text-red-400' : 'text-white'}`}>{text || (active ? 'Active' : 'Inactive')}</div>
    </div>
  );
}

function InfoBox({ label, value, gold, highlight }: { label: string; value: string; gold?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${gold ? 'bg-gold/5 border border-gold/20' : highlight ? 'bg-red-500/10 border border-red-500/20' : 'bg-dark-elevated'}`}>
      <div className="text-xs text-beige-muted">{label}</div>
      <div className={`text-lg font-bold ${gold ? 'text-gold' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function FeeInput({ label, value, onChange, current }: { label: string; value: string; onChange: (v: string) => void; current?: bigint }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1">
        <div className="text-sm text-beige">{label}</div>
        <div className="text-xs text-beige-muted">Current: {current ? Number(current) : 0}%</div>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} min="0" max="25"
          className="w-16 bg-dark-elevated border border-dark-border rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-gold/50" />
        <span className="text-sm text-beige-muted">%</span>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, disabled, loading, icon: Icon, label, variant = 'gold', full }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; icon: typeof Power; label: string; variant?: 'gold' | 'green' | 'danger'; full?: boolean;
}) {
  const styles = {
    gold: 'bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/30',
    green: 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${full ? 'w-full' : ''} px-4 py-2.5 text-sm font-bold rounded-lg ${styles[variant]} disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function AddrRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-dark-elevated p-3">
      <span className="text-sm text-beige-muted">{label}</span>
      <a href={`https://testnet.bscscan.com/address/${addr}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-gold hover:text-gold-light text-xs font-mono">
        {addr.slice(0, 10)}...{addr.slice(-6)} <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function TransferOwnershipCard({ label, addr, abi, pending, exec, writeContractAsync }: {
  label: string;
  addr: `0x${string}`;
  abi: readonly unknown[];
  pending: string | null;
  exec: (name: string, fn: () => Promise<unknown>) => Promise<void>;
  writeContractAsync: (config: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args: readonly unknown[]; }) => Promise<unknown>;
}) {
  const [newOwner, setNewOwner] = useState('');
  const fadeUpLocal = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } } };
  return (
    <motion.div variants={fadeUpLocal} initial="hidden" animate="visible" className="rounded-2xl border border-dark-border bg-dark-card p-6">
      <h3 className="text-lg font-bold text-white mb-1">{label} Contract</h3>
      <p className="text-xs text-beige-muted mb-4">{addr}</p>
      <label className="text-xs text-beige-muted block mb-1">New Owner Address</label>
      <input type="text" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="0x..."
        className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 mb-3" />
      <button onClick={async () => {
        if (!newOwner.startsWith('0x') || newOwner.length !== 42) return toast.error('Invalid address');
        if (!confirm(`Transfer ${label} ownership to ${newOwner}? IRREVERSIBLE!`)) return;
        await exec(`Transfer ${label}`, async () => {
          await writeContractAsync({ address: addr, abi, functionName: 'transferOwnership', args: [newOwner] });
        });
      }} disabled={pending === `Transfer ${label}`}
        className="px-4 py-2 text-xs font-bold rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-2">
        {pending === `Transfer ${label}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
        Transfer Ownership
      </button>
    </motion.div>
  );
}
