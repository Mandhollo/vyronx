'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useConnect, useSwitchChain } from 'wagmi';
import {
  Settings, Lock, Coins, Users, TrendingUp, Power, Gauge,
  Loader2, DollarSign, Wallet, Banknote, Shield, Flame, UserRoundPen,
  Percent, Clock, Check, ExternalLink, AlertTriangle, ArrowRight, Zap, Gift, Gavel
} from 'lucide-react';
import {
  TOKEN_ADDRESS, STAKING_ADDRESS, USDT_ADDRESS,
  PRESALE_ADDRESS, PresaleABI, StakingABI, TokenABI, STAKING_POOLS,
  PRESALE_REFERRAL_ADDRESS, ReferralABI, STAKING_V1_ADDRESS,
  LOTTERY_ADDRESS, LotteryABI, AUCTION_ADDRESS, AuctionABI
} from '@/lib/contracts';
import { formatUnits, parseUnits } from 'viem';
import { bsc } from 'wagmi/chains';
import toast from 'react-hot-toast';
import ParticleField from '@/components/fx/ParticleField';
import { isAdminWallet, isFeeWallet } from '@/lib/admin-wallets';
import LotteryAdminSection from './LotteryAdminSection';
import AuctionAdminSection from './AuctionAdminSection';

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } } };
const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };

type TabId = 'overview' | 'token' | 'presale' | 'staking' | 'vouchers' | 'referral' | 'lottery' | 'auction' | 'arbitrage' | 'ownership';

