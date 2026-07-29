'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import {
  Lock, Unlock, TrendingUp, Wallet, Award,
  Zap, Users, ChevronDown, Info, ArrowRight, Clock, Loader2, AlertCircle
} from 'lucide-react';
import { STAKING_ADDRESS, USDT_ADDRESS, StakingABI } from '@/lib/contracts';
import { parseUnits, formatUnits } from 'viem';
import { bscTestnet } from 'wagmi/chains';
import toast from 'react-hot-toast';

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

const POOLS = [
  { id: 0, duration: '30 Days', daily: 0.11, monthly: '~3.5%', lock: 30, tier: 'Starter', color: 'from-slate-600 to-slate-800', minStake: 50 },
  { id: 1, duration: '60 Days', daily: 0.23, monthly: '~7%', lock: 60, tier: 'Growth', color: 'from-amber-500 to-amber-700', minStake: 50 },
  { id: 2, duration: '180 Days', daily: 0.33, monthly: '~10%', lock: 180, tier: 'Pro', color: 'from-orange-500 to-orange-700', minStake: 100 },
  { id: 3, duration: '360 Days', daily: 0.50, monthly: '~15%', lock: 360, tier: 'Elite', color: 'from-gold-light to-gold-dark', featured: true, features: ['Accelerator', '11-Level Affiliate Program'], minStake: 100 },
];

const AFFILIATE_LEVELS = [
  { level: 1, commission: '7%', stake: '$100', directs: '—' },
  { level: 2, commission: '6%', stake: '$200', directs: '2' },
  { level: 3, commission: '5%', stake: '$300', directs: '3' },
  { level: 4, commission: '4%', stake: '$400', directs: '4' },
  { level: 5, commission: '3%', stake: '$500', directs: '5' },
  { level: 6, commission: '2%', stake: '$600', directs: '6' },
  { level: 7, commission: '2%', stake: '$700', directs: '7' },
  { level: 8, commission: '2%', stake: '$800', directs: '8' },
  { level: 9, commission: '2%', stake: '$900', directs: '9' },
  { level: 10, commission: '2%', stake: '$1,000', directs: '10' },
  { level: 11, commission: '7%', stake: '$1,100', directs: '11' },
];

