'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { publicClient } from '@/components/web3/Web3Provider';
import {
  Wallet, TrendingUp, Lock, Unlock, Users, Award, Clock,
  ArrowRight, Loader2, AlertCircle, Coins, Gift, Zap, ExternalLink,
  ChevronRight, Copy, Check
} from 'lucide-react';
import {
  TOKEN_ADDRESS, STAKING_ADDRESS, USDT_ADDRESS,
  PresaleABI, StakingABI, TokenABI, STAKING_POOLS
} from '@/lib/contracts';
import { formatUnits, parseUnits } from 'viem';
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
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export default function DashboardPage() {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [copied, setCopied] = useState(false);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);

  const onCorrectChain = chainId === bscTestnet.id;

  // Read VYR balance
  const { data: vyrBalanceData } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'balanceOf', args: [address || '0x0'], chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  // Read USDT balance
  const { data: usdtBalanceData } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'], chainId: bscTestnet.id,
  }) as { data: bigint | undefined };

  // Read presale buyer info
  const { data: buyerInfo } = useReadContract({
    address: process.env.NEXT_PUBLIC_PRESALE_ADDRESS as `0x${string}`, abi: PresaleABI,
    functionName: 'getBuyerInfo', args: [address || '0x0'], chainId: bscTestnet.id,
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  // Read staking info
  const { data: stakeCountData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getUserStakeCount', args: [address || '0x0'], chainId: bscTestnet.id,
  });
  const stakeCount = stakeCountData ? Number(stakeCountData) : 0;

  // Read referral info
  const { data: referralData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getReferralInfo', args: [address || '0x0'], chainId: bscTestnet.id,
  }) as { data: readonly [`0x${string}`, bigint, bigint] | undefined };

  // Read pending earnings for each stake
  const [earningsMap, setEarningsMap] = useState<Record<number, { usdt: string; vyr: string }>>({});

  // Fetch earnings for all stakes
  useEffect(() => {
    if (!address || stakeCount === 0) return;
    let active = true;
    (async () => {
      const map: Record<number, { usdt: string; vyr: string }> = {};
      for (let i = 0; i < stakeCount; i++) {
        try {
          const res = await publicClient.readContract({
            address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
            functionName: 'getPendingEarnings', args: [address, BigInt(i)],
          }) as [bigint, bigint];
          map[i] = { usdt: formatUnits(res[0], 6), vyr: formatUnits(res[1], 18) };
        } catch { map[i] = { usdt: '0', vyr: '0' }; }
      }
      if (active) setEarningsMap(map);
    })();
    return () => { active = false; };
  }, [address, stakeCount]);

  // Handle withdraw
  const handleWithdraw = async (stakeIndex: number) => {
    if (!isConnected) return;
    setWithdrawing(stakeIndex);
    const toastId = toast.loading('Withdrawing stake...');
    try {
      await writeContractAsync({
        address: STAKING_ADDRESS, abi: StakingABI, functionName: 'withdraw',
        args: [BigInt(stakeIndex)], chainId: bscTestnet.id,
      });
      toast.success('Withdrawal successful! VYR tokens received. 🎉', { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Withdrawal failed', { id: toastId });
    } finally {
      setWithdrawing(null);
    }
  };

  const fmt = (val: string, decimals = 2) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
  };

  const fmtNum = (val: bigint | undefined, decimals: number, display: number) => {
    if (!val) return '0';
    return fmt(formatUnits(val, decimals), display);
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="relative min-h-screen pt-24 pb-20 flex items-center justify-center">
        <div className="absolute inset-0 bg-grid-pattern" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative text-center max-w-md mx-auto px-4">
          <Wallet className="h-16 w-16 text-gold mx-auto mb-6 float" />
          <h1 className="text-3xl font-bold text-white mb-3">Connect Your Wallet</h1>
          <p className="text-beige-muted mb-8">Connect your wallet to view your VyronX dashboard, stakes, earnings, and referral network.</p>
          <p className="text-sm text-beige-muted">← Click <span className="text-gold font-bold">"Connect Wallet"</span> in the header</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-12">
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white">My Dashboard</h1>
              <p className="text-beige-muted mt-1 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${onCorrectChain ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {address && `${address.slice(0, 6)}...${address.slice(-4)}`}
                {!onCorrectChain && <span className="text-red-400 ml-2">⚠ Switch to BSC Testnet</span>}
              </p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(address || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dark-border bg-dark-card text-beige hover:text-gold hover:border-gold/30 transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          </motion.div>
        </motion.div>

        {/* Balance Cards */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-gradient-to-b from-dark-card to-gold/5 p-6 glow-gold">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-5 w-5 text-gold" />
              <span className="text-xs text-beige-muted uppercase tracking-wider">VYR Balance</span>
            </div>
            <div className="text-2xl font-black text-gold-gradient">{fmtNum(vyrBalanceData, 18, 0)}</div>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5 text-gold" />
              <span className="text-xs text-beige-muted uppercase tracking-wider">USDT Balance</span>
            </div>
            <div className="text-2xl font-black text-white">{fmtNum(usdtBalanceData, 18, 2)}</div>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-gold" />
              <span className="text-xs text-beige-muted uppercase tracking-wider">Active Stakes</span>
            </div>
            <div className="text-2xl font-black text-white">{stakeCount}</div>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-gold" />
              <span className="text-xs text-beige-muted uppercase tracking-wider">Referrals</span>
            </div>
            <div className="text-2xl font-black text-white">{referralData ? String(referralData[1]) : '0'}</div>
          </motion.div>
        </motion.div>

        {/* Presale Purchases */}
        {buyerInfo && buyerInfo[0] > BigInt(0) && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-12">
            <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Gift className="h-5 w-5 text-gold" /> Presale Purchases
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-beige-muted">USDT Spent</div>
                  <div className="text-lg font-bold text-white">${fmtNum(buyerInfo[0], 6, 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-beige-muted">Tokens Bought</div>
                  <div className="text-lg font-bold text-gold">{fmtNum(buyerInfo[1], 18, 0)} VYR</div>
                </div>
                <div>
                  <div className="text-xs text-beige-muted">Total VYR</div>
                  <div className="text-lg font-bold text-green-400">{fmtNum(buyerInfo[2], 18, 0)} VYR</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stakes */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">My Stakes</h2>
            <Link href="/staking" className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
              New Stake <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {stakeCount === 0 ? (
            <div className="rounded-2xl border border-dark-border bg-dark-card p-12 text-center">
              <Lock className="h-12 w-12 text-beige-muted mx-auto mb-4" />
              <p className="text-beige-muted mb-4">You have no active stakes yet</p>
              <Link href="/staking" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all">
                Start Staking <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from({ length: stakeCount }).map((_, idx) => {
                const pool = STAKING_POOLS[idx % 4];
                const earnings = earningsMap[idx] || { usdt: '0', vyr: '0' };
                return (
                  <motion.div key={idx} variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-5 hover:border-gold/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/20">
                          <Lock className="h-6 w-6 text-gold" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{pool.tier}</span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gold/10 text-gold">{pool.duration}</span>
                          </div>
                          <div className="text-xs text-beige-muted mt-1">{pool.dailyRate}% daily</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-xs text-beige-muted">Pending</div>
                          <div className="text-sm font-bold text-green-400">{fmt(earnings.usdt)} USDT</div>
                          <div className="text-xs text-gold">≈ {fmt(earnings.vyr)} VYR</div>
                        </div>
                        <button
                          onClick={() => handleWithdraw(idx)}
                          disabled={withdrawing === idx}
                          className="px-4 py-2 text-sm font-bold rounded-lg border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {withdrawing === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                          Withdraw
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Referral & Affiliate */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-12">
          <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-dark-card via-dark to-green-moss-dark/20 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" /> Referral Network
            </h2>
            <p className="text-sm text-beige-muted mb-6">Invite investors to the 360-day pool and earn commissions + accelerate your withdrawals.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-dark-elevated border border-dark-border p-4">
                <div className="text-xs text-beige-muted">Direct Referrals</div>
                <div className="text-2xl font-black text-gold-gradient">{referralData ? String(referralData[1]) : '0'}</div>
              </div>
              <div className="rounded-xl bg-dark-elevated border border-dark-border p-4">
                <div className="text-xs text-beige-muted">Total Earnings</div>
                <div className="text-2xl font-black text-gold">{referralData ? fmtNum(referralData[2], 18, 2) : '0'} <span className="text-sm">USDT</span></div>
              </div>
              <div className="rounded-xl bg-dark-elevated border border-dark-border p-4">
                <div className="text-xs text-beige-muted">Your Referrer</div>
                <div className="text-sm font-mono text-beige mt-1">
                  {referralData && referralData[0] !== '0x0000000000000000000000000000000000000000'
                    ? `${referralData[0].slice(0, 6)}...${referralData[0].slice(-4)}`
                    : 'None set'}
                </div>
              </div>
            </div>

            {/* Referral link */}
            <div className="rounded-xl bg-dark-elevated border border-dark-border p-4">
              <div className="text-xs text-beige-muted mb-2">Your Referral Link</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-gold truncate">
                  {address ? `${typeof window !== 'undefined' ? window.location.origin : 'https://vyronx.io'}/staking?ref=${address}` : 'Connect wallet'}
                </code>
                <button
                  onClick={() => { if (address) { navigator.clipboard.writeText(`${window.location.origin}/staking?ref=${address}`); toast.success('Referral link copied!'); } }}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Coins, label: 'Buy VYR', href: '/presale', desc: 'Join presale' },
            { icon: Lock, label: 'Stake', href: '/staking', desc: 'Earn rewards' },
            { icon: TrendingUp, label: 'Whitepaper', href: '/whitepaper', desc: 'Read docs' },
            { icon: Zap, label: 'Roadmap', href: '/roadmap', desc: 'See plans' },
          ].map((action) => (
            <motion.div key={action.label} variants={fadeUp}>
              <Link href={action.href} className="block rounded-2xl border border-dark-border bg-dark-card p-5 hover:border-gold/30 hover:translate-y-[-2px] transition-all group">
                <action.icon className="h-8 w-8 text-gold mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-sm font-bold text-white">{action.label}</div>
                <div className="text-xs text-beige-muted">{action.desc}</div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
