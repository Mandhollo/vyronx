'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { Zap, Unlock, Loader2, Info } from 'lucide-react';
import { STAKING_ADDRESS, StakingABI } from '@/lib/contracts';
import { publicClient } from '@/components/web3/Web3Provider';
import { useI18n } from '@/lib/i18n';
import { formatUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';

const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } } };

const POOL_TIERS = ['Starter', 'Growth', 'Pro', 'Elite'];

// userStakes tuple: [0]staker [1]poolId [2]usdtAmount [3]startTime [4]lockEndTime
//                   [5]withdrawn [6]isVoucher [7]? [8]?
type StakeInfo = {
  poolId: number;
  usdtAmount: string;
  isVoucher: boolean;
  withdrawn: boolean;
  lockEnd: number;
  pendingUsdt: string;
};

export default function MyStakes() {
  const { t } = useI18n();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [claiming, setClaiming] = useState<number | null>(null);
  const [withdrawing, setWithdrawing] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const iv = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  const { data: countData } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getUserStakeCount',
    args: [address || '0x0'], chainId: bsc.id, query: { enabled: isConnected },
  });
  const stakeCount = countData ? Number(countData) : 0;

  const [stakes, setStakes] = useState<StakeInfo[]>([]);
  useEffect(() => {
    if (!isConnected || !address || stakeCount === 0) { setStakes([]); return; }
    let active = true;
    (async () => {
      const out: StakeInfo[] = [];
      for (let i = 0; i < stakeCount; i++) {
        try {
          const s = (await publicClient.readContract({
            address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
            functionName: 'userStakes', args: [address as `0x${string}`, BigInt(i)],
          })) as unknown as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, boolean, boolean];
          let pendingUsdt = '0';
          if (!s[5] && !s[6]) { // not withdrawn, not voucher → can earn
            try {
              const e = (await publicClient.readContract({
                address: STAKING_ADDRESS as `0x${string}`, abi: StakingABI,
                functionName: 'getPendingEarnings', args: [address as `0x${string}`, BigInt(i)],
              })) as readonly [bigint, bigint];
              pendingUsdt = formatUnits(e[0], 18);
            } catch { /* voucher or zero-day */ }
          }
          out.push({
            poolId: Number(s[1]), usdtAmount: formatUnits(s[2], 18),
            isVoucher: s[6], withdrawn: s[5], lockEnd: Number(s[4]), pendingUsdt,
          });
        } catch { /* skip */ }
      }
      if (active) setStakes(out);
    })();
    return () => { active = false; };
  }, [address, stakeCount, isConnected, claiming, withdrawing]);

  if (!isConnected || stakeCount === 0) return null;

  const ensureChain = async () => {
    if (chainId === bsc.id) return true;
    try { await switchChainAsync({ chainId: bsc.id }); return true; } catch { return false; }
  };

  const handleClaim = async (idx: number) => {
    if (!(await ensureChain())) return;
    setClaiming(idx);
    const toastId = toast.loading('Claiming daily earnings...');
    try {
      await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'claimDailyEarnings', args: [BigInt(idx)] });
      toast.success('Earnings claimed in VYR! 🎉', { id: toastId });
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      toast.error(err.shortMessage || err.message || 'Claim failed', { id: toastId });
    } finally { setClaiming(null); }
  };

  const handleWithdraw = async (idx: number) => {
    if (!(await ensureChain())) return;
    setWithdrawing(idx);
    const toastId = toast.loading('Withdrawing stake...');
    try {
      await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'withdraw', args: [BigInt(idx)] });
      toast.success('Withdrawn! VYR sent to your wallet. 🎉', { id: toastId });
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      toast.error(err.shortMessage || err.message || 'Withdraw failed', { id: toastId });
    } finally { setWithdrawing(null); }
  };

  return (
    <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16">
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">{t('dash.myStakes')}</h2>
      <div className="space-y-3">
        {stakes.map((s, idx) => {
          const tier = POOL_TIERS[s.poolId] ?? `P${s.poolId}`;
          const unlocked = now >= s.lockEnd;
          const canClaim = !s.isVoucher && !s.withdrawn && parseFloat(s.pendingUsdt) >= 10;
          const usd = parseFloat(s.usdtAmount).toLocaleString('en-US', { maximumFractionDigits: 0 });
          return (
            <motion.div key={idx} variants={fadeUp} className={`rounded-2xl border p-5 ${s.isVoucher ? 'border-purple-500/30 bg-purple-500/5' : 'border-dark-border bg-dark-card'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{tier}</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gold/10 text-gold font-bold">
                    {s.isVoucher ? `🎫 License — $${usd}` : `$${usd}`}
                  </span>
                  {s.withdrawn && <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400">✓ Completed</span>}
                  {s.isVoucher && !s.withdrawn && <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400">No earnings (license only)</span>}
                </div>
                {!s.withdrawn && !s.isVoucher && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-right mr-2">
                      <div className="text-xs text-beige-muted">Pending</div>
                      <div className={`text-sm font-bold ${canClaim ? 'text-green-400' : 'text-beige-muted'}`}>${parseFloat(s.pendingUsdt).toFixed(2)}</div>
                    </div>
                    <button onClick={() => handleClaim(idx)} disabled={!canClaim || claiming !== null || withdrawing !== null}
                      title={canClaim ? 'Claim earnings in VYR' : 'Minimum $10 pending to claim'}
                      className="px-4 py-2 text-xs font-bold rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      {claiming === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      Claim Daily
                    </button>
                    <button onClick={() => handleWithdraw(idx)} disabled={!unlocked || withdrawing !== null || claiming !== null}
                      title={unlocked ? 'Withdraw principal + earnings in VYR (4% fee)' : 'Locked — available at maturity'}
                      className="px-4 py-2 text-xs font-bold rounded-lg border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      {withdrawing === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                      {unlocked ? 'Withdraw' : 'Locked'}
                    </button>
                  </div>
                )}
              </div>
              {!s.withdrawn && !s.isVoucher && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-beige-muted">
                    {unlocked ? 'Ready to withdraw' : `${Math.max(0, Math.ceil((s.lockEnd - now) / 86400))} days left`}
                  </span>
                  <span className="text-xs text-beige-muted">4% withdrawal fee</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-beige-muted flex items-center gap-1.5">
        <Info className="h-3 w-3" /> Earnings &amp; principal are paid in VYR directly to your wallet. Daily claim requires min $10 pending.
      </p>
    </motion.div>
  );
}
