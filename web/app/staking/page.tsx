'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import {
  Lock, Unlock, TrendingUp, Wallet, Award,
  Zap, Users, ChevronDown, Info, ArrowRight, Clock, Loader2, AlertCircle, Check, Gift, Copy
} from 'lucide-react';
import { STAKING_ADDRESS, USDT_ADDRESS, StakingABI, PRESALE_REFERRAL_ADDRESS, ReferralABI } from '@/lib/contracts';
import ContractAddress from '@/components/web3/ContractAddress';
import MyStakes from '@/components/staking/MyStakes';
import { triggerCoinConfetti } from '@/components/effects/CoinConfetti';
import { useI18n } from '@/lib/i18n';
import { publicClient } from '@/components/web3/Web3Provider';
import { decodeReferralCode, isReferralCode } from '@/lib/referral-code';
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

const POOLS = [
  { id: 0, duration: '30 Days', daily: 0.11, monthly: '~3.5%', lock: 30, tier: 'Starter', color: 'from-slate-600 to-slate-800', minStake: 50, maxStake: 100, badge: '/badge-starter.png' },
  { id: 1, duration: '60 Days', daily: 0.23, monthly: '~7%', lock: 60, tier: 'Growth', color: 'from-amber-500 to-amber-700', minStake: 50, maxStake: 250, badge: '/badge-growth.png' },
  { id: 2, duration: '180 Days', daily: 0.33, monthly: '~10%', lock: 180, tier: 'Pro', color: 'from-orange-500 to-orange-700', minStake: 50, maxStake: 500, badge: '/badge-pro.png' },
  { id: 3, duration: '360 Days', daily: 0.50, monthly: '~15%', lock: 360, tier: 'Elite', color: 'from-gold-light to-gold-dark', featured: true, features: ['Accelerator', '11-Level Affiliate Program'], minStake: 100, maxStake: 0, badge: '/badge-elite.png' },
];

const AFFILIATE_LEVELS = [
  { level: 1, commission: '7%', stake: '$100', directs: '1' },
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
  return (
    <Suspense fallback={<div className="min-h-screen pt-24 flex items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-gold/20 border-t-gold" /></div>}>
      <StakingPageContent />
    </Suspense>
  );
}

