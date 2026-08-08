'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { publicClient } from '@/components/web3/Web3Provider';
import { encodeReferralCode, decodeReferralCode, isReferralCode } from '@/lib/referral-code';
import {
  Wallet, TrendingUp, Lock, Unlock, Users, Award, Clock,
  ArrowRight, Loader2, AlertCircle, Coins, Gift, Zap, ExternalLink,
  ChevronRight, Copy, Check, Ticket
} from 'lucide-react';
import {
  TOKEN_ADDRESS, STAKING_ADDRESS, USDT_ADDRESS,
  PresaleABI, StakingABI, TokenABI, STAKING_POOLS
} from '@/lib/contracts';
import ContractAddress from '@/components/web3/ContractAddress';
import { formatUnits, parseUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';
import ParticleField from '@/components/fx/ParticleField';
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
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export default function DashboardPage() {
  const { t } = useI18n();
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);
  // CHANGE #6: 12h countdown timer state (declared early so hooks below can use it)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(t); }, []);

  const onCorrectChain = chainId === bsc.id;

  // Read VYR balance
  const { data: vyrBalanceData } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'balanceOf', args: [address || '0x0'], chainId: bsc.id,
  }) as { data: bigint | undefined };

  // Read USDT balance
  const { data: usdtBalanceData } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'], chainId: bsc.id,
  }) as { data: bigint | undefined };

  // Read presale buyer info
  const { data: buyerInfo } = useReadContract({
    address: process.env.NEXT_PUBLIC_PRESALE_ADDRESS as `0x${string}`, abi: PresaleABI,
    functionName: 'getBuyerInfo', args: [address || '0x0'], chainId: bsc.id,
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  // Read staking info
  const { data: stakeCountData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getUserStakeCount', args: [address || '0x0'], chainId: bsc.id,
  });
  const stakeCount = stakeCountData ? Number(stakeCountData) : 0;

  // Read pending vouchers (not yet redeemed)
  // V3: getUserVouchers returns (ids, poolIds, usdtValues, expiries, redeemed, cancelled)
  const { data: userVouchers } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getUserVouchers', args: [address || '0x0'], chainId: bsc.id,
  }) as { data: readonly [readonly bigint[], readonly bigint[], readonly bigint[], readonly bigint[], readonly boolean[], readonly boolean[]] | undefined };

  const pendingVouchers = userVouchers
    ? (userVouchers[0] as readonly bigint[]).map((id, i) => ({
        id: Number(id),
        value: userVouchers[2][i],
        poolId: Number(userVouchers[1][i]),
        expiry: Number(userVouchers[3][i]),
        redeemed: userVouchers[4][i],
        cancelled: userVouchers[5][i],
      })).filter(v => !v.redeemed && !v.cancelled)
    : [];

  const [redeeming, setRedeeming] = useState<number | null>(null);

  const handleRedeemVoucher = async (voucherId: number) => {
    if (!isConnected) return;
    setRedeeming(voucherId);
    const toastId = toast.loading('Activating voucher...');
    try {
      if (chainId !== bsc.id) { toast.loading('Switching to BSC Mainnet...', { id: toastId }); await switchChainAsync({ chainId: bsc.id }); toast.loading('Activating voucher...', { id: toastId }); }
      await writeContractAsync({
        address: STAKING_ADDRESS, abi: StakingABI, functionName: 'redeemVoucher',
        args: [BigInt(voucherId)],
      });
      toast.success('Voucher activated! Your virtual stake is now earning rewards. 🎫✨', { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to redeem voucher', { id: toastId });
    } finally {
      setRedeeming(null);
    }
  };

  // Read referral info
  const { data: referralData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getReferralInfo', args: [address || '0x0'], chainId: bsc.id,
  }) as { data: readonly [`0x${string}`, bigint, bigint] | undefined };

  // CHANGE #6: Read accelerator status for grace period countdown
  const [acceleratorData, setAcceleratorData] = useState<Array<{ unlocked: boolean; graceEndTime: number; pendingCommission: string; graceExpired: boolean } | undefined>>([]);
  useEffect(() => {
    if (!address || !stakeCount) { setAcceleratorData([]); return; }
    (async () => {
      const results = [];
      for (let i = 0; i < 2; i++) { // check up to 2 accelerator entries
        try {
          const acc = await publicClient.readContract({
            address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getAcceleratorStatus',
            args: [address, BigInt(i)],
          }) as [bigint, boolean, bigint, bigint, bigint, boolean];
          if (!acc) break;
          if (!acc[1]) continue; // not unlocked
          results.push({
            unlocked: acc[1],
            graceEndTime: Number(acc[3]),
            pendingCommission: acc[4].toString(),
            graceExpired: acc[5],
          });
        } catch { break; }
      }
      setAcceleratorData(results);
    })();
  }, [address, stakeCount, now > 0 && now % 10 === 0]); // refresh every 10s tick

  // === FETCH 11-LEVEL NETWORK (real-time from chain) ===
  const [levelData, setLevelData] = useState<Array<{ count: number; volume: number; members: { address: string; volume: number }[] }>>(Array.from({ length: 11 }, () => ({ count: 0, volume: 0, members: [] })));
  const [networkLoading, setNetworkLoading] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!address) return;
    let active = true;
    setNetworkLoading(true);
    (async () => {
      try {
        const STAKING = STAKING_ADDRESS as `0x${string}`;
        // Level configs (commission % from contract)
        const LEVEL_COMMS = [7, 6, 5, 4, 3, 2, 2, 2, 2, 2, 7];
        const result: Array<{ count: number; volume: number; members: { address: string; volume: number }[] }> = Array.from({ length: 11 }, () => ({ count: 0, volume: 0, members: [] }));

        // BFS through 11 levels
        let currentLevelAddresses: string[] = [address];
        const visited = new Set<string>([address.toLowerCase()]);

        for (let level = 0; level < 11; level++) {
          if (currentLevelAddresses.length === 0) break;
          const nextLevelAddresses: string[] = [];

          // Process addresses at this level in parallel batches
          for (const addr of currentLevelAddresses) {
            try {
              // Read direct referrals of this address
              const directs = await publicClient.readContract({
                address: STAKING, abi: StakingABI,
                functionName: 'getReferralInfo', args: [addr as `0x${string}`],
              }) as [`0x${string}`, bigint, bigint];

              const directCount = Number(directs[1]);
              result[level].count += directCount;

              if (directCount > 0) {
                // Read each direct referral individually (mapping(address => address[]))
                for (let d = 0; d < directCount; d++) {
                  let direct: string = '';
                  try {
                    direct = await publicClient.readContract({
                      address: STAKING, abi: StakingABI,
                      functionName: 'directReferrals', args: [addr as `0x${string}`, BigInt(d)],
                    }) as `0x${string}`;
                  } catch { continue; }
                  if (!direct || direct === '0x0000000000000000000000000000000000000000') continue;
                  if (visited.has(direct.toLowerCase())) continue;
                  visited.add(direct.toLowerCase());
                  nextLevelAddresses.push(direct);

                  // Read their total stake volume
                  try {
                    const stakeCount = await publicClient.readContract({
                      address: STAKING, abi: StakingABI,
                      functionName: 'getUserStakeCount', args: [direct],
                    }) as bigint;
                    let userVol = 0;
                    for (let s = 0; s < Number(stakeCount); s++) {
                      const stake = await publicClient.readContract({
                        address: STAKING, abi: StakingABI,
                        functionName: 'userStakes', args: [direct, BigInt(s)],
                      }) as [string, bigint, bigint, bigint, bigint, boolean, bigint, boolean];
                      userVol += Number(stake[2]) / 1e18;
                    }
                    result[level].volume += userVol;
                    // Show ALL members (even if volume = 0 — they registered with the link but haven't staked yet)
                    result[level].members.push({ address: direct, volume: userVol });
                  } catch {}
                }
              }
            } catch {}
          }
          currentLevelAddresses = nextLevelAddresses;
        }

        if (active) setLevelData(result);
      } catch {
        // Silent fail
      } finally {
        if (active) setNetworkLoading(false);
      }
    })();
    return () => { active = false; };
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Read pending earnings for each stake
  const [earningsMap, setEarningsMap] = useState<Record<number, { usdt: string; vyr: string }>>({});
  const [stakesData, setStakesData] = useState<Record<number, { poolId: number; usdtAmount: string; isVoucher: boolean; withdrawn: boolean; startTime: number; lockEndTime: number }>>({});

  // Fetch real stake data (pool, value, isVoucher, times) from chain
  useEffect(() => {
    if (!address || stakeCount === 0) return;
    let active = true;
    (async () => {
      const map: Record<number, { poolId: number; usdtAmount: string; isVoucher: boolean; withdrawn: boolean; startTime: number; lockEndTime: number }> = {};
      for (let i = 0; i < stakeCount; i++) {
        try {
          const res = await publicClient.readContract({
            address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
            functionName: 'userStakes', args: [address, BigInt(i)],
          }) as [string, bigint, bigint, bigint, bigint, boolean, bigint, boolean];
          map[i] = {
            poolId: Number(res[1]),
            usdtAmount: formatUnits(res[2], 18),
            startTime: Number(res[3]),
            lockEndTime: Number(res[4]),
            withdrawn: res[5],
            isVoucher: res[7],
          };
        } catch { map[i] = { poolId: 0, usdtAmount: '0', isVoucher: false, withdrawn: false, startTime: 0, lockEndTime: 0 }; }
      }
      if (active) setStakesData(map);
    })();
    return () => { active = false; };
  }, [address, stakeCount]);

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
          map[i] = { usdt: formatUnits(res[0], 18), vyr: formatUnits(res[1], 18) };
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
      if (chainId !== bsc.id) { toast.loading('Switching to BSC Mainnet...', { id: toastId }); await switchChainAsync({ chainId: bsc.id }); toast.loading('Withdrawing stake...', { id: toastId }); }
      await writeContractAsync({
        address: STAKING_ADDRESS, abi: StakingABI, functionName: 'withdraw',
        args: [BigInt(stakeIndex)],
      });
      toast.success('Withdrawal successful! VYR tokens received. 🎉', { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Withdrawal failed', { id: toastId });
    } finally {
      setWithdrawing(null);
    }
  };

  // CHANGE #2: Daily earnings claim
  const [claiming, setClaiming] = useState<number | null>(null);
  const handleClaimDaily = async (stakeIndex: number) => {
    if (!isConnected) return;
    setClaiming(stakeIndex);
    const toastId = toast.loading('Claiming daily earnings...');
    try {
      if (chainId !== bsc.id) { toast.loading('Switching to BSC Mainnet...', { id: toastId }); await switchChainAsync({ chainId: bsc.id }); toast.loading('Claiming...', { id: toastId }); }
      await writeContractAsync({
        address: STAKING_ADDRESS, abi: StakingABI, functionName: 'claimDailyEarnings',
        args: [BigInt(stakeIndex)],
      });
      toast.success('Daily earnings claimed in VYR! 🎉', { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Claim failed', { id: toastId });
    } finally {
      setClaiming(null);
    }
  };

  // CHANGE #4: Grace commission claim
  const handleClaimGrace = async (accIndex: number) => {
    if (!isConnected) return;
    const toastId = toast.loading('Claiming grace commissions...');
    try {
      if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
      await writeContractAsync({
        address: STAKING_ADDRESS, abi: StakingABI, functionName: 'claimGraceCommission',
        args: [BigInt(accIndex)],
      });
      toast.success('Grace commissions claimed! 🎉', { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Claim failed', { id: toastId });
    }
  };

  // CHANGE #6: countdown 'now' state declared at top of component

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
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="relative text-center max-w-md mx-auto px-4">
          <Wallet className="h-16 w-16 text-gold mx-auto mb-6 float" />
          <h1 className="text-3xl font-bold text-white mb-3">{t('dash.connect')}</h1>
          <p className="text-beige-muted mb-8">{t('dash.connectDesc')}</p>
          <p className="text-sm text-beige-muted">{t('dash.clickConnect')}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
      <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-12">
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white">{t('dash.title')}</h1>
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
              {copied ? t('dash.copied') : 'Copy Address'}
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

          <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5 text-gold" />
              <span className="text-xs text-beige-muted uppercase tracking-wider">USDT Balance</span>
            </div>
            <div className="text-2xl font-black text-white">{fmtNum(usdtBalanceData, 18, 2)}</div>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-gold" />
              <span className="text-xs text-beige-muted uppercase tracking-wider">{t('staking.active')}</span>
            </div>
            <div className="text-2xl font-black text-white">{stakeCount}</div>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-gold" />
              <span className="text-xs text-beige-muted uppercase tracking-wider">{t('staking.referrals')}</span>
            </div>
            <div className="text-2xl font-black text-white">{referralData ? String(referralData[1]) : '0'}</div>
          </motion.div>
        </motion.div>

        {/* Presale Purchases */}
        {buyerInfo && buyerInfo[0] > BigInt(0) && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-12">
            <div className="rounded-2xl glass-card p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Gift className="h-5 w-5 text-gold" /> Presale Purchases
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-beige-muted">USDT Spent</div>
                  <div className="text-lg font-bold text-white">${fmtNum(buyerInfo[0], 18, 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-beige-muted">{t('dash.tokensBought')}</div>
                  <div className="text-lg font-bold text-gold">{fmtNum(buyerInfo[1], 18, 0)} VYR</div>
                </div>
                <div>
                  <div className="text-xs text-beige-muted">{t('dash.totalEarnings')}</div>
                  <div className="text-lg font-bold text-green-400">{fmtNum(buyerInfo[2], 18, 0)} VYR</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pending Vouchers */}
        {pendingVouchers.length > 0 && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Ticket className="h-5 w-5 text-purple-400" /> Your Vouchers
            </h2>
            <div className="space-y-4">
              {pendingVouchers.map((v) => {
                const pool = STAKING_POOLS[v.poolId] || STAKING_POOLS[0];
                const expired = v.expiry > 0 && v.expiry < Math.floor(Date.now() / 1000);
                return (
                  <motion.div key={v.id} variants={fadeUp} className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <Ticket className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">Voucher #{v.id}</span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400 font-bold">${(Number(v.value) / 1e18).toLocaleString()}</span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gold/10 text-gold">{pool.duration}</span>
                          </div>
                          <div className="text-xs text-beige-muted mt-1">🎫 MLM License — unlocks affiliate system & accelerator (no yield, no principal)</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRedeemVoucher(v.id)}
                        disabled={redeeming === v.id || expired}
                        className="px-6 py-2.5 text-sm font-bold rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {redeeming === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        {expired ? 'Expired' : 'Activate License'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Stakes */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">{t('dash.myStakes')}</h2>
            <Link href="/staking" className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
              New Stake <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {stakeCount === 0 ? (
            <div className="rounded-2xl border border-dark-border bg-dark-card p-12 text-center">
              <Lock className="h-12 w-12 text-beige-muted mx-auto mb-4" />
              <p className="text-beige-muted mb-4">{t('dash.noStakes')}</p>
              <Link href="/staking" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all">
                Start Staking <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from({ length: stakeCount }).map((_, idx) => {
                const sData = stakesData[idx];
                const poolId = sData?.poolId ?? 0;
                const pool = STAKING_POOLS[poolId] || STAKING_POOLS[0];
                const earnings = earningsMap[idx] || { usdt: '0', vyr: '0' };
                const isVoucher = sData?.isVoucher ?? false;
                const isWithdrawn = sData?.withdrawn ?? false;
                const stakeValue = sData?.usdtAmount ? fmt(sData.usdtAmount, 0) : '0';
                const canClaimDaily = !isVoucher && !isWithdrawn && parseFloat(earnings.usdt) >= 10;
                return (
                  <motion.div key={idx} variants={fadeUp} className={`rounded-2xl border p-5 transition-colors ${isVoucher ? 'border-purple-500/30 bg-purple-500/5' : 'border-dark-border bg-dark-card hover:border-gold/30'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center h-12 w-12 rounded-xl border ${isVoucher ? 'bg-purple-500/10 border-purple-500/20' : 'bg-gold/10 border-gold/20'}`}>
                          {isVoucher ? <Ticket className="h-6 w-6 text-purple-400" /> : <Lock className="h-6 w-6 text-gold" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">{pool.tier}</span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-gold/10 text-gold">{pool.duration}</span>
                            {isVoucher && <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400 font-bold">🎫 License</span>}
                            {isWithdrawn && <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400">✓ Closed</span>}
                          </div>
                          <div className="text-xs text-beige-muted mt-1">
                            {isVoucher ? 'MLM License — no yield, no principal' : `${pool.dailyRate}% daily • Staked: $${stakeValue}`}
                          </div>
                        </div>
                      </div>

                      {/* Right side: earnings + buttons */}
                      {!isVoucher ? (
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-xs text-beige-muted">Pending</div>
                            <div className="text-sm font-bold text-green-400">{fmt(earnings.usdt)} USDT</div>
                            <div className="text-xs text-gold">≈ {fmt(earnings.vyr)} VYR</div>
                          </div>
                          {/* CHANGE #2: Daily claim button */}
                          <button
                            onClick={() => handleClaimDaily(idx)}
                            disabled={!canClaimDaily || claiming === idx}
                            className="px-4 py-2 text-xs font-bold rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                          >
                            {claiming === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                            Claim Daily
                          </button>
                          {!isWithdrawn && (
                            <button
                              onClick={() => handleWithdraw(idx)}
                              disabled={withdrawing === idx}
                              className="px-4 py-2 text-sm font-bold rounded-lg border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {withdrawing === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                              Withdraw
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-purple-400/60 italic">No earnings (license only)</div>
                      )}
                    </div>

                    {/* Stake progress bar */}
                    {!isVoucher && (() => {
                      const start = sData?.startTime ?? 0;
                      const end = sData?.lockEndTime ?? 0;
                      if (start === 0 || end === 0) return null;
                      const totalDuration = end - start;
                      const elapsed = Math.max(0, now - start);
                      const progressPct = isWithdrawn ? 100 : Math.min(100, Math.round((elapsed / totalDuration) * 100));
                      const daysLeft = Math.max(0, Math.ceil((end - now) / 86400));
                      const hoursLeft = Math.max(0, Math.ceil((end - now) / 3600));
                      return (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-beige-muted">
                              {isWithdrawn ? '✓ Completed' : progressPct >= 100 ? 'Ready to withdraw' : daysLeft > 0 ? `${daysLeft} days left` : `${hoursLeft}h left`}
                            </span>
                            <span className={`text-xs font-bold ${progressPct >= 100 ? 'text-green-400' : 'text-gold'}`}>{progressPct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-dark-elevated overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              className={`h-full rounded-full ${progressPct >= 100 ? 'bg-gradient-to-r from-green-500 to-green-400' : isWithdrawn ? 'bg-dark-border' : 'bg-gradient-to-r from-gold-dark to-gold-light'}`}
                            />
                          </div>
                        </div>
                      );
                    })()}
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
                <div className="text-xs text-beige-muted">{t('staking.referrals')}</div>
                <div className="text-2xl font-black text-gold-gradient">{referralData ? String(referralData[1]) : '0'}</div>
              </div>
              <div className="rounded-xl bg-dark-elevated border border-dark-border p-4">
                <div className="text-xs text-beige-muted">{t('dash.totalEarnings')}</div>
                <div className="text-2xl font-black text-gold">{referralData ? fmtNum(referralData[2], 18, 2) : '0'} <span className="text-sm">USDT</span></div>
              </div>
              <div className="rounded-xl bg-dark-elevated border border-dark-border p-4">
                <div className="text-xs text-beige-muted">{t('dash.yourReferrer')}</div>
                <div className="text-sm font-mono text-beige mt-1">
                  {referralData && referralData[0] !== '0x0000000000000000000000000000000000000000'
                    ? `${referralData[0].slice(0, 6)}...${referralData[0].slice(-4)}`
                    : 'None set'}
                </div>
              </div>
            </div>

            {/* Referral link — ONLY for active stakers */}
            {stakeCount > 0 ? (
            <div className="rounded-xl bg-dark-elevated border border-gold/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-gold" />
                <span className="text-xs text-gold font-bold uppercase tracking-wider">{t('dash.referralLink')}</span>
              </div>
                <div className="flex items-center gap-2 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2">
                  <code className="text-sm text-gold flex-1 truncate">
                    {address ? `${typeof window !== 'undefined' ? window.location.origin : 'https://vyronx.io'}/staking?ref=${encodeReferralCode(address)}` : 'Connect wallet'}
                  </code>
                  <button
                    onClick={() => { if (address) { navigator.clipboard.writeText(`${window.location.origin}/staking?ref=${encodeReferralCode(address)}`); toast.success('Referral link copied!'); } }}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
            ) : (
              <div className="rounded-xl border border-dark-border bg-dark-card p-6 text-center">
                <Lock className="h-8 w-8 text-beige-muted mx-auto mb-2" />
                <p className="text-sm text-beige-muted mb-1">Referral program unlocks after your first stake.</p>
                <Link href="/staking" className="inline-flex items-center gap-1 text-sm text-gold hover:text-gold-light">
                  Start Staking to Unlock <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* CHANGE #6: Accelerator 100% + 12h Countdown */}
            {acceleratorData && acceleratorData.map((acc, accIdx) => {
              if (!acc?.unlocked) return null;
              const graceEnd = Number(acc?.graceEndTime ?? 0);
              const remaining = graceEnd - now;
              const expired = acc?.graceExpired ?? false;
              const pending = acc?.pendingCommission ? formatUnits(BigInt(String(acc.pendingCommission)), 18) : '0';
              const hours = Math.floor(remaining / 3600);
              const mins = Math.floor((remaining % 3600) / 60);
              const secs = remaining % 60;
              return (
                <motion.div key={accIdx} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className={`mt-4 rounded-2xl border p-5 ${expired ? 'border-red-500/40 bg-red-500/5' : 'border-gold/50 bg-gradient-to-b from-dark-card to-gold/5 glow-gold'}`}>
                  <div className="text-center">
                    <div className="text-2xl mb-2">{expired ? '⌛' : '🎉'}</div>
                    <h3 className={`text-lg font-black ${expired ? 'text-red-400' : 'text-gold'}`}>
                      {expired ? 'Grace Period Expired' : 'Accelerator 100% Complete!'}
                    </h3>
                    {!expired && remaining > 0 ? (
                      <>
                        <div className="text-4xl font-black text-white mt-2 tabular-nums">
                          ⏰ {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                        </div>
                        <p className="text-xs text-beige-muted mt-2">Open a new Pool 360 stake before time runs out to claim pending commissions.</p>
                        <div className="mt-3 text-sm">
                          <span className="text-beige-muted">Pending: </span>
                          <span className="font-bold text-green-400">{fmt(pending, 2)} USDT</span>
                        </div>
                        <div className="flex gap-2 justify-center mt-4">
                          <Link href="/staking" className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark">
                            🔓 Open Pool 360
                          </Link>
                          <button onClick={() => handleClaimGrace(accIdx)} className="px-4 py-2 text-sm font-bold rounded-lg border border-green-500/40 bg-green-500/10 text-green-400">
                            Claim Pending
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-red-400 mt-2">
                        {expired ? 'You lost pending commissions. Open a new Pool 360 to receive future ones.' : 'Claim your pending commissions now!'}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* 11-Level Affiliate Breakdown — Only for stakers */}
            {stakeCount > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gold" />
                  <span className="text-sm font-bold text-white">Affiliate Network</span>
                  <span className="text-xs text-beige-muted">11 Levels Live</span>
                </div>
                {networkLoading && <Loader2 className="h-4 w-4 animate-spin text-gold" />}
              </div>

              {/* Level Cards */}
              <div className="space-y-2.5">
                {[
                      { level: 1, pct: 7, min: 100, directs: 0 },
                      { level: 2, pct: 6, min: 200, directs: 2 },
                      { level: 3, pct: 5, min: 300, directs: 3 },
                      { level: 4, pct: 4, min: 400, directs: 4 },
                      { level: 5, pct: 3, min: 500, directs: 5 },
                      { level: 6, pct: 2, min: 600, directs: 6 },
                      { level: 7, pct: 2, min: 700, directs: 7 },
                      { level: 8, pct: 2, min: 800, directs: 8 },
                      { level: 9, pct: 2, min: 900, directs: 9 },
                      { level: 10, pct: 2, min: 1000, directs: 10 },
                      { level: 11, pct: 7, min: 1100, directs: 11 },
                ].map((row, idx) => {
                  const ld = levelData[row.level - 1] || { count: 0, volume: 0 };
                  const directCount = referralData ? Number(referralData[1]) : 0;
                  const userStakeTotal = Object.values(stakesData).reduce((sum, s) => sum + (parseFloat(s.usdtAmount) || 0), 0);
                  const stakeProgress = Math.min(100, (userStakeTotal / row.min) * 100);
                  const directsProgress = row.directs === 0 ? 100 : Math.min(100, (directCount / row.directs) * 100);
                  const overallProgress = Math.round((stakeProgress + directsProgress) / 2);
                  const completed = overallProgress >= 100;
                  const estEarnings = ld.volume > 0 ? (ld.volume * row.pct / 100) : 0;
                  const isElite = row.level === 11;
                  const isTop3 = row.level <= 3;

                  return (
                    <motion.div
                      key={row.level}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`relative overflow-hidden rounded-xl border p-3 transition-all ${
                        completed
                          ? 'border-green-500/40 bg-green-500/5'
                          : isElite
                          ? 'border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-transparent'
                          : isTop3
                          ? 'border-gold/30 bg-gradient-to-r from-gold/5 to-transparent'
                          : 'border-dark-border bg-dark-card'
                      }`}
                    >
                      {/* Top row: Level + Commission */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center justify-center h-7 w-7 rounded-lg text-xs font-black ${
                            completed ? 'bg-green-500 text-dark'
                            : isElite ? 'bg-purple-500 text-white'
                            : isTop3 ? 'bg-gold text-dark'
                            : 'bg-dark-elevated text-beige'
                          }`}>
                            {completed ? '✓' : row.level}
                          </div>
                          <span className="text-sm font-bold text-white">
                            {isElite ? 'ELITE' : isTop3 ? 'TIER ' + row.level : 'Level ' + row.level}
                          </span>
                          {isElite && <span className="text-xs">👑</span>}
                          {isTop3 && <span className="text-xs">⭐</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-beige-muted">Commission</span>
                          <span className={`text-sm font-black ${completed ? 'text-green-400' : 'text-gold'}`}>{row.pct}%</span>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mb-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-beige-muted" />
                          <span className={`font-bold ${ld.count > 0 ? 'text-white' : 'text-beige-muted'}`}>{ld.count}</span>
                          <span className="text-beige-muted">conn</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-beige-muted">$</span>
                          <span className={`font-bold ${ld.volume > 0 ? 'text-gold' : 'text-beige-muted'}`}>{ld.volume > 0 ? ld.volume.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}</span>
                          <span className="text-beige-muted">vol</span>
                        </div>
                        {estEarnings > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-green-400">→</span>
                            <span className="font-bold text-green-400">${estEarnings.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 rounded-full bg-dark-elevated overflow-hidden relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${overallProgress}%` }}
                            transition={{ delay: idx * 0.04 + 0.2, duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full relative ${
                              completed
                                ? 'bg-gradient-to-r from-green-500 to-green-400'
                                : isElite
                                ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                                : 'bg-gradient-to-r from-gold-dark to-gold-light'
                            }`}
                          >
                            {!completed && overallProgress > 5 && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                            )}
                          </motion.div>
                        </div>
                        <span className={`text-xs font-bold w-10 text-right ${completed ? 'text-green-400' : overallProgress > 0 ? 'text-gold' : 'text-beige-muted'}`}>
                          {completed ? 'MAX' : `${overallProgress}%`}
                        </span>
                      </div>

                      {/* Expandable member list */}
                      {ld.members.length > 0 && (
                        <>
                          <button
                            onClick={() => setExpandedLevel(expandedLevel === row.level ? null : row.level)}
                            className="mt-2 text-xs text-gold/70 hover:text-gold flex items-center gap-1"
                          >
                            {expandedLevel === row.level ? '▲ Hide' : `▼ Show ${ld.members.length} member${ld.members.length > 1 ? 's' : ''}`}
                          </button>
                          {expandedLevel === row.level && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              className="mt-2 space-y-1 overflow-hidden"
                            >
                              {[...ld.members].sort((a, b) => b.volume - a.volume).map((m, mi) => (
                                <div key={mi} className="flex items-center justify-between rounded-lg bg-dark/50 border border-dark-border/50 px-2 py-1.5">
                                  <a
                                    href={`https://bscscan.com/address/${m.address}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-mono text-beige hover:text-gold"
                                  >
                                    ...{m.address.slice(-8)}
                                  </a>
                                  <span className={`text-xs font-bold ${m.volume > 0 ? 'text-gold' : 'text-beige-muted'}`}>
                                    {m.volume > 0 ? `$${m.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'Pending'}
                                  </span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Summary footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3 flex items-center justify-around"
              >
                <div className="text-center">
                  <div className="text-lg font-black text-gold">{levelData.reduce((a, b) => a + b.count, 0)}</div>
                  <div className="text-xs text-beige-muted">Total Network</div>
                </div>
                <div className="h-8 w-px bg-dark-border" />
                <div className="text-center">
                  <div className="text-lg font-black text-gold">${levelData.reduce((a, b) => a + b.volume, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                  <div className="text-xs text-beige-muted">Total Volume</div>
                </div>
                <div className="h-8 w-px bg-dark-border" />
                <div className="text-center">
                  <div className="text-lg font-black text-green-400">
                    ${levelData.reduce((a, b, i) => a + (b.volume > 0 ? (b.volume * [7,6,5,4,3,2,2,2,2,2,7][i] / 100) : 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-beige-muted">Est. Earnings</div>
                </div>
              </motion.div>

              <p className="text-xs text-beige-muted mt-2 text-center">
                Real-time data from BNB Chain • Earnings paid in VYR (Pool 360)
              </p>
            </div>
            )}
          </div>
        </motion.div>

        {/* Contract Addresses */}
        <div className="rounded-xl border border-dark-border bg-dark-card p-4 mb-8">
          <div className="text-xs text-beige-muted uppercase tracking-wider mb-3">Verified Contracts</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ContractAddress address={TOKEN_ADDRESS} label="VYR Token" />
            <ContractAddress address={STAKING_ADDRESS} label="Staking" />
          </div>
        </div>

        {/* {t('dash.quickActions')} */}
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
