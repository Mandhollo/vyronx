'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useSimulateContract, useSwitchChain } from 'wagmi';
import {
  Wallet, Clock, TrendingUp, Check, AlertCircle,
  ArrowRight, Shield, Zap, Loader2, ExternalLink, X, Send
} from 'lucide-react';
import { PRESALE_ADDRESS, USDT_ADDRESS, PRESALE_REFERRAL_ADDRESS, PresaleABI, ReferralABI } from '@/lib/contracts';
import ContractAddress from '@/components/web3/ContractAddress';
import { parseUnits, formatUnits } from 'viem';
import { publicClient } from '@/components/web3/Web3Provider';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';
import { isReferralCode, decodeReferralCode, encodeReferralCode } from '@/lib/referral-code';
import ParticleField from '@/components/fx/ParticleField';
import { triggerCoinConfetti } from '@/components/effects/CoinConfetti';
import { useI18n } from '@/lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

// Minimal ERC20 ABI for approve
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const PRESALE_PHASES = [
  { phase: 'Phase 1', price: '$0.010', status: 'active', allocation: '150M VYR' },
  { phase: 'Phase 2', price: '$0.020', status: 'upcoming', allocation: '150M VYR' },
  { phase: 'Launch', price: '$0.030', status: 'upcoming', allocation: 'Public Sale' },
];

const DISTRIBUTION = [
  { label: 'Collaborators', percent: 10, color: 'bg-amber-500' },
  { label: 'Infrastructure', percent: 10, color: 'bg-yellow-400' },
  { label: 'Development', percent: 10, color: 'bg-orange-400' },
  { label: 'Marketing', percent: 10, color: 'bg-green-500' },
  { label: 'Liquidity Pool', percent: 15, color: 'bg-yellow-300' },
  { label: 'Buyback', percent: 15, color: 'bg-amber-600' },
  { label: 'Tech Infrastructure', percent: 30, color: 'bg-amber-400' },
];