function StakingPageContent() {
  const { t } = useI18n();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [activePool, setActivePool] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const onCorrectChain = chainId === bsc.id;

  // Read USDT balance
  const { data: usdtBalanceData } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'], chainId: bsc.id,
  });
  const usdtBalance = usdtBalanceData ?? BigInt(0);

  // Read USDT allowance for staking
  const { data: allowanceData } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [address || '0x0', STAKING_ADDRESS], chainId: bsc.id,
  });
  const allowance = allowanceData ?? BigInt(0);

  // Read user stake count
  const { data: stakeCountData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getUserStakeCount', args: [address || '0x0'], chainId: bsc.id,
  });
  const stakeCount = stakeCountData ? Number(stakeCountData) : 0;

  // Read referral info
  const { data: referralData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getReferralInfo', args: [address || '0x0'], chainId: bsc.id,
  }) as { data: readonly [`0x${string}`, bigint, bigint] | undefined };

  // Read pool active status (0-3)
  // Struct order: lockPeriodDays(0), dailyRateBps(1), active(2), tierName(3)
  const { data: pool0Data } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(0)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const { data: pool1Data } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(1)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const { data: pool2Data } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(2)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const { data: pool3Data } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(3)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string] | undefined };
  const poolActiveMap: Record<number, boolean> = {
    0: pool0Data?.[2] ?? false,
    1: pool1Data?.[2] ?? false,
    2: pool2Data?.[2] ?? false,
    3: pool3Data?.[2] ?? false,
  };

  const calculateEarnings = (amount: number, daily: number, days: number) => {
    return (amount * daily / 100 * days).toFixed(2);
  };

  const fmt = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const usdtAmountBigInt = stakeAmount ? parseUnits(stakeAmount, 18) : BigInt(0);
  const needsApproval = allowance < usdtAmountBigInt;
  const selectedPool = activePool !== null ? POOLS[activePool] : null;

  // Auto-register referrer from URL ?ref=CODE or ?ref=0x...
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isConnected || !address) return;
    const rawRef = searchParams.get('ref')
      // Fallback: globally captured ref (first-touch, saved by RefCapture on any page)
      || (() => { try { const s = localStorage.getItem('vyronx-ref'); return s ? (JSON.parse(s) as { ref: string }).ref : null; } catch { return null; } })();
    if (!rawRef) return;

    // Decode referral code: VYR... → 0x address, or accept raw 0x address (backward compat)
    let refAddress: string | null = null;
    if (isReferralCode(rawRef)) {
      refAddress = decodeReferralCode(rawRef);
    } else if (rawRef.match(/^0x[a-fA-F0-9]{40}$/)) {
      refAddress = rawRef; // backward compatibility with old format
    }

    if (!refAddress || refAddress.toLowerCase() === address?.toLowerCase()) return;

    (async () => {
      try {
        // Wait a bit to ensure wallet is fully connected
        await new Promise(r => setTimeout(r, 1500));

        // Check if referrer already set
        const existingRef = await publicClient.readContract({
          address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
          functionName: 'referrer', args: [address as `0x${string}`],
        }) as `0x${string}`;

        if (existingRef === '0x0000000000000000000000000000000000000000') {
          // Switch chain first if needed
          if (chainId !== bsc.id) {
            try { await switchChainAsync({ chainId: bsc.id }); } catch {}
          }
          toast.promise(
            writeContractAsync({
              address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
              functionName: 'setReferrer', args: [refAddress as `0x${string}`],
            }),
            { loading: 'Registering referrer...', success: 'Referrer registered! 🎉', error: 'Failed to register referrer' }
          );
        }
      } catch {
        // Silent fail — user can manually retry
      }
    })();
  }, [isConnected, address, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // MIRROR FALLBACK (same ref for staking & presale): no ?ref= in URL and
  // nothing saved locally → adopt the referrer already registered in the
  // PresaleReferral wrapper, so presale buyers who later stake without a link
  // still join the same referral tree.
  useEffect(() => {
    if (!isConnected || !address) return;
    const hasRef =
      searchParams.get('ref')
      || (() => { try { const s = localStorage.getItem('vyronx-ref'); return s ? (JSON.parse(s) as { ref: string }).ref : null; } catch { return null; } })();
    if (hasRef) return;

    (async () => {
      try {
        const existingStakingRef = await publicClient.readContract({
          address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
          functionName: 'referrer', args: [address as `0x${string}`],
        }) as `0x${string}`;
        if (existingStakingRef !== '0x0000000000000000000000000000000000000000') return;

        const presaleInfo = await publicClient.readContract({
          address: PRESALE_REFERRAL_ADDRESS as `0x${string}`, abi: ReferralABI,
          functionName: 'getReferralInfo', args: [address as `0x${string}`],
        }) as readonly [`0x${string}`, bigint];
        const presaleRef = presaleInfo?.[0];
        if (!presaleRef || presaleRef === '0x0000000000000000000000000000000000000000') return;
        if (presaleRef.toLowerCase() === address.toLowerCase()) return;

        await new Promise(r => setTimeout(r, 1500));
        if (chainId !== bsc.id) {
          try { await switchChainAsync({ chainId: bsc.id }); } catch {}
        }
        toast.promise(
          writeContractAsync({
            address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
            functionName: 'setReferrer', args: [presaleRef],
          }),
          { loading: 'Registering referrer...', success: 'Referrer registered! 🎉', error: 'Failed to register referrer' }
        );
      } catch {
        // Silent fail — user can manually retry
      }
    })();
  }, [isConnected, address, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async () => {
    if (!isConnected || !stakeAmount || activePool === null) return;
    setTxPending(true);
    const toastId = toast.loading('Approving USDT for staking...');
    try {
      if (chainId !== bsc.id) { toast.loading('Switching to BSC Mainnet...', { id: toastId }); await switchChainAsync({ chainId: bsc.id }); toast.loading('Approving USDT for staking...', { id: toastId }); }
      await writeContractAsync({ address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [STAKING_ADDRESS, parseUnits(stakeAmount, 18)] });
      toast.success('USDT approved for staking!', { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed', { id: toastId });
    } finally { setTxPending(false); }
  };

  const handleStake = async () => {
    if (!isConnected || !stakeAmount || activePool === null) return;
    // V5 per-pool limits (frontend validation; contract enforces too)
    const amt = parseFloat(stakeAmount);
    if (selectedPool && amt < selectedPool.minStake) { toast.error(`Minimum for ${selectedPool.tier} is $${selectedPool.minStake} USDT`); return; }
    if (selectedPool && selectedPool.maxStake > 0 && amt > selectedPool.maxStake) { toast.error(`Maximum for ${selectedPool.tier} is $${selectedPool.maxStake} USDT`); return; }
    setTxPending(true);
    const toastId = toast.loading(`Staking ${stakeAmount} USDT in ${selectedPool?.tier} pool...`);
    try {
      if (chainId !== bsc.id) { toast.loading('Switching to BSC Mainnet...', { id: toastId }); await switchChainAsync({ chainId: bsc.id }); toast.loading(`Staking ${stakeAmount} USDT in ${selectedPool?.tier} pool...`, { id: toastId }); }
      await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'stake', args: [BigInt(activePool), parseUnits(stakeAmount, 18)] });
      toast.success(`Successfully staked ${stakeAmount} USDT! 🎉`, { id: toastId });
      setTimeout(() => triggerCoinConfetti(), 1500);
      setStakeAmount('');
      setActivePool(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stake failed', { id: toastId });
    } finally { setTxPending(false); }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
      <div className="absolute top-20 right-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="text-center mb-16">
          <motion.span variants={fadeUp} className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full bg-gold/5 mb-4 neon-pulse">{t('staking.title')}</motion.span>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-black text-white">{t('staking.title2').replace(/ ?VYR$/i, '').trim()} <span className="text-gold-gradient">$VYR</span></motion.h1>
          <motion.p variants={fadeUp} className="mt-4 text-lg text-beige-muted max-w-2xl mx-auto">{t('staking.heroDesc')}</motion.p>

          {/* V2 Info Banner */}
          <motion.div variants={fadeUp} className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 text-center">
              <div className="text-sm font-bold text-green-400">Daily Withdrawals</div>
              <div className="text-xs text-beige-muted mt-1">Claim earnings anytime in VYR (min $10)</div>
            </div>
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-center">
              <div className="text-sm font-bold text-gold">4% Withdrawal Fee</div>
              <div className="text-xs text-beige-muted mt-1">Only 4% on rewards &amp; principal</div>
            </div>
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 text-center">
              <div className="text-sm font-bold text-purple-400">12h Grace Period</div>
              <div className="text-xs text-beige-muted mt-1">Pool 360 accelerator gives you 12h to re-stake</div>
            </div>
          </motion.div>
          {!poolActiveMap[0] && (
            <motion.div variants={fadeUp} className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Coming Soon</span>
            </motion.div>
          )}
        </motion.div>

        {/* Staking Banner Image */}
        <motion.div variants={fadeUp} className="mb-16 relative rounded-2xl overflow-hidden border border-gold/20">
          <img src="/staking-banner.jpg" alt="VyronX Staking — Secure your VYR" className="w-full h-auto" />
        </motion.div>

        {/* Wrong network */}
        {isConnected && chainId && chainId !== bsc.id && (
          <div className="mb-8 mx-auto max-w-2xl rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-sm text-red-400 font-bold">{t('staking.wrongNetwork')}</span>
          </div>
        )}

        {/* User stats */}
        {isConnected && onCorrectChain && (
          <div className="mb-12 mx-auto max-w-3xl grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
              <div className="text-xl font-black text-gold-gradient">{formatUnits(usdtBalance, 18)}</div>
              <div className="text-xs text-beige-muted mt-1">{t('presale.usdtBal')}</div>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
              <div className="text-xl font-black text-gold-gradient">{stakeCount}</div>
              <div className="text-xs text-beige-muted mt-1">{t('staking.active')}</div>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
              <div className="text-xl font-black text-gold-gradient">{referralData ? String(referralData[1]) : '0'}</div>
              <div className="text-xs text-beige-muted mt-1">{t('staking.referrals')}</div>
            </div>
          </div>
        )}

        {/* Pools */}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16 mt-4">
          {POOLS.map((pool) => (
            <motion.div key={pool.id} variants={fadeUp}
              className={`relative overflow-visible rounded-3xl border ${pool.featured ? 'border-gold/50 bg-gradient-to-b from-dark-card to-gold/5 glow-gold' : 'border-dark-border bg-dark-card hover:border-gold/30'} transition-all`}>
              {/* "Best Rate" badge above card for Elite */}
              {pool.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1 text-xs font-black uppercase tracking-wider rounded-full bg-gradient-to-r from-gold-light to-gold-dark text-dark shadow-lg whitespace-nowrap pulse-scale">
                  {t('staking.bestRate')}
                </div>
              )}
              {/* Badge image — large hero */}
              <div className="flex justify-center pt-10 pb-3">
                <img src={pool.badge} alt={`${pool.tier} badge`} width={144} height={144} className={`rounded-full ${pool.featured ? 'drop-shadow-[0_0_28px_rgba(212,175,55,0.7)]' : 'drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]'}`} />
              </div>
              {/* Duration only (tier name removed — badge speaks for itself) */}
              <div className="text-center px-6">
                <div className="text-xl font-bold text-white">{pool.duration}</div>
              </div>
              {/* Return */}
              <div className="text-center my-4">
                <div className={`text-4xl font-black ${pool.featured ? 'shimmer-text' : 'text-gold'}`}>{pool.monthly}</div>
                <div className="text-xs text-beige-muted mt-1">{t('pool.monthly')}</div>
              </div>
              {/* Details */}
              <div className="space-y-2 text-sm border-t border-dark-border pt-4 mx-6 mb-4">
                <div className="flex justify-between"><span className="text-beige-muted">{t('pool.daily')}</span><span className="text-beige font-medium">{pool.daily}%</span></div>
                <div className="flex justify-between"><span className="text-beige-muted">{t('pool.lock')}</span><span className="text-beige font-medium">{pool.lock} {t('pool.days')}</span></div>
                <div className="flex justify-between"><span className="text-beige-muted">{t('staking.min')}</span><span className="text-beige font-medium">${pool.minStake} USDT</span></div>
                <div className="flex justify-between"><span className="text-beige-muted">{t('staking.max')}</span><span className="text-beige font-medium">{pool.maxStake > 0 ? `$${pool.maxStake} USDT` : t('staking.noMax')}</span></div>
                <div className="flex justify-between"><span className="text-beige-muted">{t('staking.oneActive')}</span><span className="text-beige font-medium">{pool.maxStake > 0 ? t('staking.oneActiveYes') : t('staking.oneActiveNo')}</span></div>
              </div>
              {pool.features && (
                <div className="mx-6 pt-2 border-t border-dark-border space-y-2 pb-4">
                  {pool.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gold"><Award className="h-3.5 w-3.5" /> {f}</div>
                  ))}
                </div>
              )}
              {/* Stake button */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => setActivePool(pool.id)}
                  disabled={!isConnected || !poolActiveMap[pool.id]}
                  className={`w-full py-3 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${pool.featured ? 'bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40' : 'border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10'}`}
                >
                  {!poolActiveMap[pool.id]
                    ? <span className="flex items-center justify-center gap-1.5"><Lock className="h-4 w-4" /> Pool Closed</span>
                    : !isConnected ? t('nav.connect') : t('staking.stake')}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stake Widget */}
        {activePool !== null && selectedPool && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl mb-16">
            <div className="rounded-3xl border border-gold/30 bg-dark-card p-8 glow-gold">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{t('staking.stakeInPool')} {selectedPool.tier}</h3>
                  <p className="text-sm text-beige-muted">{selectedPool.duration} • {selectedPool.daily}% daily</p>
                </div>
                <button onClick={() => setActivePool(null)} className="text-beige-muted hover:text-white">✕</button>
              </div>

              {/* Pool 360 — Referral Requirement Notice (compact) */}
              {selectedPool.id === 3 && (
                referralData && referralData[0] !== '0x0000000000000000000000000000000000000000' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 mb-4">
                    <Check className="h-4 w-4 text-green-400 shrink-0" />
                    <span className="text-xs text-green-400 font-medium">Referrer active — Accelerator &amp; Affiliate bonuses unlocked.</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-400 font-medium flex-1">
                        Referral required for Accelerator &amp; Affiliate bonuses.
                      </span>
                      <button
                        onClick={() => { navigator.clipboard.writeText('https://www.vyronx.io/staking?ref=VYR42neFIwpQpzAoMMRfW2WxpXhFy8SUStiAsyYVfxZ0Gt8PiMlUjK87v'); toast.success('Referral link copied! Open it to register.'); }}
                        className="shrink-0 px-2 py-1 text-xs font-bold rounded-md border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" /> Copy Link
                      </button>
                    </div>
                  </div>
                )
              )}

              <div className="mb-6">
                <label className="text-sm font-medium text-beige mb-2 block">{t('staking.amount')}</label>
                <div className="relative">
                  <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="0.00"
                    className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-4 text-2xl text-white placeholder:text-beige-muted/40 focus:outline-none focus:border-gold/50" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gold">USDT</span>
                </div>
              </div>

              {stakeAmount && (
                <div className="rounded-xl bg-dark-elevated border border-dark-border p-5 space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-beige-muted">{t('staking.maturity')}</span>
                    <span className="text-sm font-bold text-green-400">+${calculateEarnings(parseFloat(stakeAmount), selectedPool.daily, selectedPool.lock)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-beige-muted">{t('staking.paidVyr')}</span>
                    <span className="text-sm font-bold text-gold">{t('staking.oracle')}</span>
                  </div>
                  <div className="flex justify-between border-t border-dark-border pt-3">
                    <span className="text-sm font-bold text-white">{t('staking.totalReturn')}</span>
                    <span className="text-lg font-black text-gold-gradient">${(parseFloat(stakeAmount) + parseFloat(calculateEarnings(parseFloat(stakeAmount), selectedPool.daily, selectedPool.lock))).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {needsApproval && stakeAmount ? (
                <button onClick={handleApprove} disabled={txPending}
                  className="w-full py-4 text-base font-bold rounded-xl border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {txPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                  {txPending ? t('staking.confirming') : t('staking.approve')}
                </button>
              ) : (
                <button onClick={handleStake} disabled={!stakeAmount || txPending}
                  className="w-full py-4 text-base font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  {txPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {txPending ? t('staking.processing') : `${t('staking.stake')} ${stakeAmount || ''} USDT`}
                </button>
              )}

              <p className="mt-4 text-xs text-beige-muted text-center flex items-center justify-center gap-1">
                <Info className="h-3 w-3" /> {t('staking.connect')}
              </p>
            </div>
          </motion.div>
        )}

        {/* ══ MY STAKES — claim daily (min $10) + withdraw at maturity ══ */}
        <MyStakes />

        {/* How It Works */}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { step: '01', icon: Wallet, title: t('staking.howTitle1'), desc: t('staking.howDesc1') },
            { step: '02', icon: Lock, title: t('staking.howTitle2'), desc: t('staking.howDesc2') },
            { step: '03', icon: TrendingUp, title: t('staking.howTitle3'), desc: t('staking.howDesc3') },
            { step: '04', icon: Unlock, title: t('staking.howTitle4'), desc: t('staking.howDesc4') },
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
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full bg-gold/5 mb-4 neon-pulse">{t('staking.accelDesc')}</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('staking.accelerator')}</h2>
              <p className="mt-3 text-beige-muted max-w-2xl mx-auto">{t('staking.accelBody')}</p>
            </motion.div>

            <motion.div variants={fadeUp} className="mx-auto max-w-2xl">
              <div className="rounded-2xl bg-dark-elevated border border-dark-border p-6">
                <div className="text-sm font-bold text-gold mb-4">{t('staking.example')}</div>
                <div className="space-y-3">
                  {[
                    { referral: `${t('staking.referralLabel')} #1`, deposit: '$200', accel: '$20 (10%)', total: '20%', barWidth: '20%' },
                    { referral: `${t('staking.referralLabel')} #2`, deposit: '$500', accel: '$50 (10%)', total: '70%', barWidth: '70%' },
                    { referral: `${t('staking.referralLabel')} #3`, deposit: '$300', accel: '$30 (10%)', total: '100% ✓', barWidth: '100%' },
                  ].map((row, i) => (
                    <div key={i} className="flex flex-col gap-2 p-3 rounded-xl bg-dark-elevated">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-beige-muted">{row.referral}</span>
                        <span className="text-xs font-bold text-gold">{row.total}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-beige">{row.deposit}</span>
                        <span className="text-xs text-beige-muted">{row.accel}</span>
                      </div>
                      <div className="h-2 rounded-full bg-dark-border overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark rounded-full" style={{ width: row.barWidth }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-dark-border text-center">
                  <span className="text-sm font-bold text-green-400">{t('staking.earlyUnlocked')}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Affiliate Program */}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16">
          <motion.div variants={fadeUp} className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{t('staking.affiliateTitle')}</h2>
            <p className="mt-3 text-beige-muted max-w-2xl mx-auto">{t('staking.affiliateBody')}</p>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {AFFILIATE_LEVELS.map((level) => (
                <div key={level.level} className="flex items-center justify-between rounded-xl bg-dark-elevated p-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-gold/10 text-xs font-black text-gold">{level.level}</span>
                    <div>
                      <div className="text-sm font-bold text-gold">{level.commission}</div>
                      <div className="text-xs text-beige-muted">{level.stake}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-beige">{level.directs}</div>
                    <div className="text-xs text-beige-muted">directs</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/presale" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all">
            {t('staking.buyVyrFirst')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Contract Address */}
        <div className="mt-8 rounded-xl border border-dark-border bg-dark-card p-4">
          <ContractAddress address={STAKING_ADDRESS} label="Staking Contract" />
        </div>
      </div>
    </div>
  );
}