export default function AdminPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Fee wallets: force arbitrage tab, read ?tab= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'arbitrage' && (isFeeWallet(address) || isAdminWallet(address))) {
      setActiveTab('arbitrage');
    }
  }, [address]);
  const [pending, setPending] = useState<string | null>(null);

  const onCorrectChain = chainId === bsc.id;
  const isOwner = isAdminWallet(address);

  // === READS: TOKEN ===
  const { data: tradingEnabled } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'tradingEnabled', chainId: bsc.id,
  }) as { data: boolean | undefined };

  const { data: buyFeeData } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'buyFee', chainId: bsc.id,
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  // Sell fee (4 BNB wallets) — current percentages on-chain
  const { data: sellFeeData } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'sellFee', chainId: bsc.id,
  }) as { data: readonly [bigint, bigint, bigint, bigint] | undefined };

  // Current fee recipient wallets on-chain
  const { data: feeWallet1 } = useReadContract({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'sellFeeWallet1', chainId: bsc.id }) as { data: string | undefined };
  const { data: feeWallet2 } = useReadContract({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'sellFeeWallet2', chainId: bsc.id }) as { data: string | undefined };
  const { data: feeWallet3 } = useReadContract({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'sellFeeWallet3', chainId: bsc.id }) as { data: string | undefined };
  const { data: feeWallet4 } = useReadContract({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'sellFeeWallet4', chainId: bsc.id }) as { data: string | undefined };

  // Presale distribution wallets (Marketing 10% / LP 15% / Buyback 15% / Tech 20%) + Dev wallets (4×10%)
  const { data: pMarketing } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'marketingWallet', chainId: bsc.id }) as { data: string | undefined };
  const { data: pLp } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'lpWallet', chainId: bsc.id }) as { data: string | undefined };
  const { data: pBuyback } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'buybackWallet', chainId: bsc.id }) as { data: string | undefined };
  const { data: pTech } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'techWallet', chainId: bsc.id }) as { data: string | undefined };
  const { data: pDev1 } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'devWallet1', chainId: bsc.id }) as { data: string | undefined };
  const { data: pDev2 } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'devWallet2', chainId: bsc.id }) as { data: string | undefined };
  const { data: pDev3 } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'devWallet3', chainId: bsc.id }) as { data: string | undefined };
  const { data: pDev4 } = useReadContract({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'devWallet4', chainId: bsc.id }) as { data: string | undefined };

  // Staking V5 commission wallets (4% withdrawal fee → 4×25% USDT)
  const { data: sComm1 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'commissionFeeWallets', args: [BigInt(0)], chainId: bsc.id }) as { data: string | undefined };
  const { data: sComm2 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'commissionFeeWallets', args: [BigInt(1)], chainId: bsc.id }) as { data: string | undefined };
  const { data: sComm3 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'commissionFeeWallets', args: [BigInt(2)], chainId: bsc.id }) as { data: string | undefined };
  const { data: sComm4 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'commissionFeeWallets', args: [BigInt(3)], chainId: bsc.id }) as { data: string | undefined };

  // Lottery + Auction current fee wallets (for one-click Marketing replacement)
  const { data: lotFeeWallets } = useReadContract({ address: LOTTERY_ADDRESS, abi: LotteryABI, functionName: 'getFeeWallets', chainId: bsc.id }) as { data: readonly [string, string, string, string] | undefined };
  const { data: lotBuybackW } = useReadContract({ address: LOTTERY_ADDRESS, abi: LotteryABI, functionName: 'buybackWallet', chainId: bsc.id }) as { data: string | undefined };
  const { data: aucW1 } = useReadContract({ address: AUCTION_ADDRESS, abi: AuctionABI, functionName: 'feeWallets', args: [BigInt(0)], chainId: bsc.id }) as { data: string | undefined };
  const { data: aucW2 } = useReadContract({ address: AUCTION_ADDRESS, abi: AuctionABI, functionName: 'feeWallets', args: [BigInt(1)], chainId: bsc.id }) as { data: string | undefined };
  const { data: aucW3 } = useReadContract({ address: AUCTION_ADDRESS, abi: AuctionABI, functionName: 'feeWallets', args: [BigInt(2)], chainId: bsc.id }) as { data: string | undefined };
  const { data: aucW4 } = useReadContract({ address: AUCTION_ADDRESS, abi: AuctionABI, functionName: 'feeWallets', args: [BigInt(3)], chainId: bsc.id }) as { data: string | undefined };

  const { data: maxWallet } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'maxWalletAmount', chainId: bsc.id,
  }) as { data: bigint | undefined };

  const { data: maxTx } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'maxTxAmount', chainId: bsc.id,
  }) as { data: bigint | undefined };

  // === READS: PRESALE ===
  const { data: presaleInfo } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'getPresaleInfo', chainId: bsc.id,
  }) as { data: readonly [bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean] | undefined };

  const { data: distDue } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'isDistributionDue', chainId: bsc.id,
  }) as { data: boolean | undefined };

  const { data: distTime } = useReadContract({
    address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'timeUntilNextDistribution', chainId: bsc.id,
  }) as { data: bigint | undefined };

  // === READS: STAKING ===
  const { data: vyrPrice } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'vyrPriceInUsdt', chainId: bsc.id,
  }) as { data: bigint | undefined };

  const { data: rewardPool } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'balanceOf', args: [STAKING_ADDRESS], chainId: bsc.id,
  }) as { data: bigint | undefined };

  const { data: totalStaked } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'totalStakedUsdt', chainId: bsc.id,
  }) as { data: bigint | undefined };

  const { data: totalStakers } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'totalStakers', chainId: bsc.id,
  }) as { data: bigint | undefined };

  // V2: totalActiveVoucherValue removed — vouchers are now licenses (no value)
  const totalActiveVoucher = BigInt(0);

  const { data: voucherCount } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getVoucherCount', chainId: bsc.id,
  }) as { data: bigint | undefined };

  // === READS: POOLS (individual reads) ===
  const { data: pool0 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(0)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string, bigint, bigint] | undefined };
  const { data: pool1 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(1)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string, bigint, bigint] | undefined };
  const { data: pool2 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(2)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string, bigint, bigint] | undefined };
  const { data: pool3 } = useReadContract({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'pools', args: [BigInt(3)], chainId: bsc.id }) as { data: readonly [bigint, bigint, boolean, string, bigint, bigint] | undefined };
  const allPools = [pool0, pool1, pool2, pool3];

  // === LOCAL STATE for forms ===
  const [buyRewards, setBuyRewards] = useState('4');
  const [buyLiq, setBuyLiq] = useState('2');
  const [buyBurn, setBuyBurn] = useState('2');
  // Sell fee inputs (4 BNB wallets) — defaults to current on-chain 2/2/2/2
  const [sellW1, setSellW1] = useState('2');
  const [sellW2, setSellW2] = useState('2');
  const [sellW3, setSellW3] = useState('2');
  const [sellW4, setSellW4] = useState('2');
  const [newFeeWallets, setNewFeeWallets] = useState<[string, string, string, string]>(['', '', '', '']);
  // Presale wallet inputs — distribution (Marketing/LP/Buyback/Tech) and dev (4×10%)
  const [newDistWallets, setNewDistWallets] = useState<[string, string, string, string]>(['', '', '', '']);
  const [newDevWallets, setNewDevWallets] = useState<[string, string, string, string]>(['', '', '', '']);
  const [newCommWallets, setNewCommWallets] = useState<[string, string, string, string]>(['', '', '', '']);
  // One-click Marketing wallet replacement (wonner-friendly) — pre-filled by team decision 2026-08-19
  const [newMktAddr, setNewMktAddr] = useState('0x0aFa2ccf487c9d4B76A8Bb99cC9058Cf430674a4');
  const [replaceMktStep, setReplaceMktStep] = useState<{ total: number; done: number; label: string } | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [poolRates, setPoolRates] = useState<Record<number, string>>({});
  const [poolLocks, setPoolLocks] = useState<Record<number, string>>({});
  const [poolMins, setPoolMins] = useState<Record<number, string>>({});
  const [poolMaxs, setPoolMaxs] = useState<Record<number, string>>({});

  // === HELPERS ===
  const fmt = (val: bigint | undefined, decimals: number, display: number) => {
    if (!val) return '0';
    return parseFloat(formatUnits(val, decimals)).toLocaleString('en-US', { maximumFractionDigits: display });
  };

  const exec = async (name: string, fn: () => Promise<unknown>) => {
    setPending(name);
    const tid = toast.loading(`${name}...`);
    try {
      // Auto-switch to BSC if on wrong chain
      if (chainId !== bsc.id) {
        toast.loading('Switching to BSC Mainnet...', { id: tid });
        await switchChainAsync({ chainId: bsc.id });
        toast.loading(`${name}...`, { id: tid });
      }
      await fn(); toast.success(`${name} successful!`, { id: tid });
    }
    catch (e) { toast.error(e instanceof Error ? e.message : `${name} failed`, { id: tid }); }
    finally { setPending(null); }
  };

  // === HANDLERS ===
  const handleSetBuyFees = () => exec('Update Buy Fees', () =>
    writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setBuyFees',
      args: [BigInt(buyRewards), BigInt(buyLiq), BigInt(buyBurn)], chainId: bsc.id })
  );

  const handleSetSellFees = () => {
    const total = Number(sellW1) + Number(sellW2) + Number(sellW3) + Number(sellW4);
    if (total > 25) return toast.error('Total sell fee max 25%');
    return exec('Update Sell Fees (4 Wallets)', () =>
      writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setSellFees',
        args: [BigInt(sellW1), BigInt(sellW2), BigInt(sellW3), BigInt(sellW4)], chainId: bsc.id })
    );
  };

  const handleSetFeeWallets = () => {
    const [w1, w2, w3, w4] = newFeeWallets;
    const allFilled = [w1, w2, w3, w4].every(w => /^0x[a-fA-F0-9]{40}$/.test(w.trim()));
    if (!allFilled) return toast.error('Fill ALL 4 wallet addresses (0x...)');
    return exec('Update Fee Wallets', () =>
      writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setSellFeeWallets',
        args: [w1.trim(), w2.trim(), w3.trim(), w4.trim()] as [string, string, string, string], chainId: bsc.id })
    );
  };

  const handleSetDistWallets = () => {
    const [w1, w2, w3, w4] = newDistWallets;
    const allFilled = [w1, w2, w3, w4].every(w => /^0x[a-fA-F0-9]{40}$/.test(w.trim()));
    if (!allFilled) return toast.error('Fill ALL 4 addresses (Marketing, LP, Buyback, Tech)');
    return exec('Update Presale Distribution Wallets', () =>
      writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setDistributionWallets',
        args: [w1.trim(), w2.trim(), w3.trim(), w4.trim()] as [string, string, string, string], chainId: bsc.id })
    );
  };

  const handleSetDevWallets = () => {
    const [w1, w2, w3, w4] = newDevWallets;
    const allFilled = [w1, w2, w3, w4].every(w => /^0x[a-fA-F0-9]{40}$/.test(w.trim()));
    if (!allFilled) return toast.error('Fill ALL 4 dev addresses');
    return exec('Update Presale Dev Wallets', () =>
      writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setDevWallets',
        args: [w1.trim(), w2.trim(), w3.trim(), w4.trim()] as [string, string, string, string], chainId: bsc.id })
    );
  };

  const handleSetCommWallets = () => {
    const [w1, w2, w3, w4] = newCommWallets;
    const allFilled = [w1, w2, w3, w4].every(w => /^0x[a-fA-F0-9]{40}$/.test(w.trim()));
    if (!allFilled) return toast.error('Fill ALL 4 commission wallet addresses');
    return exec('Update Commission Wallets', () =>
      writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setCommissionFeeWallets',
        args: [[w1.trim(), w2.trim(), w3.trim(), w4.trim()] as [string, string, string, string]], chainId: bsc.id })
    );
  };

  // One-click Marketing wallet replacement across ALL contracts (wonner-friendly).
  // Replaces wallet 4 (Marketing 0xe9A6...74Cd) everywhere it appears, using
  // CURRENT on-chain addresses for the other 3 (no manual re-entry).
  // Skips contracts whose Marketing wallet is already the new address.
  const handleReplaceMarketing = async () => {
    const newMkt = newMktAddr.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(newMkt)) return toast.error('Paste the NEW Marketing wallet (0x...)');
    if (!feeWallet1 || !feeWallet2 || !feeWallet3 || !feeWallet4 ||
        !pDev1 || !pDev2 || !pDev3 || !pDev4 ||
        !sComm1 || !sComm2 || !sComm3 || !sComm4 ||
        !lotFeeWallets || !lotBuybackW ||
        !aucW1 || !aucW2 || !aucW3 || !aucW4) {
      return toast.error('Loading current wallets from blockchain — wait a few seconds and try again');
    }
    if (chainId !== bsc.id) {
      try { await switchChainAsync({ chainId: bsc.id }); } catch { return toast.error('Switch to BSC network first'); }
    }

    type Step = { label: string; addr: `0x${string}`; do: () => Promise<unknown> };
    const steps: Step[] = [];
    const mkt = newMkt as `0x${string}`;

    // 1) Token sell-fee wallet 4
    if (feeWallet4.toLowerCase() !== mkt.toLowerCase())
      steps.push({ label: 'Token (sell tax)', addr: TOKEN_ADDRESS, do: () =>
        writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setSellFeeWallets',
          args: [feeWallet1, feeWallet2, feeWallet3, mkt], chainId: bsc.id }) });

    // 2) Presale dev wallet 4
    if (pDev4.toLowerCase() !== mkt.toLowerCase())
      steps.push({ label: 'Presale (dev 10%)', addr: PRESALE_ADDRESS, do: () =>
        writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setDevWallets',
          args: [pDev1, pDev2, pDev3, mkt], chainId: bsc.id }) });

    // 3) Staking V5 withdrawal commission wallet 4
    if (sComm4.toLowerCase() !== mkt.toLowerCase())
      steps.push({ label: 'Staking (withdrawal fee)', addr: STAKING_ADDRESS, do: () =>
        writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setCommissionFeeWallets',
          args: [[sComm1, sComm2, sComm3, mkt] as [string, string, string, string]], chainId: bsc.id }) });

    // 4) Lottery fee wallet 4 (keeps buyback wallet as-is)
    if (lotFeeWallets[3].toLowerCase() !== mkt.toLowerCase())
      steps.push({ label: 'Lottery (prize split)', addr: LOTTERY_ADDRESS, do: () =>
        writeContractAsync({ address: LOTTERY_ADDRESS, abi: LotteryABI, functionName: 'setFeeWallets',
          args: [[lotFeeWallets[0], lotFeeWallets[1], lotFeeWallets[2], mkt] as [string, string, string, string], lotBuybackW], chainId: bsc.id }) });

    // 5) Auction fee wallet 4
    if (aucW4.toLowerCase() !== mkt.toLowerCase())
      steps.push({ label: 'Auction (revenue split)', addr: AUCTION_ADDRESS, do: AuctionABI && (() =>
        writeContractAsync({ address: AUCTION_ADDRESS, abi: AuctionABI, functionName: 'setFeeWallets',
          args: [[aucW1, aucW2, aucW3, mkt] as [string, string, string, string]], chainId: bsc.id })) });

    if (steps.length === 0) {
      toast.success('Marketing wallet is already up to date in all 5 places!');
      setReplaceMktStep(null);
      return;
    }

    const tid = toast.loading(`Replacing Marketing wallet — 0/${steps.length}...`);
    setReplaceMktStep({ total: steps.length, done: 0, label: steps[0].label });
    let done = 0; const failed: string[] = [];
    for (const s of steps) {
      setReplaceMktStep({ total: steps.length, done, label: s.label });
      toast.loading(`Replacing Marketing wallet — ${done}/${steps.length}: ${s.label}...`, { id: tid });
      try { await s.do(); done += 1; }
      catch {
        failed.push(s.label);
        toast.error(`${s.label} FAILED — others will continue. Retry after it finishes.`, { duration: 6000 });
      }
    }
    setReplaceMktStep({ total: steps.length, done, label: failed.length ? `${failed.length} failed` : 'done' });
    if (failed.length === 0) toast.success(`Marketing wallet replaced in all ${steps.length} places!`, { id: tid, duration: 8000 });
    else toast.error(`Done with ${failed.length} failure(s): ${failed.join(', ')} — press the button again to retry.`, { id: tid, duration: 12000 });
  };

  const handleEnableTrading = () => exec('Enable Trading', () =>
    writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'enableTrading', chainId: bsc.id })
  );

  const handleStartPresale = () => exec('Start Presale', () =>
    writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'startPresale', chainId: bsc.id })
  );

  const handlePausePresale = () => exec('Pause Presale', () =>
    writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'pausePresale', chainId: bsc.id })
  );

  const handleDistribute = () => exec('Distribute Funds', () =>
    writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'distributeFunds', chainId: bsc.id })
  );

  const handleTogglePool = (poolId: number, active: boolean) => exec(`${active ? 'Open' : 'Close'} Pool ${poolId}`, () =>
    writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setPoolActive',
      args: [BigInt(poolId), active], chainId: bsc.id })
  );

  const handleSetPoolConfig = (poolId: number) => exec(`Update Pool ${poolId}`, () => {
    const rate = BigInt(poolRates[poolId] || '0');
    const lock = BigInt(poolLocks[poolId] || '0');
    const pool = allPools[poolId];
    const active = pool ? pool[2] : true;
    const name = pool ? pool[3] : '';
    return writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setPoolConfig',
      args: [BigInt(poolId), rate, lock, active, name], chainId: bsc.id });
  });

  const handleSetPoolLimits = (poolId: number) => {
    const min = poolMins[poolId]; const max = poolMaxs[poolId];
    if (!min || parseFloat(min) <= 0) { toast.error('Min must be > 0 (enter 0 = keep current)'); return; }
    const maxWei = max === '' || max === undefined ? BigInt(0) : BigInt(Math.floor(parseFloat(max) * 1e18));
    const minWei = BigInt(Math.floor(parseFloat(min) * 1e18));
    exec(`Set Limits Pool ${poolId}`, () =>
      writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setPoolLimits',
        args: [BigInt(poolId), minWei, maxWei], chainId: bsc.id })
    );
  };

  const handleSetPrice = () => {
    if (!priceInput) return;
    const priceWei = BigInt(Math.floor(parseFloat(priceInput) * 1e18));
    exec('Update VYR Price', () =>
      writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setVyrPrice', args: [priceWei], chainId: bsc.id })
    );
  };

  // === GATE ===
  const isFeeOnly = isFeeWallet(address) && !isAdminWallet(address);
  if (!isConnected) return (
    <GateScreen icon={Lock} title="Admin Access" subtitle="Connect an authorized wallet to access the admin panel." showConnect />
  );
  if (!isAdminWallet(address) && !isFeeWallet(address)) return (
    <GateScreen icon={Shield} title="Access Denied" subtitle="This wallet is not authorized to view the admin panel." danger />
  );

  const TABS: { id: TabId; label: string; icon: typeof Shield }[] = isFeeOnly ? [
    { id: 'arbitrage', label: 'Arbitrage', icon: TrendingUp },
  ] : [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'token', label: 'Token & Fees', icon: Coins },
    { id: 'presale', label: 'Presale', icon: DollarSign },
    { id: 'staking', label: 'Staking Pools', icon: TrendingUp },
    { id: 'vouchers', label: 'Vouchers', icon: Users },
    { id: 'referral', label: 'Referral', icon: Zap },
    { id: 'lottery', label: 'Lottery', icon: Gift },
    { id: 'auction', label: 'Auction', icon: Gavel },
    { id: 'arbitrage', label: 'Arbitrage', icon: TrendingUp },
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
                {!onCorrectChain && (
                  <button onClick={async () => { await switchChainAsync({ chainId: bsc.id }); }} className="ml-2 text-xs px-2 py-1 rounded bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20">Switch to BSC Mainnet</button>
                )}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2 -mx-1 px-1">
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
            {/* MIGRATION V2 BANNER */}
            <V2MigrationBanner pending={pending} setPending={setPending} exec={exec} />

            {/* VOUCHER MIGRATION */}
            <VoucherMigration pending={pending} setPending={setPending} />

            {/* Global Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="USDT Raised" value={`$${fmt(presaleInfo?.[3], 18, 0)}`} gold />
              <StatCard icon={Coins} label="VYR Sold" value={fmt(presaleInfo?.[4], 18, 0)} />
              <StatCard icon={Users} label="Total Buyers" value={String(presaleInfo?.[5] || BigInt(0))} />
              <StatCard icon={Banknote} label="Reward Pool" value={`${fmt(rewardPool, 18, 0)} VYR`} />
            </div>

            {/* Staking Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={TrendingUp} label="Total Staked" value={`$${fmt(totalStaked, 18, 0)}`} />
              <StatCard icon={Users} label="Total Stakers" value={String(totalStakers || BigInt(0))} />
              <StatCard icon={Percent} label="VYR Price" value={`$${vyrPrice ? (Number(vyrPrice) / 1e18).toFixed(4) : '--'}`} />
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

            {/* Team Wallet Replacement — one-click, leigo-friendly */}
            <div className="rounded-2xl border border-gold/40 bg-gradient-to-b from-dark-card to-gold/5 p-6 glow-gold">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <UserRoundPen className="w-5 h-5 text-gold" /> Replace Team Member Wallet
              </h3>
              <p className="text-xs text-beige-muted mb-4">
                Team member left? Paste the NEW member's wallet once — this updates the Marketing wallet in all 5 places
                (Token sell tax, Presale dev, Staking withdrawal fee, Lottery, Auction) in one go.
                Each update is a separate blockchain transaction: approve each one in your wallet.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <input type="text" placeholder="Paste NEW wallet address (0x...)"
                  value={newMktAddr}
                  onChange={(e) => setNewMktAddr(e.target.value)}
                  className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-gold/60" />
                <ActionBtn onClick={handleReplaceMarketing}
                  disabled={pending !== null || (!!replaceMktStep && replaceMktStep.label !== 'done' && !replaceMktStep.label.endsWith('failed'))}
                  loading={!!replaceMktStep && replaceMktStep.label !== 'done' && !replaceMktStep.label.endsWith('failed')}
                  icon={UserRoundPen} label={replaceMktStep ? `Updating ${replaceMktStep.done}/${replaceMktStep.total}...` : 'Replace Marketing Wallet'} variant="gold" />
              </div>
              {replaceMktStep && (
                <div className="text-xs text-beige-muted">
                  Step: <span className="text-gold font-bold">{replaceMktStep.label}</span> — {replaceMktStep.done}/{replaceMktStep.total} done.
                  {replaceMktStep.label === 'done' && <span className="text-green-400 font-bold"> All done!</span>}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-dark-border text-xs text-beige-muted space-y-1">
                <div>Current Marketing wallet: <code className="text-gold break-all">{feeWallet4 || '...'}</code></div>
                <div className="text-beige-muted/60">⚠️ Double-check the address before confirming — blockchain transfers cannot be undone.</div>
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

              {/* Sell Fees — 4 BNB wallets */}
              <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-gold/5 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-gold" /> Sell Tax — Current: {sellFeeData ? Number(sellFeeData[0]) + Number(sellFeeData[1]) + Number(sellFeeData[2]) + Number(sellFeeData[3]) : 8}%
                </h3>
                <div className="space-y-3">
                  <FeeInput label={`Wallet 1 — ${shortAddr(feeWallet1)}`} value={sellW1} onChange={setSellW1} current={sellFeeData?.[0]} />
                  <FeeInput label={`Wallet 2 — ${shortAddr(feeWallet2)}`} value={sellW2} onChange={setSellW2} current={sellFeeData?.[1]} />
                  <FeeInput label={`Wallet 3 — ${shortAddr(feeWallet3)}`} value={sellW3} onChange={setSellW3} current={sellFeeData?.[2]} />
                  <FeeInput label={`Wallet 4 — ${shortAddr(feeWallet4)}`} value={sellW4} onChange={setSellW4} current={sellFeeData?.[3]} />
                </div>
                <div className="mt-4 pt-4 border-t border-dark-border">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-beige-muted">Total Sell Tax</span>
                    <span className={`text-xl font-black ${Number(sellW1) + Number(sellW2) + Number(sellW3) + Number(sellW4) > 25 ? 'text-red-400' : 'text-gold'}`}>
                      {Number(sellW1) + Number(sellW2) + Number(sellW3) + Number(sellW4)}%
                    </span>
                  </div>
                  <ActionBtn onClick={handleSetSellFees} disabled={pending === 'Update Sell Fees (4 Wallets)'} loading={pending === 'Update Sell Fees (4 Wallets)'}
                    icon={Percent} label="Update Sell Fees" variant="gold" full />
                </div>
              </motion.div>
            </div>

            {/* Fee Wallet Addresses — replace the 4 recipients */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-1">Fee Wallet Addresses (Sell Tax Recipients)</h3>
              <p className="text-xs text-beige-muted mb-4">Current recipients receive the sell tax in BNB. Fill ALL 4 to replace them — leave empty to keep.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {([feeWallet1, feeWallet2, feeWallet3, feeWallet4] as (string | undefined)[]).map((w, i) => (
                  <div key={i} className="rounded-xl bg-dark-elevated p-3">
                    <div className="text-xs text-beige-muted mb-1">Wallet {i + 1} — Current</div>
                    <code className="text-xs text-gold break-all">{w || '...'}</code>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {([0, 1, 2, 3] as const).map((i) => (
                  <div key={i}>
                    <label className="text-xs text-beige-muted block mb-1">New Wallet {i + 1}</label>
                    <input
                      type="text" placeholder="0x..."
                      value={newFeeWallets[i]}
                      onChange={(e) => setNewFeeWallets(prev => { const n = [...prev] as [string, string, string, string]; n[i] = e.target.value; return n; })}
                      className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-gold/50"
                    />
                  </div>
                ))}
              </div>
              <ActionBtn onClick={handleSetFeeWallets} disabled={pending === 'Update Fee Wallets'} loading={pending === 'Update Fee Wallets'}
                icon={Banknote} label="Update Fee Wallets (All 4)" variant="green" />
            </motion.div>

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
                <InfoBox label="VYR Price" value={`$${presaleInfo ? (Number(presaleInfo[1]) / 1e18).toFixed(4) : '--'}`} />
                <InfoBox label="Status" value={presaleInfo?.[6] ? '🟢 Active' : '🔴 Paused'} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <InfoBox label="USDT Raised" value={`$${fmt(presaleInfo?.[3], 18, 0)}`} gold />
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
              <h3 className="text-lg font-bold text-white mb-4">Presale Phases</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoBox label="Phase 1" value="$0.01" gold />
                <InfoBox label="Phase 2" value="$0.02" />
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

            {/* Presale Wallets — adjust the 8 recipients of raised USDT */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-1">Presale Distribution Wallets</h3>
              <p className="text-xs text-beige-muted mb-4">USDT raised is split automatically every 48h. Percentages are fixed by contract; addresses are editable below.</p>

              {/* Distribution: Marketing / LP / Buyback / Tech */}
              <div className="mb-6">
                <div className="text-xs font-bold text-gold mb-2">DISTRIBUTION — Marketing 10% · LP 15% · Buyback 15% · Tech 20%</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  {([['Marketing', pMarketing], ['LP', pLp], ['Buyback', pBuyback], ['Tech', pTech]] as [string, string | undefined][]).map(([name, w], i) => (
                    <div key={name} className="rounded-xl bg-dark-elevated p-3">
                      <div className="text-xs text-beige-muted mb-1">{name} — Current</div>
                      <code className="text-xs text-gold break-all">{w || '...'}</code>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {(['Marketing', 'LP', 'Buyback', 'Tech'] as const).map((name, i) => (
                    <div key={name}>
                      <label className="text-xs text-beige-muted block mb-1">New {name} Wallet</label>
                      <input type="text" placeholder="0x..."
                        value={newDistWallets[i]}
                        onChange={(e) => setNewDistWallets(prev => { const n = [...prev] as [string, string, string, string]; n[i] = e.target.value; return n; })}
                        className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-gold/50" />
                    </div>
                  ))}
                </div>
                <ActionBtn onClick={handleSetDistWallets} disabled={pending === 'Update Presale Distribution Wallets'} loading={pending === 'Update Presale Distribution Wallets'}
                  icon={Banknote} label="Update Distribution Wallets (All 4)" variant="green" />
              </div>

              {/* Dev wallets: 4×10% */}
              <div className="pt-4 border-t border-dark-border">
                <div className="text-xs font-bold text-gold mb-2">DEV — 4 wallets × 10% (40% total)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                  {([pDev1, pDev2, pDev3, pDev4] as (string | undefined)[]).map((w, i) => (
                    <div key={i} className="rounded-xl bg-dark-elevated p-3">
                      <div className="text-xs text-beige-muted mb-1">Dev {i + 1} — Current</div>
                      <code className="text-xs text-gold break-all">{w || '...'}</code>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {([0, 1, 2, 3] as const).map((i) => (
                    <div key={i}>
                      <label className="text-xs text-beige-muted block mb-1">New Dev {i + 1} Wallet</label>
                      <input type="text" placeholder="0x..."
                        value={newDevWallets[i]}
                        onChange={(e) => setNewDevWallets(prev => { const n = [...prev] as [string, string, string, string]; n[i] = e.target.value; return n; })}
                        className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-gold/50" />
                    </div>
                  ))}
                </div>
                <ActionBtn onClick={handleSetDevWallets} disabled={pending === 'Update Presale Dev Wallets'} loading={pending === 'Update Presale Dev Wallets'}
                  icon={Banknote} label="Update Dev Wallets (All 4)" variant="green" />
              </div>
            </motion.div>

            {/* Phase Control */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-gradient-to-b from-dark-card to-gold/5 p-6 glow-gold">
              <h3 className="text-lg font-bold text-white mb-1">Phase Control</h3>
              <p className="text-xs text-beige-muted mb-4">Switch between presale phases or set a custom price.</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="rounded-xl bg-dark-elevated p-4 flex-1">
                  <div className="text-xs text-beige-muted">Current Phase</div>
                  <div className="text-xl font-bold text-gold">
                    Phase {presaleInfo ? Number(presaleInfo[0]) + 1 : 1} — {presaleInfo ? `$${(Number(presaleInfo[1]) / 1e18).toFixed(4)}` : '$0.01'}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={async () => {
                    if (!confirm('Set Phase 0 price to $0.01/VYR? This will fix the presale price.')) return;
                    await exec('Fix Phase 0 Price', async () => {
                      await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setPhase', args: [BigInt(0), BigInt(1), BigInt(0), BigInt(150_000_000) * BigInt(10)**BigInt(18)] });
                      await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setCurrentPhase', args: [BigInt(0)] });
                    });
                  }} disabled={pending === 'Fix Phase 0 Price'}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20">
                    {pending === 'Fix Phase 0 Price' ? <Loader2 className="h-4 w-4 animate-spin" /> : '⚡ Fix Price $0.01'}
                  </button>
                  <button onClick={async () => {
                    const current = presaleInfo ? Number(presaleInfo[0]) : 0;
                    if (current === 0) return toast.error('Already on Phase 1');
                    if (!confirm('Switch back to Phase 1 ($0.01)?')) return;
                    await exec('Set Phase 1', async () => {
                      await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setCurrentPhase', args: [BigInt(0)] });
                    });
                  }} disabled={pending === 'Set Phase 1' || (presaleInfo ? Number(presaleInfo[0]) === 0 : true)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 disabled:cursor-not-allowed">
                    {pending === 'Set Phase 1' ? <Loader2 className="h-4 w-4 animate-spin" /> : '← Phase 1 ($0.01)'}
                  </button>
                  <button onClick={async () => {
                    const current = presaleInfo ? Number(presaleInfo[0]) : 0;
                    if (current === 1) return toast.error('Already on Phase 2');
                    if (!confirm('Switch to Phase 2 ($0.02)?')) return;
                    await exec('Set Phase 2', async () => {
                      await writeContractAsync({ address: PRESALE_ADDRESS, abi: PresaleABI, functionName: 'setCurrentPhase', args: [BigInt(1)] });
                    });
                  }} disabled={pending === 'Set Phase 2' || (presaleInfo ? Number(presaleInfo[0]) === 1 : false)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 disabled:cursor-not-allowed">
                    {pending === 'Set Phase 2' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Phase 2 ($0.02) →'}
                  </button>
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
                    const val = BigInt((Number((document.getElementById('minBuy') as HTMLInputElement).value) || 0) * 1e18);
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
                    const val = BigInt((Number((document.getElementById('maxBuy') as HTMLInputElement).value) || 0) * 1e18);
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
                  <div className="text-xl font-bold text-gold">${vyrPrice ? (Number(vyrPrice) / 1e18).toFixed(4) : '--'}</div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  {/* V5 per-pool stake limits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-dark-border">
                    <div>
                      <label className="text-xs text-beige-muted block mb-1">Min Stake (USDT)</label>
                      <input type="number" value={poolMins[pool.id] ?? String(Number(chain ? chain[4] : BigInt(0)) / 1e18)} onChange={(e) => setPoolMins({ ...poolMins, [pool.id]: e.target.value })}
                        className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                    </div>
                    <div>
                      <label className="text-xs text-beige-muted block mb-1">Max Stake (USDT — 0 = no limit)</label>
                      <input type="number" value={poolMaxs[pool.id] ?? String(Number(chain ? chain[5] : BigInt(0)) / 1e18)} onChange={(e) => setPoolMaxs({ ...poolMaxs, [pool.id]: e.target.value })}
                        className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                    </div>
                  </div>
                  <button onClick={() => handleSetPoolLimits(pool.id)} disabled={pending === `Set Limits Pool ${pool.id}`}
                    className="mt-3 px-4 py-2 text-xs font-bold rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 disabled:opacity-50 flex items-center gap-2">
                    {pending === `Set Limits Pool ${pool.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                    Apply Limits
                  </button>
                </motion.div>
              );
            })}

            {/* Withdrawal Commission Wallets — 4 recipients of the 4% withdrawal fee (USDT, split 25% each) */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-1">Withdrawal Commission Wallets (Staking V5)</h3>
              <p className="text-xs text-beige-muted mb-4">The 4% withdrawal commission is paid in USDT and split equally between these 4 wallets (25% each).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                {([sComm1, sComm2, sComm3, sComm4] as (string | undefined)[]).map((w, i) => (
                  <div key={i} className="rounded-xl bg-dark-elevated p-3">
                    <div className="text-xs text-beige-muted mb-1">Wallet {i + 1} — Current</div>
                    <code className="text-xs text-gold break-all">{w || '...'}</code>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {([0, 1, 2, 3] as const).map((i) => (
                  <div key={i}>
                    <label className="text-xs text-beige-muted block mb-1">New Wallet {i + 1}</label>
                    <input type="text" placeholder="0x..."
                      value={newCommWallets[i]}
                      onChange={(e) => setNewCommWallets(prev => { const n = [...prev] as [string, string, string, string]; n[i] = e.target.value; return n; })}
                      className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-gold/50" />
                  </div>
                ))}
              </div>
              <ActionBtn onClick={handleSetCommWallets} disabled={pending === 'Update Commission Wallets'} loading={pending === 'Update Commission Wallets'}
                icon={Banknote} label="Update Commission Wallets (All 4)" variant="green" />
            </motion.div>
          </motion.div>
        )}

        {/* ══ VOUCHERS TAB ══ */}
        {activeTab === 'vouchers' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            {/* Create Voucher */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-gradient-to-b from-dark-card to-gold/5 p-6 glow-gold">
              <h3 className="text-lg font-bold text-white mb-1">Create Voucher (MLM License)</h3>
              <p className="text-xs text-beige-muted mb-4">Issues a license for promoters to participate in the affiliate system + accelerator. No yield, no principal — just unlocks MLM + accelerator.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Recipient Address</label>
                  <input type="text" id="voucherRecipient" placeholder="0x..."
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                </div>
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Value (USDT — for accelerator % calc only)</label>
                  <div className="flex gap-2">
                    <button onClick={() => { (document.getElementById('voucherValue') as HTMLInputElement).value = '100'; }}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 whitespace-nowrap">$100</button>
                    <button onClick={() => { (document.getElementById('voucherValue') as HTMLInputElement).value = '1100'; }}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 whitespace-nowrap">$1,100</button>
                    <input type="number" id="voucherValue" placeholder="100"
                      className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Pool</label>
                  <select id="voucherPool" className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50">
                    <option value="0">Pool 0 — Starter (30d)</option>
                    <option value="1">Pool 1 — Growth (60d)</option>
                    <option value="2">Pool 2 — Pro (180d)</option>
                    <option value="3">Pool 3 — Elite (360d)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-beige-muted block mb-1">Expiry (days from now, 0 = never)</label>
                  <input type="number" id="voucherExpiry" placeholder="30"
                    className="w-full bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                </div>
              </div>
              <button onClick={async () => {
                const recipient = (document.getElementById('voucherRecipient') as HTMLInputElement).value;
                const valueUsd = Number((document.getElementById('voucherValue') as HTMLInputElement).value) || 0;
                const value = parseUnits(String(valueUsd), 18);
                const poolId = BigInt((document.getElementById('voucherPool') as HTMLSelectElement).value);
                const expiryDays = Number((document.getElementById('voucherExpiry') as HTMLInputElement).value) || 0;
                const expiry = expiryDays > 0 ? BigInt(Math.floor(Date.now() / 1000 + expiryDays * 86400)) : BigInt(0);
                if (!recipient.startsWith('0x') || recipient.length !== 42) return toast.error('Invalid address');
                if (value === BigInt(0)) return toast.error('Invalid value');
                await exec('Create Voucher', async () => {
                  await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'createVoucher', args: [recipient, poolId, value, expiry] });
                });
              }} disabled={pending === 'Create Voucher'}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 flex items-center gap-2">
                {pending === 'Create Voucher' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Create License
              </button>
            </motion.div>

            {/* Cancel Voucher */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Cancel Voucher</h3>
              <div className="flex gap-2">
                <input type="number" id="cancelVoucherId" placeholder="Voucher ID"
                  className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                <button onClick={async () => {
                  const id = BigInt((document.getElementById('cancelVoucherId') as HTMLInputElement).value || '0');
                  if (!confirm(`Cancel voucher #${id}?`)) return;
                  await exec('Cancel Voucher', async () => {
                    await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'cancelVoucher', args: [id] });
                  });
                }} disabled={pending === 'Cancel Voucher'}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-beige-muted mt-2">Only works if voucher hasn't been redeemed yet.</p>
            </motion.div>

            {/* Voucher Stats + List */}
            <motion.div variants={fadeUp} className="rounded-2xl glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Voucher Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted">Total Created</div>
                  <div className="text-lg font-bold text-gold">{voucherCount ? Number(voucherCount) : '0'}</div>
                </div>
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted">Total Active Value</div>
                  <div className="text-lg font-bold text-gold">${totalActiveVoucher ? (Number(totalActiveVoucher) / 1e18).toLocaleString() : '0'}</div>
                </div>
              </div>

              {/* Voucher List */}
              {voucherCount && Number(voucherCount) > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-beige-muted uppercase tracking-wider mb-2">Voucher Recipients</div>
                  {Array.from({ length: Math.min(Number(voucherCount), 50) }, (_, i) => (
                    <VoucherRow key={i} id={i} pending={pending} onAction={async (action, vid) => {
                      if (action === 'cancel') {
                        if (!confirm(`Cancel voucher #${vid}? This cannot be undone.`)) return;
                        await exec(`Cancel Voucher ${vid}`, async () => {
                          await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'cancelVoucher', args: [BigInt(vid)] });
                        });
                      }
                    }} />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-beige-muted text-center py-6">No vouchers issued yet.</div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ══ REFERRAL TAB ══ */}
        {activeTab === 'referral' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Zap className="h-5 w-5 text-gold" /> Presale Referral System</h3>
              <p className="text-sm text-beige-muted mb-4">Manage the 10% referral bonus wrapper. Buyers who enter via a referral link get 100% of their tokens, and the referrer earns 10% bonus in VYR from the reserve.</p>

              {/* CRITICAL: Wrapper Tax Exemption */}
              <WrapperFeeFix />

              {/* Wrapper Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted mb-1">Wrapper Contract</div>
                  <div className="text-sm font-mono text-gold">0xcA7Df2522b08453715372EEc33b40aB499d9B86C</div>
                </div>
                <div className="rounded-xl bg-dark-elevated p-4">
                  <div className="text-xs text-beige-muted mb-1">Reserve Balance</div>
                  <ReserveBalance />
                </div>
              </div>

              {/* Setup Steps */}
              <div className="space-y-4">
                <div className="rounded-xl border border-dark-border bg-dark-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-bold text-white">Step 1: Authorize Wrapper</div>
                      <div className="text-xs text-beige-muted">Allow the wrapper contract to transfer VYR tokens (needed while trading is locked).</div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setPending('Authorize');
                      try {
                        if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                        await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setAuthorized', args: [PRESALE_REFERRAL_ADDRESS, true] });
                        toast.success('Wrapper authorized!');
                      } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                      finally { setPending(null); }
                    }}
                    disabled={pending !== null}
                    className="w-full py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all disabled:opacity-50"
                  >
                    {pending === 'Authorize' ? 'Confirming...' : 'Authorize Wrapper'}
                  </button>
                </div>

                <div className="rounded-xl border border-dark-border bg-dark-elevated p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-bold text-white">Step 2: Fund Reserve with VYR</div>
                      <div className="text-xs text-beige-muted">Transfer VYR tokens from your wallet to the wrapper reserve. Enter the amount of VYR to send.</div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input id="fundAmount" type="number" placeholder="Amount in VYR (e.g. 30000000)" className="flex-1 bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
                    <button
                      onClick={async () => {
                        const amt = (document.getElementById('fundAmount') as HTMLInputElement).value;
                        if (!amt || parseFloat(amt) <= 0) return toast.error('Invalid amount');
                        setPending('Fund');
                        try {
                          if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                          // Step 1: Approve wrapper to spend VYR
                          await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'approve', args: [PRESALE_REFERRAL_ADDRESS, parseUnits(amt, 18)] });
                          toast.loading('Approved! Funding reserve...', { id: 'fund' });
                          // Step 2: Call fundReserve on wrapper
                          await writeContractAsync({ address: PRESALE_REFERRAL_ADDRESS, abi: ReferralABI, functionName: 'fundReserve', args: [parseUnits(amt, 18)] });
                          toast.success('Reserve funded!', { id: 'fund' });
                        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed', { id: 'fund' }); }
                        finally { setPending(null); }
                      }}
                      disabled={pending !== null}
                      className="px-6 py-2 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all disabled:opacity-50"
                    >
                      {pending === 'Fund' ? 'Confirming...' : 'Fund Reserve'}
                    </button>
                  </div>
                  <p className="text-xs text-green-400">✅ 10,000 VYR already funded from deployer. System is LIVE! Add more anytime.</p>
                </div>

                <div className="rounded-xl border border-dark-border bg-dark-elevated p-4">
                  <div className="text-sm font-bold text-white mb-2">Withdraw VYR from Wrapper</div>
                  <div className="text-xs text-beige-muted mb-3">Recover unused bonus tokens from the wrapper.</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input id="refWithdrawTo" type="text" placeholder="Recipient address (0x...)" className="flex-1 bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
                    <input id="refWithdrawAmount" type="number" placeholder="Amount VYR" className="w-full sm:w-40 bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
                    <button
                      onClick={async () => {
                        const to = (document.getElementById('refWithdrawTo') as HTMLInputElement).value;
                        const amt = (document.getElementById('refWithdrawAmount') as HTMLInputElement).value;
                        if (!to.startsWith('0x') || to.length !== 42) return toast.error('Invalid address');
                        if (!amt || parseFloat(amt) <= 0) return toast.error('Invalid amount');
                        setPending('Withdraw');
                        try {
                          if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                          await writeContractAsync({ address: PRESALE_REFERRAL_ADDRESS, abi: ReferralABI, functionName: 'withdrawVYR', args: [to, parseUnits(amt, 18)] });
                          toast.success('Withdrawn!');
                        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                        finally { setPending(null); }
                      }}
                      disabled={pending !== null}
                      className="px-6 py-2 text-sm font-bold rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ══ LOTTERY TAB ══ */}
        {activeTab === 'lottery' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            <LotteryAdminSection
              writeContractAsync={writeContractAsync}
              pending={pending}
              setPending={setPending}
            />
          </motion.div>
        )}
        {/* ══ AUCTION TAB ══ */}
        {activeTab === 'auction' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            <AuctionAdminSection
              writeContractAsync={writeContractAsync}
              pending={pending}
              setPending={setPending}
            />
          </motion.div>
        )}
        {/* ══ ARBITRAGE TAB ══ */}
        {activeTab === 'arbitrage' && (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            <motion.div variants={fadeUp} className="rounded-2xl border border-gold/30 bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gold" /> Arbitrage Platform
              </h3>
              <p className="text-sm text-beige-muted mb-4">Real-time AI arbitrage monitoring dashboard.</p>
              <div className="rounded-xl overflow-hidden border border-dark-border" style={{ height: '80vh' }}>
                <iframe
                  src="https://arb.vyronx.io"
                  title="VyronX Arbitrage Dashboard"
                  className="w-full h-full"
                  style={{ border: 'none', background: '#0a0a0a' }}
                  allowFullScreen
                />
              </div>
            </motion.div>
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
            <TransferOwnershipCard label="Staking V4" addr={STAKING_ADDRESS} abi={StakingABI} pending={pending} exec={exec} writeContractAsync={writeContractAsync} />

            {/* Staking Wallets */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Staking Wallets & Fees</h3>

              {/* CHANGE #7: Configurable withdrawal fee */}
              <div className="rounded-xl bg-gold/5 border border-gold/20 p-4 mb-4">
                <label className="text-xs text-gold block mb-1">Withdrawal Fee (currently 4%, max 10%)</label>
                <div className="flex gap-2">
                  <input type="number" id="newFeeBps" placeholder="e.g. 4 (for 4%)" min="0" max="10"
                    className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                  <button onClick={async () => {
                    const val = parseFloat((document.getElementById('newFeeBps') as HTMLInputElement).value);
                    if (isNaN(val) || val < 0 || val > 10) return toast.error('Enter 0-10');
                    await exec('Set Fee', async () => {
                      await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setWithdrawalFee', args: [BigInt(Math.round(val * 100))] });
                    });
                  }} disabled={pending === 'Set Fee'}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark disabled:opacity-50">
                    {pending === 'Set Fee' ? '...' : 'Set Fee %'}
                  </button>
                </div>
              </div>

              {/* V4: Configurable accelerator + commission fees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
                  <label className="text-xs text-gold block mb-1">Accelerator Commission (currently 10%, max 20%)</label>
                  <div className="flex gap-2">
                    <input type="number" id="newAccComm" placeholder="e.g. 10 (for 10%)" min="0" max="20"
                      className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                    <button onClick={async () => {
                      const val = parseFloat((document.getElementById('newAccComm') as HTMLInputElement).value);
                      if (isNaN(val) || val < 0 || val > 20) return toast.error('Enter 0-20');
                      await exec('Set Acc Comm', async () => {
                        await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setAcceleratorCommBps', args: [BigInt(Math.round(val * 100))] });
                      });
                    }} disabled={pending === 'Set Acc Comm'}
                      className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark disabled:opacity-50">
                      {pending === 'Set Acc Comm' ? '...' : 'Set Acc %'}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
                  <label className="text-xs text-gold block mb-1">Commission Fee (currently 4%, max 10%)</label>
                  <div className="flex gap-2">
                    <input type="number" id="newCommFee" placeholder="e.g. 4 (for 4%)" min="0" max="10"
                      className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50" />
                    <button onClick={async () => {
                      const val = parseFloat((document.getElementById('newCommFee') as HTMLInputElement).value);
                      if (isNaN(val) || val < 0 || val > 10) return toast.error('Enter 0-10');
                      await exec('Set Comm Fee', async () => {
                        await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setCommFeeBps', args: [BigInt(Math.round(val * 100))] });
                      });
                    }} disabled={pending === 'Set Comm Fee'}
                      className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark disabled:opacity-50">
                      {pending === 'Set Comm Fee' ? '...' : 'Set Comm Fee %'}
                    </button>
                  </div>
                </div>
              </div>

              {/* V5: Affiliate Levels editor (11 levels) */}
              <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4 mt-4">
                <label className="text-xs text-purple-300 block mb-2 font-bold">AFFILIATE LEVELS (V5 — commission %, min stake USDT, min direct referrals)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Array.from({ length: 11 }, (_, i) => i).map((lvl) => (
                    <div key={lvl} className="flex items-center gap-1">
                      <span className="text-xs text-beige-muted w-10">Lv {lvl + 1}</span>
                      <input type="number" id={`lvlBps${lvl}`} placeholder="bps" min="0" max="1000"
                        className="w-full bg-dark-elevated border border-dark-border rounded px-2 py-1.5 text-xs text-white" />
                      <input type="number" id={`lvlStake${lvl}`} placeholder="min $" min="1"
                        className="w-full bg-dark-elevated border border-dark-border rounded px-2 py-1.5 text-xs text-white" />
                      <input type="number" id={`lvlDir${lvl}`} placeholder="directs" min="0" max="50"
                        className="w-full bg-dark-elevated border border-dark-border rounded px-2 py-1.5 text-xs text-white" />
                      <button onClick={async () => {
                        const bps = parseFloat((document.getElementById(`lvlBps${lvl}`) as HTMLInputElement).value);
                        const stake = parseFloat((document.getElementById(`lvlStake${lvl}`) as HTMLInputElement).value);
                        const dirs = parseFloat((document.getElementById(`lvlDir${lvl}`) as HTMLInputElement).value);
                        if (isNaN(bps) || isNaN(stake) || isNaN(dirs)) return toast.error('Fill all 3 fields');
                        await exec(`Set Level ${lvl + 1}`, async () => {
                          await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setAffiliateLevel',
                            args: [BigInt(lvl), BigInt(Math.round(bps)), BigInt(Math.floor(stake * 1e18)), BigInt(Math.round(dirs))] });
                        });
                      }} disabled={pending === `Set Level ${lvl + 1}`}
                        className="px-2 py-1.5 text-xs font-bold rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 disabled:opacity-50">
                        {pending === `Set Level ${lvl + 1}` ? '...' : 'Set'}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-purple-500/20">
                  <label className="text-xs text-purple-300 block mb-1">Qualified Direct Min (USDT staked sum — default $100)</label>
                  <div className="flex gap-2">
                    <input type="number" id="qualDirMin" placeholder="e.g. 100" min="1"
                      className="flex-1 bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
                    <button onClick={async () => {
                      const val = parseFloat((document.getElementById('qualDirMin') as HTMLInputElement).value);
                      if (isNaN(val) || val <= 0) return toast.error('Enter a value > 0');
                      await exec('Set Qual Direct Min', async () => {
                        await writeContractAsync({ address: STAKING_ADDRESS, abi: StakingABI, functionName: 'setQualifiedDirectMin', args: [BigInt(Math.floor(val * 1e18))] });
                      });
                    }} disabled={pending === 'Set Qual Direct Min'}
                      className="px-4 py-2 text-sm font-bold rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 disabled:opacity-50">
                      {pending === 'Set Qual Direct Min' ? '...' : 'Set'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-beige-muted block mb-1">New Fee Wallet</label>
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
                const amount = parseUnits(String((document.getElementById('withdrawVyrAmount') as HTMLInputElement).value || '0'), 18);
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
function GateScreen({ icon: Icon, title, subtitle, danger, extra, showConnect }: { icon: typeof Lock; title: string; subtitle: string; danger?: boolean; extra?: string; showConnect?: boolean }) {
  const { connectors, connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
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
        <p className="text-beige-muted mb-6">{subtitle}</p>
        {showConnect && (
          <div className="flex flex-col gap-3 items-center">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={async () => { await connectAsync({ connector }); }}
                className="px-6 py-3 rounded-xl bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 font-bold flex items-center gap-2"
              >
                Connect with {connector.name}
              </button>
            ))}
          </div>
        )}
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

function VoucherRow({ id, onAction, pending }: { id: number; onAction: (action: string, id: number) => void; pending: string | null }) {
  // V3 struct: recipient, poolId, usdtValue, expiry, redeemed, cancelled
  const { data } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'vouchers', args: [BigInt(id)], chainId: bsc.id,
  }) as { data: readonly [string, bigint, bigint, bigint, boolean, boolean] | undefined };

  if (!data) return null;
  const [recipient, poolId, usdtValue, expiry, redeemed, cancelled] = data;

  // Status: redeemed=Activated by promoter, cancelled=Revoked by owner
  let status = 'Pending';
  let statusColor = 'text-amber-400 bg-amber-500/10';
  if (cancelled) { status = 'Cancelled'; statusColor = 'text-red-400 bg-red-500/10'; }
  else if (redeemed) { status = 'Active'; statusColor = 'text-green-400 bg-green-500/10'; }
  else if (Number(expiry) > 0 && Number(expiry) < Math.floor(Date.now() / 1000)) { status = 'Expired'; statusColor = 'text-red-400 bg-red-500/10'; }

  return (
    <div className="flex items-center justify-between rounded-lg bg-dark-elevated p-3 gap-2 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs text-beige-muted shrink-0">#{id}</span>
        <a href={`https://bscscan.com/address/${recipient}`} target="_blank" rel="noreferrer" className="text-sm font-mono text-gold hover:text-gold-light truncate">
          {recipient.slice(0, 8)}...{recipient.slice(-4)}
        </a>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <span className="text-xs text-purple-400/70">${(Number(usdtValue) / 1e18).toLocaleString()}</span>
        <span className="text-xs text-beige-muted">P{Number(poolId)}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{status}</span>
        {!cancelled && (
          <button
            onClick={() => onAction('cancel', id)}
            disabled={pending !== null}
            className="text-xs px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {pending === `Cancel Voucher ${id}` ? '...' : redeemed ? 'Revoke' : 'Cancel'}
          </button>
        )}
      </div>
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

function shortAddr(a?: string): string {
  return a && a.startsWith('0x') && a.length === 42 ? `${a.slice(0, 6)}...${a.slice(-4)}` : '...';
}

function AddrRow({ label, addr }: { label: string; addr: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-dark-elevated p-3">
      <span className="text-sm text-beige-muted">{label}</span>
      <a href={`https://bscscan.com/address/${addr}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-gold hover:text-gold-light text-xs font-mono">
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

// ═══ Reserve Balance Component ═══
function ReserveBalance() {
  const { data } = useReadContract({
    address: PRESALE_REFERRAL_ADDRESS, abi: ReferralABI, functionName: 'reserveBalance', chainId: bsc.id,
  }) as { data: bigint | undefined };

  if (!data) return <div className="text-sm text-beige-muted">Loading...</div>;
  const balance = Number(formatUnits(data, 18));
  return (
    <div className="text-lg font-bold text-gold">
      {balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} VYR
    </div>
  );
}

// ═══ V2 Migration Banner with real-time status ═══
function V2MigrationBanner({ pending, setPending, exec }: { pending: string | null; setPending: (v: string | null) => void; exec: (label: string, fn: () => Promise<void>) => Promise<void> }) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  // Read V3 balance (source of migration)
  const { data: v3Balance } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'balanceOf', args: [STAKING_V1_ADDRESS], chainId: bsc.id,
  });
  // Read V4 balance (destination)
  const { data: v4Balance } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'balanceOf', args: [STAKING_ADDRESS], chainId: bsc.id,
  });

  // Step 0: Exclude V3 from FEES (CRITICAL — prevents 8% tax on transfer)
  const { data: v3FeeExcluded } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'isExcludedFromFees', args: [STAKING_V1_ADDRESS], chainId: bsc.id,
  });
  // Step 1: Authorize V4
  const { data: v4Authorized } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'isAuthorized', args: [STAKING_ADDRESS], chainId: bsc.id,
  });
  // Step 2: Exclude V4 from FEES (CRITICAL — V4 payouts don't lose 8%)
  const { data: v4FeeExcluded } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'isExcludedFromFees', args: [STAKING_ADDRESS], chainId: bsc.id,
  });
  // Step 3: Exclude V4 from limits (for large payouts)
  const { data: v4LimitsRemoved } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'isExcludedFromLimits', args: [STAKING_ADDRESS], chainId: bsc.id,
  });

  const step0Done = v3FeeExcluded === true;
  const step1Done = v4Authorized === true;
  const step2Done = v4FeeExcluded === true;
  const step3Done = v4LimitsRemoved === true;
  const step4Done = v4Balance != null && BigInt(String(v4Balance)) > BigInt(0);
  const allDone = step0Done && step1Done && step2Done && step3Done && step4Done;

  const transferAmount = v3Balance ? String(BigInt(String(v3Balance)) / BigInt(10**18)) : '432400000';

  if (allDone) {
    return (
      <motion.div variants={fadeUp} className="rounded-2xl border border-green-500/40 bg-green-500/5 p-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500/20 border border-green-500/40">
            <Check className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-green-400">✅ Staking V5 Ativo!</h3>
            <p className="text-xs text-beige-muted">Migração concluída. V5 tem {v4Balance ? Number(BigInt(String(v4Balance)) / BigInt(10**18)).toLocaleString() : 0} VYR.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-gold/40 bg-gradient-to-b from-dark-card to-gold/10 p-6 glow-gold">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-5 w-5 text-gold" />
        <h3 className="text-base font-bold text-gold">Staking V5 Migration — Action Required</h3>
      </div>
      <p className="text-xs text-beige-muted mb-4">Complete all 5 steps IN ORDER. Each step prevents supply loss. V4 has {v3Balance ? Number(BigInt(String(v3Balance)) / BigInt(10**18)).toLocaleString() : '?'} VYR.</p>

      <div className="space-y-3">
        {/* Step 0: Exclude V3 from FEES (CRITICAL) */}
        <div className={`rounded-xl p-4 border ${step0Done ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {step0Done && <Check className="h-4 w-4 text-green-400" />}
                Step 0: Exclude V4 from Transfer Fees
              </div>
              <div className="text-xs text-beige-muted mt-1">CRITICAL — Without this, the 8% buy/sell tax applies to the V4→V5 transfer, destroying supply.</div>
            </div>
            {step0Done && <span className="text-xs font-bold text-green-400">✓ DONE</span>}
          </div>
          {!step0Done && (
            <button
              onClick={async () => {
                setPending('Exclude V4 Fees');
                try {
                  if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                  await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setExcludedFromFees', args: [STAKING_V1_ADDRESS, true] });
                  toast.success('Step 0 concluído! ✅ V4 isento de taxas.');
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                finally { setPending(null); }
              }}
              disabled={pending !== null}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
            >
              {pending === 'Exclude V4 Fees' ? 'Confirming...' : 'Exclude V4 from Fees'}
            </button>
          )}
        </div>

        {/* Step 1: Authorize V4 */}
        <div className={`rounded-xl p-4 border ${step1Done ? 'border-green-500/40 bg-green-500/5' : step0Done ? 'border-gold/30 bg-dark-elevated' : 'border-dark-border bg-dark-elevated opacity-60'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {step1Done && <Check className="h-4 w-4 text-green-400" />}
                Step 1: Authorize V5 Contract
              </div>
              <div className="text-xs text-beige-muted">Allow V5 to interact with the Token contract.</div>
            </div>
            {step1Done && <span className="text-xs font-bold text-green-400">✓ DONE</span>}
          </div>
          {!step1Done && (
            <button
              onClick={async () => {
                setPending('Auth V5');
                try {
                  if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                  await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setAuthorized', args: [STAKING_ADDRESS, true] });
                  toast.success('Step 1 concluído! ✅ V5 autorizado.');
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                finally { setPending(null); }
              }}
              disabled={pending !== null || !step0Done}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all disabled:opacity-50"
            >
              {pending === 'Auth V5' ? 'Confirming...' : 'Authorize V5'}
            </button>
          )}
        </div>

        {/* Step 2: Exclude V4 from FEES (CRITICAL) */}
        <div className={`rounded-xl p-4 border ${step2Done ? 'border-green-500/40 bg-green-500/5' : step1Done ? 'border-red-500/40 bg-red-500/5' : 'border-dark-border bg-dark-elevated opacity-60'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {step2Done && <Check className="h-4 w-4 text-green-400" />}
                Step 2: Exclude V5 from Transfer Fees
              </div>
              <div className="text-xs text-beige-muted mt-1">CRITICAL — Without this, V5 loses 8% on every reward payout to stakers.</div>
            </div>
            {step2Done && <span className="text-xs font-bold text-green-400">✓ DONE</span>}
          </div>
          {!step2Done && step1Done && (
            <button
              onClick={async () => {
                setPending('Exclude V5 Fees');
                try {
                  if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                  await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setExcludedFromFees', args: [STAKING_ADDRESS, true] });
                  toast.success('Step 2 concluído! ✅ V5 isento de taxas.');
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                finally { setPending(null); }
              }}
              disabled={pending !== null}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
            >
              {pending === 'Exclude V5 Fees' ? 'Confirming...' : 'Exclude V5 from Fees'}
            </button>
          )}
        </div>

        {/* Step 3: Exclude V4 from limits */}
        <div className={`rounded-xl p-4 border ${step3Done ? 'border-green-500/40 bg-green-500/5' : step2Done ? 'border-amber-500/30 bg-dark-elevated' : 'border-dark-border bg-dark-elevated opacity-60'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {step3Done && <Check className="h-4 w-4 text-green-400" />}
                Step 3: Exclude V5 from Tx Limits
              </div>
              <div className="text-xs text-beige-muted">Required so V5 can pay large staking rewards without hitting the 10M maxTx limit.</div>
            </div>
            {step3Done && <span className="text-xs font-bold text-green-400">✓ DONE</span>}
          </div>
          {!step3Done && step2Done && (
            <button
              onClick={async () => {
                setPending('V5 Limits');
                try {
                  if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                  await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setExcludedFromLimits', args: [STAKING_ADDRESS, true] });
                  toast.success('Step 3 concluído! ✅ V5 sem limites.');
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                finally { setPending(null); }
              }}
              disabled={pending !== null}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all disabled:opacity-50"
            >
              {pending === 'V5 Limits' ? 'Confirming...' : 'Exclude V5 from Limits'}
            </button>
          )}
        </div>

        {/* Step 4: Transfer VYR */}
        <div className={`rounded-xl p-4 border ${step4Done ? 'border-green-500/40 bg-green-500/5' : step3Done ? 'border-gold/30 bg-dark-elevated' : 'border-dark-border bg-dark-elevated opacity-60'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {step4Done && <Check className="h-4 w-4 text-green-400" />}
                Step 4: Transfer {transferAmount} VYR (V4 → V5)
              </div>
              <div className="text-xs text-beige-muted">Move all reward tokens from V4 to V5. Zero supply loss — fees are exempt.</div>
            </div>
            {step4Done && <span className="text-xs font-bold text-green-400">✓ DONE</span>}
          </div>
          {!step4Done && step3Done && (
            <button
              onClick={async () => {
                setPending('Migrate VYR');
                try {
                  if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
                  await writeContractAsync({ address: STAKING_V1_ADDRESS, abi: StakingABI, functionName: 'withdrawVYRTokens', args: [STAKING_ADDRESS, parseUnits(transferAmount, 18)] });
                  toast.success(`Step 4 concluído! ✅ ${transferAmount} VYR transferidos.`);
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                finally { setPending(null); }
              }}
              disabled={pending !== null || !step3Done}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all disabled:opacity-50"
            >
              {pending === 'Migrate VYR' ? 'Confirming...' : `Transfer ${transferAmount} VYR`}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══ VOUCHER MIGRATION COMPONENT ═══
function VoucherMigration({ pending, setPending }: { pending: string | null; setPending: (v: string | null) => void }) {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  // Check if vouchers already migrated
  const { data: voucherCount } = useReadContract({
    address: STAKING_ADDRESS, abi: StakingABI, functionName: 'getVoucherCount', chainId: bsc.id,
  });

  const migrated = voucherCount != null && Number(voucherCount) >= 23;
  // 23 vouchers extracted on-chain from V4 0xeAEA (all $1,100, Elite, referrer chain preserved)
  const vouchers = [
    {recipient: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', poolId: 3, usdtValue: '1100', referrer: '0x77619322427f006b14DA3Dbb25F9eb420372f7c7', name: 'Conta Mãe'},
    {recipient: '0xEd324c73fae8bCbC3318123a025ec47A41E20b71', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Thiago'},
    {recipient: '0xB863C989b252749f89d14086fabB40E5f17ab77D', poolId: 3, usdtValue: '1100', referrer: '0xEd324c73fae8bCbC3318123a025ec47A41E20b71', name: 'Ind. Thiago'},
    {recipient: '0x5b4b91aA04e2722ebAF4A6090970c1c92BEe1090', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 3'},
    {recipient: '0xd7A8484fD713D28870FCd4ad198fAB9e3ffDedB1', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Deployer'},
    {recipient: '0xB783cC9C7785caf201d77167eCB60f381AAca9d9', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 5'},
    {recipient: '0x470a2608fa72f823d4C32Bf32f3ea318fb995c6E', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 6'},
    {recipient: '0x11B9aF1e89C2c51aB39be59Ea248Cb6a495Cb84e', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 7'},
    {recipient: '0x301892e42aE40327856bb676B1e7c2e4C4B7392c', poolId: 3, usdtValue: '1100', referrer: '0x11B9aF1e89C2c51aB39be59Ea248Cb6a495Cb84e', name: 'Ind. Promotor 7'},
    {recipient: '0x28c438cb3Ab95B6dEE755A3f3570943b52C7b0F4', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 8'},
    {recipient: '0x3b791FF255AD221475e5551FfE0FB605b9753257', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 9'},
    {recipient: '0xC06cedf252139469B797b719B97C0541dab7aC77', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 10'},
    {recipient: '0x9D173220DA490ea1374F818106707D6a749fe700', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 11'},
    {recipient: '0x8986e36a8814b3783c0C4034654708115349b356', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 12'},
    {recipient: '0x3A23c096eab6bB2Fc09921eb22998Ae37E9C2F7b', poolId: 3, usdtValue: '1100', referrer: '0x28c438cb3Ab95B6dEE755A3f3570943b52C7b0F4', name: 'Ind. Promotor 8'},
    {recipient: '0xE42Ea653Be137954b0bFF7193c06A363CEccbB3b', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 13'},
    {recipient: '0xF077609b70baF4eA503E54D1731d65eB4eBB149e', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 14'},
    {recipient: '0x9Db81f4E9CdD28C1497cC147bE36055A8859E034', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 15'},
    {recipient: '0x9A38A4b356536302fdF80A114C70cbC5a9A3E8d1', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 16'},
    {recipient: '0xa3Ebe62F3493DEfe02F828183796d26b39312C51', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 17'},
    {recipient: '0x76a5cbf390Cb72AC820857FAA7f8F5a9152B579C', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 18'},
    {recipient: '0xd784b8c7B8ADCF81dEEAbB75883656a39728C4B0', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 19'},
    {recipient: '0xe9A61001c79287C300378F5caB528baec36274Cd', poolId: 3, usdtValue: '1100', referrer: '0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c', name: 'Promotor 20'},
  ];

  if (migrated) {
    return null; // Already done, hide component
  }

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-6">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-5 w-5 text-purple-400" />
        <h3 className="text-base font-bold text-purple-400">Voucher Migration (V4 → V5)</h3>
      </div>
      <p className="text-xs text-beige-muted mb-4">
        Migrates all 23 vouchers from V4 with the full referral chain intact. Each voucher keeps its $1,100 value, Elite pool, MLM position, and accelerator entry. Users don&apos;t need to re-activate.
      </p>

      {/* Preview */}
      <div className="rounded-xl bg-dark-elevated border border-dark-border p-3 mb-4 max-h-48 overflow-y-auto">
        {vouchers.map((v, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-dark-border/30 last:border-0">
            <span className="text-purple-400 font-bold w-6">#{i}</span>
            <span className="text-white font-mono flex-1">{v.recipient.slice(0, 6)}...{v.recipient.slice(-4)}</span>
            <span className="text-beige-muted">{v.name}</span>
            <span className="text-gold">↑ {v.referrer.slice(0, 6)}...{v.referrer.slice(-4)}</span>
          </div>
        ))}
      </div>

      <button
        onClick={async () => {
          setPending('Migrate Vouchers');
          try {
            if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
            await writeContractAsync({
              address: STAKING_ADDRESS,
              abi: StakingABI,
              functionName: 'migrateVoucherBatch',
              args: [
                vouchers.map(v => v.recipient as `0x${string}`),
                vouchers.map(v => BigInt(v.poolId)),
                vouchers.map(v => parseUnits(v.usdtValue, 18)),
                vouchers.map(v => v.referrer as `0x${string}`),
              ],
            });
            toast.success('Vouchers migrados! ✅ 23 vouchers ativos no V5.');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed');
          } finally {
            setPending(null);
          }
        }}
        disabled={pending !== null}
        className="w-full sm:w-auto px-6 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:shadow-lg hover:shadow-purple-500/40 transition-all disabled:opacity-50"
      >
        {pending === 'Migrate Vouchers' ? 'Confirming...' : 'Migrate 23 Vouchers'}
      </button>
    </motion.div>
  );
}

// ═══ WRAPPER FEE FIX COMPONENT ═══
function WrapperFeeFix() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  const { data: feeExcluded, refetch: ref1 } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'isExcludedFromFees', args: [PRESALE_REFERRAL_ADDRESS], chainId: bsc.id,
  });
  const { data: limitExcluded, refetch: ref2 } = useReadContract({
    address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'isExcludedFromLimits', args: [PRESALE_REFERRAL_ADDRESS], chainId: bsc.id,
  });

  const feeDone = feeExcluded === true;
  const limitDone = limitExcluded === true;
  const allDone = feeDone && limitDone;

  const exec = async (label: string, fn: () => Promise<any>) => {
    setBusy(true);
    const id = toast.loading(`${label}...`);
    try {
      if (chainId !== bsc.id) await switchChainAsync({ chainId: bsc.id });
      await fn();
      toast.success(`${label} — Done! ✅`, { id });
      setTimeout(() => { ref1(); ref2(); }, 2000);
    } catch (e: any) {
      toast.error(e?.shortMessage || 'Failed', { id, duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  if (allDone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-2xl border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/5 p-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40">
            <Check className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-green-400">Referral System Active</div>
            <div className="text-xs text-beige-muted">Buyers receive 100% tokens. Referrers get 10% bonus. Zero tax deduction.</div>
          </div>
        </div>
      </motion.div>
    );
  }

  const steps = [
    { done: feeDone, label: 'Exempt Wrapper from Transfer Fees', desc: 'Stops the 8% tax on referral purchases', icon: 1, color: 'red' },
    { done: limitDone, label: 'Exempt Wrapper from Transaction Limits', desc: 'Allows large referral distributions', icon: 2, color: 'amber' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-red-500/30 bg-gradient-to-b from-red-500/10 to-transparent p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-400" />
        </div>
        <div>
          <div className="text-sm font-bold text-red-400">Setup Required</div>
          <div className="text-xs text-beige-muted">2 steps to activate 100% token delivery on referral purchases</div>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
            s.done ? 'border-green-500/30 bg-green-500/5' : 'border-dark-border bg-dark-elevated'
          }`}>
            <div className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-xs font-bold ${
              s.done ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {s.done ? <Check className="w-4 h-4" /> : s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{s.label}</div>
              <div className="text-xs text-beige-muted">{s.desc}</div>
            </div>
            {!s.done && (
              <button
                onClick={() => exec(s.label, async () => {
                  if (s.icon === 1) {
                    await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setExcludedFromFees', args: [PRESALE_REFERRAL_ADDRESS, true] });
                  } else {
                    await writeContractAsync({ address: TOKEN_ADDRESS, abi: TokenABI, functionName: 'setExcludedFromLimits', args: [PRESALE_REFERRAL_ADDRESS, true] });
                  }
                })}
                disabled={busy || (s.icon === 2 && !feeDone)}
                className="shrink-0 px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute'}
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
