// ════════════════════════════════════════════════════════════
// VyronX Contract Configuration
// ════════════════════════════════════════════════════════════

import VyronXTokenABI from './abi/VyronXToken.json';
import VyronXPresaleABI from './abi/VyronXPresale.json';
import VyronXStakingV4ABI from './abi/VyronXStakingV4.json';
import PresaleReferralABI from './abi/PresaleReferral.json';
import VyronXLotteryABI from './abi/VyronXLottery.json';

export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;
export const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS as `0x${string}`;
export const STAKING_ADDRESS = '0xeAEAd8DAe5234Ef82B40F308006faB2c7FFF3A9A' as `0x${string}`; // Staking V4 (fixed) — hardcoded
// Previous V4 (0x32fa) holds 432.4M VYR — needs to migrate to new V4 (0xeAEA)
export const STAKING_V1_ADDRESS = '0x32fa9BFdD3b8BA0938148A8f0c2DA3C56395EDa6';
export const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`;
export const PRESALE_REFERRAL_ADDRESS = (process.env.NEXT_PUBLIC_PRESALE_REFERRAL_ADDRESS || '0xcA7Df2522b08453715372EEc33b40aB499d9B86C') as `0x${string}`;
export const LOTTERY_ADDRESS = (process.env.NEXT_PUBLIC_LOTTERY_ADDRESS || '0x22293B30effD86A99A173314914454CaD95AA992') as `0x${string}`;

export const TokenABI = VyronXTokenABI;
export const PresaleABI = VyronXPresaleABI;
export const StakingABI = VyronXStakingV4ABI;
export const ReferralABI = PresaleReferralABI;
export const LotteryABI = VyronXLotteryABI;

// Chain config
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 56);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org';

// Token info
export const TOKEN_INFO = {
  name: 'VyronX',
  symbol: 'VYR',
  decimals: 18,
  totalSupply: '1,000,000,000',
  network: 'BSC Testnet',
};

// Staking pools info
export const STAKING_POOLS = [
  { id: 0, tier: 'Starter', duration: '30 Days', dailyRate: 0.11, monthlyRate: '~3.5%', lockDays: 30, minStake: 50 },
  { id: 1, tier: 'Growth', duration: '60 Days', dailyRate: 0.23, monthlyRate: '~7%', lockDays: 60, minStake: 50 },
  { id: 2, tier: 'Pro', duration: '180 Days', dailyRate: 0.33, monthlyRate: '~10%', lockDays: 180, minStake: 100 },
  { id: 3, tier: 'Elite', duration: '360 Days', dailyRate: 0.50, monthlyRate: '~15%', lockDays: 360, minStake: 100 },
];