export default function StakingPage() {
  const { address, isConnected, chainId } = useAccount();
  const [activePool, setActivePool] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const onCorrectChain = chainId === bscTestnet.id;

  // Read USDT balance
  const { data: usdtBalanceData } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'], chainId: bscTestnet.id,
  });
  const usdtBalance = usdtBalanceData ?? BigInt(0);

  // Read USDT allowance for staking
  const { data: allowanceData } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [address || '0x0', STAKING_ADDRESS], chainId: bscTestnet.id,
  });
  const allowance = allowanceData ?? BigInt(0);

  // Read user stake count
  const { data: stakeCountData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getUserStakeCount', args: [address || '0x0'], chainId: bscTestnet.id,
  });
  const stakeCount = stakeCountData ? Number(stakeCountData) : 0;

  // Read referral info
  const { data: referralData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getReferralInfo', args: [address || '0x0'], chainId: bscTestnet.id,
  }) as { data: readonly [`0x${string}`, bigint, bigint] | undefined };

  const calculateEarnings = (amount: number, daily: number, days: number) => {
    return (amount * daily / 100 * days).toFixed(2);
  };

  const fmt = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const usdtAmountBigInt = stakeAmount ? parseUnits(stakeAmount, 6) : BigInt(0);
  const needsApproval = allowance < usdtAmountBigInt;
  const selectedPool = activePool !== null ? POOLS[activePool] : null;

  const handleApprove = async () => {
    if (!isConnected || !stakeAmount || activePool === null) return;
    setTxPending(true);
    const toastId = toast.loading('Approving USDT for staking...');
    try {
      await writeContractAsync({
        address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [STAKING_ADDRESS, parseUnits(stakeAmount, 6)], chainId: bscTestnet.id,
      });
      toast.success('USDT approved for staking!', { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed', { id: toastId });
    } finally { setTxPending(false); }
  };

  const handleStake = async () => {
    if (!isConnected || !stakeAmount || activePool === null) return;
    setTxPending(true);
    const toastId = toast.loading(`Staking ${stakeAmount} USDT in ${selectedPool?.tier} pool...`);
    try {
      await writeContractAsync({
        address: STAKING_ADDRESS, abi: StakingABI, functionName: 'stake', args: [BigInt(activePool), parseUnits(stakeAmount, 6)], chainId: bscTestnet.id,
      });
      toast.success(`Successfully staked ${stakeAmount} USDT! 🎉`, { id: toastId });
      setStakeAmount('');
      setActivePool(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stake failed', { id: toastId });
    } finally { setTxPending(false); }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <div className="absolute top-20 right-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="text-center mb-16">
          <motion.span variants={fadeUp} className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full bg-gold/5 mb-4">Staking Pools</motion.span>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-black text-white">Stake USDT, Earn <span className="text-gold-gradient">$VYR</span></motion.h1>
          <motion.p variants={fadeUp} className="mt-4 text-lg text-beige-muted max-w-2xl mx-auto">Four staking tiers with up to 15% monthly returns. Enter with USDT, receive VYR at market price via Chainlink oracle upon withdrawal.</motion.p>
        </motion.div>

        {/* Wrong network */}
        {isConnected && !onCorrectChain && (
          <div className="mb-8 mx-auto max-w-2xl rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-sm text-red-400 font-bold">Wrong network — switch to BSC Testnet to stake</span>
          </div>
        )}

        {/* User stats */}
        {isConnected && onCorrectChain && (
          <div className="mb-12 mx-auto max-w-3xl grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
              <div className="text-xl font-black text-gold-gradient">{formatUnits(usdtBalance, 18)}</div>
              <div className="text-xs text-beige-muted mt-1">Your USDT Balance</div>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
              <div className="text-xl font-black text-gold-gradient">{stakeCount}</div>
              <div className="text-xs text-beige-muted mt-1">Active Stakes</div>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
              <div className="text-xl font-black text-gold-gradient">{referralData ? String(referralData[1]) : '0'}</div>
              <div className="text-xs text-beige-muted mt-1">Direct Referrals</div>
            </div>
          </div>
        )}

        {/* Pools */}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {POOLS.map((pool) => (
            <motion.div key={pool.id} variants={fadeUp}
              className={`relative rounded-2xl border p-6 ${pool.featured ? 'border-gold/50 bg-gradient-to-b from-dark-card to-gold/5 glow-gold' : 'border-dark-border bg-dark-card hover:border-gold/30'} transition-all`}>
              {pool.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-gold-light to-gold-dark text-dark whitespace-nowrap">⭐ Best Rate</div>
              )}
              <div className="text-center">
                <div className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full bg-gradient-to-r ${pool.color} text-white mb-3`}>{pool.tier}</div>
                <div className="text-2xl font-bold text-white">{pool.duration}</div>
              </div>
              <div className="my-6 text-center">
                <div className="text-4xl font-black text-gold-gradient">{pool.monthly}</div>
                <div className="text-xs text-beige-muted mt-1">Monthly Return</div>
              </div>
              <div className="space-y-2 text-sm border-t border-dark-border pt-4">
                <div className="flex justify-between"><span className="text-beige-muted">Daily Rate</span><span className="text-beige font-medium">{pool.daily}%</span></div>
                <div className="flex justify-between"><span className="text-beige-muted">Lock Period</span><span className="text-beige font-medium">{pool.lock} days</span></div>
                <div className="flex justify-between"><span className="text-beige-muted">Min. Stake</span><span className="text-beige font-medium">${pool.minStake} USDT</span></div>
              </div>
              {pool.features && (
                <div className="mt-4 pt-4 border-t border-dark-border space-y-2">
                  {pool.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gold"><Award className="h-3.5 w-3.5" /> {f}</div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setActivePool(pool.id)}
                disabled={!isConnected || !onCorrectChain}
                className={`mt-6 w-full py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${pool.featured ? 'bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40' : 'border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10'}`}
              >
                {!isConnected ? 'Connect Wallet' : 'Stake Now'}
              </button>
            </motion.div>
          ))}
        </motion.div>

        {/* Stake Widget */}
        {activePool !== null && selectedPool && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl mb-16">
            <div className="rounded-3xl border border-gold/30 bg-dark-card p-8 glow-gold">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Stake in {selectedPool.tier} Pool</h3>
                  <p className="text-sm text-beige-muted">{selectedPool.duration} • {selectedPool.daily}% daily</p>
                </div>
                <button onClick={() => setActivePool(null)} className="text-beige-muted hover:text-white">✕</button>
              </div>

              <div className="mb-6">
                <label className="text-sm font-medium text-beige mb-2 block">Amount (USDT)</label>
                <div className="relative">
                  <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="0.00"
                    className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-4 text-2xl text-white placeholder:text-beige-muted/40 focus:outline-none focus:border-gold/50" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gold">USDT</span>
                </div>
              </div>

              {stakeAmount && (
                <div className="rounded-xl bg-dark-elevated border border-dark-border p-5 space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-beige-muted">Total Earnings at Maturity</span>
                    <span className="text-sm font-bold text-green-400">+${calculateEarnings(parseFloat(stakeAmount), selectedPool.daily, selectedPool.lock)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-beige-muted">Paid in VYR</span>
                    <span className="text-sm font-bold text-gold">Via Oracle at Withdrawal</span>
                  </div>
                  <div className="flex justify-between border-t border-dark-border pt-3">
                    <span className="text-sm font-bold text-white">Total Return</span>
                    <span className="text-lg font-black text-gold-gradient">${(parseFloat(stakeAmount) + parseFloat(calculateEarnings(parseFloat(stakeAmount), selectedPool.daily, selectedPool.lock))).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {needsApproval && stakeAmount ? (
                <button onClick={handleApprove} disabled={txPending}
                  className="w-full py-4 text-base font-bold rounded-xl border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {txPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                  {txPending ? 'Confirming...' : 'Approve USDT'}
                </button>
              ) : (
                <button onClick={handleStake} disabled={!stakeAmount || txPending}
                  className="w-full py-4 text-base font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  {txPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {txPending ? 'Processing...' : `Stake ${stakeAmount || ''} USDT`}
                </button>
              )}

              <p className="mt-4 text-xs text-beige-muted text-center flex items-center justify-center gap-1">
                <Info className="h-3 w-3" /> Earnings paid in VYR tokens at market price via Chainlink oracle
              </p>
            </div>
          </motion.div>
        )}

        {/* How It Works */}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { step: '01', icon: Wallet, title: 'Deposit USDT', desc: 'Choose a pool and deposit USDT' },
            { step: '02', icon: Lock, title: 'Stake & Earn', desc: 'Your rewards accrue daily' },
            { step: '03', icon: TrendingUp, title: 'Oracle Pricing', desc: 'Chainlink ensures fair conversion' },
            { step: '04', icon: Unlock, title: 'Withdraw as VYR', desc: 'Receive VYR tokens at market price' },
          ].map((item) => (
            <motion.div key={item.step} variants={fadeUp} className="relative rounded-2xl border border-dark-border bg-dark-card p-5">
              <div className="absolute top-3 right-3 text-xs font-black text-gold/30">{item.step}</div>
              <item.icon className="h-7 w-7 text-gold mb-3" />
              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-beige-muted">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Accelerator Section */}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16">
          <div className="rounded-3xl border border-gold/20 bg-gradient-to-br from-dark-card via-dark to-green-moss-dark/30 p-8 sm:p-12">
            <motion.div variants={fadeUp} className="text-center mb-8">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full bg-gold/5 mb-4">Exclusive: 360-Day Pool</span>
              <h2 className="text-3xl font-bold text-white">The Accelerator</h2>
              <p className="mt-3 text-beige-muted max-w-2xl mx-auto">Refer investors to the 360-day pool and accelerate your withdrawal. Each referral adds 10% of their deposit to your accelerator. Reach 100% to unlock early withdrawal.</p>
            </motion.div>

            <motion.div variants={fadeUp} className="mx-auto max-w-2xl">
              <div className="rounded-2xl bg-dark-elevated border border-dark-border p-6">
                <div className="text-sm font-bold text-gold mb-4">Example: You stake $100</div>
                <div className="space-y-3">
                  {[
                    { referral: 'Referral #1', deposit: '$200', accel: '$20 (10%)', total: '20%', barWidth: '20%' },
                    { referral: 'Referral #2', deposit: '$500', accel: '$50 (10%)', total: '70%', barWidth: '70%' },
                    { referral: 'Referral #3', deposit: '$300', accel: '$30 (10%)', total: '100% ✓', barWidth: '100%' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-20 text-xs text-beige-muted">{row.referral}</div>
                      <div className="w-20 text-sm text-beige">{row.deposit}</div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-beige-muted">{row.accel}</span>
                          <span className="text-xs font-bold text-gold">{row.total}</span>
                        </div>
                        <div className="h-2 rounded-full bg-dark-border overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark rounded-full" style={{ width: row.barWidth }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-dark-border text-center">
                  <span className="text-sm font-bold text-green-400">✓ Early withdrawal unlocked!</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Affiliate Program */}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16">
          <motion.div variants={fadeUp} className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white">11-Level Affiliate Program</h2>
            <p className="mt-3 text-beige-muted max-w-2xl mx-auto">Earn residual commissions on the <span className="text-gold font-bold">profit</span> of your network in the 360-day pool.</p>
          </motion.div>

          <motion.div variants={fadeUp} className="overflow-x-auto rounded-2xl border border-dark-border bg-dark-card">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gold">Level</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gold">Commission</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gold">Min. Stake</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gold">Direct Referrals</th>
                </tr>
              </thead>
              <tbody>
                {AFFILIATE_LEVELS.map((level) => (
                  <tr key={level.level} className="border-b border-dark-border/50 hover:bg-gold/5 transition-colors">
                    <td className="px-6 py-3 text-sm font-bold text-white">Level {level.level}</td>
                    <td className="px-6 py-3 text-sm font-bold text-gold">{level.commission}</td>
                    <td className="px-6 py-3 text-sm text-beige">{level.stake}</td>
                    <td className="px-6 py-3 text-sm text-beige">{level.directs} × $100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </motion.div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/presale" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all">
            Buy $VYR First <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