export default function PresalePage() {
  const { t } = useI18n();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [boughtVyr, setBoughtVyr] = useState('0');

  const onCorrectChain = chainId === bsc.id;

  // ═══ Referral System ═══
  // Read referrer from wrapper contract
  const { data: presaleRefData } = useReadContract({
    address: PRESALE_REFERRAL_ADDRESS, abi: ReferralABI, functionName: 'getReferralInfo',
    args: [address || '0x0'], chainId: bsc.id,
  }) as { data: readonly [`0x${string}`, bigint] | undefined };

  const hasPresaleReferrer = presaleRefData && presaleRefData[0] !== '0x0000000000000000000000000000000000000000';

  // Check URL for ?ref=VYR... code
  const refCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;
  const validRefCode = refCode && (refCode.startsWith('0x') ? refCode.length === 42 : isReferralCode(refCode));
  const decodedRefAddress = validRefCode
    ? (refCode!.startsWith('0x') ? refCode! : decodeReferralCode(refCode!))
    : null;

  // Auto-register referrer on connect (before first buy)
  const [refRegistered, setRefRegistered] = useState(false);
  useEffect(() => {
    if (!isConnected || !decodedRefAddress || refRegistered || hasPresaleReferrer) return;
    if (decodedRefAddress.toLowerCase() === address?.toLowerCase()) return;

    (async () => {
      try {
        const toastId = toast.loading('Registering referrer...');
        if (chainId !== bsc.id) {
          await switchChainAsync({ chainId: bsc.id });
        }
        await writeContractAsync({
          address: PRESALE_REFERRAL_ADDRESS, abi: ReferralABI, functionName: 'setReferrer',
          args: [decodedRefAddress as `0x${string}`],
        });
        toast.success('Referrer registered! You\'ll get 10% bonus.', { id: toastId });
        setRefRegistered(true);
      } catch (e) {
        toast.error('Failed to register referrer', { id: 'ref-reg' });
      }
    })();
  }, [isConnected, decodedRefAddress, refRegistered, hasPresaleReferrer]);

  // Read referral earnings (for dashboard-like display)
  const { data: myReferralEarnings } = useReadContract({
    address: PRESALE_REFERRAL_ADDRESS, abi: ReferralABI, functionName: 'referralEarnings',
    args: [address || '0x0'], chainId: bsc.id,
  });

  // Read wrapper reserve balance
  const { data: wrapperReserve } = useReadContract({
    address: PRESALE_REFERRAL_ADDRESS, abi: ReferralABI, functionName: 'reserveBalance',
    chainId: bsc.id,
  });

  // Read presale info
  const { data: presaleInfo } = useReadContract({
    address: PRESALE_ADDRESS,
    abi: PresaleABI,
    functionName: 'getPresaleInfo',
    chainId: bsc.id,
  });

  // Read buyer info
  const { data: buyerInfo } = useReadContract({
    address: PRESALE_ADDRESS,
    abi: PresaleABI,
    functionName: 'getBuyerInfo',
    args: [address || '0x0'],
    chainId: bsc.id,
  });

  // Read token preview
  const { data: tokenPreview } = useReadContract({
    address: PRESALE_ADDRESS,
    abi: PresaleABI,
    functionName: 'getTokensForUsdt',
    args: [amount ? parseUnits(amount, 18) : BigInt(0)],
    chainId: bsc.id,
  }) as { data: readonly [bigint, bigint] | undefined };

  // Read USDT allowance (check BOTH presale and wrapper)
  const { data: allowancePresale, refetch: refetchAllowancePresale } = useReadContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address || '0x0', PRESALE_ADDRESS],
    chainId: bsc.id,
  });
  const { data: allowanceWrapper, refetch: refetchAllowanceWrapper } = useReadContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address || '0x0', PRESALE_REFERRAL_ADDRESS],
    chainId: bsc.id,
  });
  const buyTarget = (hasPresaleReferrer ? PRESALE_REFERRAL_ADDRESS : PRESALE_ADDRESS) as `0x${string}`;
  const currentAllowance = hasPresaleReferrer ? (allowanceWrapper ?? BigInt(0)) : (allowancePresale ?? BigInt(0));

  // Read USDT balance
  const { data: balanceData } = useReadContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address || '0x0'],
    chainId: bsc.id,
  });
  const usdtBalance = balanceData ?? BigInt(0);

  const usdtAmountBigInt = amount ? parseUnits(amount, 18) : BigInt(0);
  const needsApproval = currentAllowance < usdtAmountBigInt;
  const vyrTokens = tokenPreview ? formatUnits(tokenPreview[0], 18) : '0';
  const vyrBonus = tokenPreview ? formatUnits(tokenPreview[1], 18) : '0';
  const totalVyrBigInt = tokenPreview ? tokenPreview[0] + tokenPreview[1] : BigInt(0);
  const totalVyr = tokenPreview ? formatUnits(totalVyrBigInt, 18) : '0';

  // Format numbers
  const fmtNum = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // Approve USDT — uses MAX approval so user only approves ONCE per contract
  const MAX_UINT256 = BigInt(2) ** BigInt(256) - BigInt(1);
  const handleApprove = async () => {
    if (!isConnected || !amount) return;
    setTxPending(true);
    const toastId = toast.loading('Approving USDT spending...');
    try {
      if (chainId !== bsc.id) {
        toast.loading('Switching to BSC Mainnet...', { id: toastId });
        await switchChainAsync({ chainId: bsc.id });
        toast.loading('Approving USDT spending...', { id: toastId });
      }
      const txHash = await writeContractAsync({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [buyTarget, MAX_UINT256],
      });
      // Wait for transaction to be mined then auto-refetch allowance
      toast.loading('Waiting for confirmation...', { id: toastId });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      toast.success('USDT approved! You can now buy VYR.', { id: toastId });
      // Force re-read allowance (wagmi auto-refetches on block)
      refetchAllowancePresale?.();
      refetchAllowanceWrapper?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed', { id: toastId });
    } finally {
      setTxPending(false);
    }
  };

  // Buy VYR — uses wrapper if referrer registered, direct presale otherwise
  const handleBuy = async () => {
    if (!isConnected || !amount) return;
    setTxPending(true);
    const toastId = toast.loading('Buying VYR tokens...');
    try {
      if (chainId !== bsc.id) {
        toast.loading('Switching to BSC Mainnet...', { id: toastId });
        await switchChainAsync({ chainId: bsc.id });
        toast.loading('Buying VYR tokens...', { id: toastId });
      }
      // If buyer has a referrer registered → buy through wrapper (gets 10% bonus for referrer)
      if (hasPresaleReferrer) {
        await writeContractAsync({
          address: PRESALE_REFERRAL_ADDRESS,
          abi: ReferralABI,
          functionName: 'buyWithReferral',
          args: [parseUnits(amount, 18)],
        });
      } else {
        // Direct buy — no referrer
        await writeContractAsync({
          address: PRESALE_ADDRESS,
          abi: PresaleABI,
          functionName: 'buyWithUsdt',
          args: [parseUnits(amount, 18)],
        });
      }
      toast.success(`Successfully bought ${fmtNum(totalVyr)} VYR! 🎉`, { id: toastId });
      setTimeout(() => triggerCoinConfetti(), 1500);
      setBoughtVyr(fmtNum(totalVyr));
      setShowSuccess(true);
      setAmount('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Purchase failed', { id: toastId });
    } finally {
      setTxPending(false);
    }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      {''}
      <div className="fixed top-20 right-4 z-50 sm:right-6">
        {''}
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {''}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >
          <motion.span variants={fadeUp} className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full bg-gold/5 mb-4 neon-pulse">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold animate-pulse" /> {t('presale.phaseLive')}
            </span>
          </motion.span>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-black text-white">
            {t('presale.title')} <span className="text-gold-gradient">$VYR</span> {t('presale.subtitle')}
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-4 text-lg text-beige-muted max-w-2xl mx-auto">
            Join the presale — <span className="text-gold font-bold">{t('presale.phase1desc')}</span>
          </motion.p>
        </motion.div>

        {/* Presale Banner Image */}
        <motion.div variants={fadeUp} className="mb-16 relative rounded-2xl overflow-hidden border border-gold/20">
          <img src="/presale-banner.jpg" alt="VyronX Presale — Buy $VYR at the best price" className="w-full h-auto" />
        </motion.div>

        {''}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-2xl mb-16"
        >
          <div className="rounded-3xl border border-gold/30 bg-dark-card p-8 glow-gold">
            {''}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-gold" />
                <span className="text-sm font-medium text-beige">
                  {isConnected
                    ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                    : t('presale.walletNotConnected')}
                </span>
                {isConnected && chainId && chainId !== bsc.id && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {t('presale.wrongNetworkBadge')}
                  </span>
                )}
              </div>
              {!isConnected ? (
                <span className="text-sm text-beige-muted">{t('presale.clickConnect')}</span>
              ) : null}
            </div>

            {''}
            {isConnected && chainId && chainId !== bsc.id && (
              <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <span className="text-sm text-red-400 font-bold">{t('presale.wrong')}</span>
                </div>
                <p className="text-xs text-beige-muted mt-1">{t('presale.switchHelp')}</p>
              </div>
            )}

            {''}
            {isConnected && onCorrectChain && (
              <div className="mb-4 flex justify-between text-sm">
                <span className="text-beige-muted">{t('presale.usdtBal')}</span>
                <span className="font-bold text-beige">
                  {usdtBalance ? formatUnits(usdtBalance, 18) : '0'} USDT
                </span>
              </div>
            )}

            {''}
            <div className="mb-6">
              <label className="text-sm font-medium text-beige mb-2 block">{t('presale.amountLabel')}</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={!isConnected}
                  className="w-full bg-dark-elevated border border-dark-border rounded-xl px-4 py-4 text-2xl text-white placeholder:text-beige-muted/40 focus:outline-none focus:border-gold/50 transition-colors disabled:opacity-50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gold">USDT</span>
              </div>
              {''}
              <div className="mt-3 flex gap-2">
                {[100, 500, 1000, 5000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(String(val))}
                    disabled={!isConnected}
                    className="flex-1 py-2 text-xs font-bold rounded-lg border border-dark-border bg-dark-elevated text-beige hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
                  >
                    ${val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {''}
            {amount && isConnected && (
              <div className="rounded-xl bg-dark-elevated border border-dark-border p-5 space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-beige-muted">{t('presale.price')}</span>
                  <span className="text-sm font-bold text-white">$0.010 / VYR</span>
                </div>
                <div className="border-t border-dark-border pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-white">{t('presale.receive')}</span>
                    <span className="text-2xl font-black text-gold-gradient">{fmtNum(totalVyr)} VYR</span>
                  </div>
                </div>
              </div>
            )}

            {''}
            {!isConnected ? (
              <div className="text-center py-4">
                <p className="text-sm text-beige-muted mb-3">{t('presale.connect1')}</p>
              </div>
            ) : (chainId && chainId !== bsc.id) ? (
              <div className="text-center py-4">
                <p className="text-sm text-red-400">{t('presale.switch')}</p>
              </div>
            ) : amount && needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={txPending}
                className="w-full py-4 text-base font-bold rounded-xl border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {txPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                {txPending ? t('presale.approving') : t('presale.approveUsdt')}
              </button>
            ) : (
              <button
                onClick={handleBuy}
                disabled={!amount || txPending}
                className="w-full py-4 text-base font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 hover:scale-[1.01] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 btn-glow"
              >
                {txPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {txPending ? t('presale.buying') : `${t('presale.buy')}${amount ? ' ' + fmtNum(totalVyr) : ''}`}
              </button>
            )}

            <p className="mt-4 text-xs text-beige-muted text-center">
              <Shield className="inline h-3 w-3 mr-1" />
              {t('presale.secure')}
            </p>
            <div className="mt-3 pt-3 border-t border-dark-border">
              <ContractAddress address={PRESALE_ADDRESS} label="Presale Contract" />
            </div>

            {/* ═══ Referral Banner ═══ */}
            {isConnected && (
              <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-gold" />
                  <span className="text-xs font-bold text-gold">SHARE & EARN 10% IN VYR</span>
                </div>
                <p className="text-xs text-beige-muted mb-3">
                  {hasPresaleReferrer
                    ? '✅ You have a referrer! Buy through this page to lock in their bonus.'
                    : 'Share your link. When someone buys, you earn 10% in VYR tokens (bonus, on top of their purchase).'}
                </p>
                {address && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-gold truncate bg-dark border border-dark-border rounded px-2 py-1.5">
                      vyronx.io/presale?ref={encodeReferralCode(address).slice(0, 16)}...
                    </code>
                    <button
                      onClick={() => {
                        const link = `https://vyronx.io/presale?ref=${encodeReferralCode(address)}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Referral link copied!');
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                )}
                {myReferralEarnings != null && BigInt(String(myReferralEarnings)) > BigInt(0) && (
                  <div className="mt-2 text-xs text-green-400">
                    Your referral earnings: {formatUnits(BigInt(String(myReferralEarnings)), 18)} VYR
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {''}
        {isConnected && onCorrectChain && presaleInfo ? (() => {
          const info = presaleInfo as [bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean];
          return (
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-12 mx-auto max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
                <div className="text-2xl font-black text-gold-gradient">
                  {info[3] ? formatUnits(info[3], 18) : '0'}
                </div>
                <div className="text-xs text-beige-muted mt-1">{t('presale.usdtRaised')}</div>
              </div>
              <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
                <div className="text-2xl font-black text-gold-gradient">
                  {info[4] ? formatUnits(info[4], 18) : '0'}
                </div>
                <div className="text-xs text-beige-muted mt-1">{t('presale.vyrSold')}</div>
              </div>
              <div className="rounded-xl border border-dark-border bg-dark-card p-4 text-center">
                <div className="text-2xl font-black text-gold-gradient">{String(info[5] || BigInt(0))}</div>
                <div className="text-xs text-beige-muted mt-1">{t('presale.buyers')}</div>
              </div>
            </div>
          </motion.div>
          );
        })() : null}

        {''}
        {isConnected && onCorrectChain && buyerInfo ? (() => {
          const bi = buyerInfo as [bigint, bigint, bigint];
          if (bi[0] <= BigInt(0)) return null;
          return (
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-12 mx-auto max-w-2xl">
            <div className="rounded-2xl border border-gold/30 bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">{t('presale.history')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-beige-muted">{t('presale.spent')}</div>
                  <div className="text-lg font-bold text-white">${formatUnits(bi[0], 18)}</div>
                </div>
                <div>
                  <div className="text-xs text-beige-muted">{t('presale.tokens')}</div>
                  <div className="text-lg font-bold text-gold">{fmtNum(formatUnits(bi[1], 18))}</div>
                </div>
                <div>
                  <div className="text-xs text-beige-muted">VYR</div>
                  <div className="text-lg font-bold text-green-400">{fmtNum(formatUnits(bi[2], 18))}</div>
                </div>
              </div>
            </div>
          </motion.div>
          );
        })() : null}
        {''}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">{t('presale.phases2')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRESALE_PHASES.map((phase) => (
              <motion.div key={phase.phase} variants={fadeUp}
                className={`rounded-2xl border p-5 ${phase.status === 'active' ? 'border-gold/50 bg-gold/5 glow-gold' : 'border-dark-border bg-dark-card'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white">{phase.phase}</span>
                  {phase.status === 'active' && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gold/20 text-gold border border-gold/30">{t('presale.live')}</span>
                  )}
                </div>
                <div className="text-3xl font-black text-gold-gradient mb-1">{phase.price}</div>
                <div className="text-xs text-beige-muted mb-3">{phase.allocation}</div>
                <div className="space-y-1 text-sm border-t border-dark-border pt-3">
                  <div className="flex justify-between"><span className="text-beige-muted">{t('presale.allocation')}</span><span className="text-beige font-medium">{phase.allocation}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {''}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-2">{t('presale.distribution')}</h2>
          <p className="text-sm text-beige-muted text-center mb-8">{t('presale.runs30')}</p>
          <div className="rounded-2xl border border-dark-border bg-dark-card p-8">
            <div className="flex h-6 rounded-lg overflow-hidden mb-6">
              {DISTRIBUTION.map((item) => (
                <div key={item.label} className={item.color} style={{ width: `${item.percent}%` }} title={`${item.label}: ${item.percent}%`} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DISTRIBUTION.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded ${item.color}`} />
                  <span className="text-sm text-beige">{item.label}</span>
                  <span className="text-sm font-bold text-gold ml-auto">{item.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {''}
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: Clock, title: t('presale.days30'), desc: t('presale.days30desc') },
            { icon: Shield, title: t('presale.secureAudited'), desc: t('presale.secureAuditedDesc') },
            { icon: Zap, title: t('presale.instantReceipt'), desc: t('presale.instantReceiptDesc') },
          ].map((card) => (
            <motion.div key={card.title} variants={fadeUp} className="rounded-2xl glass-card p-6">
              <card.icon className="h-8 w-8 text-gold mb-3" />
              <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-beige-muted">{card.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {''}
        <div className="mt-16 text-center">
          <Link href="/staking" className="magnetic-btn inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors">
            {t('presale.exploreStaking')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Success Modal — Telegram Invite */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowSuccess(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-dark-card border border-gold/40 rounded-3xl p-8 max-w-md w-full glow-gold"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowSuccess(false)} className="absolute top-4 right-4 text-beige-muted hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>

            {/* Success Animation */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 border border-green-500/40 mb-4">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <h3 className="text-xl font-black text-white">Purchase Successful! 🎉</h3>
              <p className="text-sm text-beige-muted mt-1">
                You received <span className="text-gold font-bold">{boughtVyr} VYR</span> in your wallet.
              </p>
            </div>

            {/* Telegram CTA */}
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <Send className="h-6 w-6 text-blue-400 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">Join Our Telegram</div>
                  <div className="text-xs text-beige-muted">Get updates, support & exclusive announcements.</div>
                </div>
              </div>
              <a
                href="https://t.me/vyrontoken"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 transition-all"
              >
                <Send className="h-4 w-4" /> Join Telegram Group
              </a>
            </div>

            <div className="flex gap-2">
              <Link href="/dashboard" className="flex-1 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark text-center hover:shadow-lg hover:shadow-gold/40 transition-all">
                View Dashboard
              </Link>
              <button onClick={() => setShowSuccess(false)} className="flex-1 py-3 text-sm font-bold rounded-xl border border-dark-border bg-dark-elevated text-beige hover:text-white transition-colors">
                Keep Buying
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
