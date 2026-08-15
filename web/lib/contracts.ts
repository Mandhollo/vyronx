// ════════════════════════════════════════════════════════════
// VyronX Contract Configuration
// ════════════════════════════════════════════════════════════

import VyronXTokenABI from './abi/VyronXToken.json';
import VyronXPresaleABI from './abi/VyronXPresale.json';
import VyronXStakingV5ABI from './abi/VyronXStakingV5.json';
import PresaleReferralABI from './abi/PresaleReferral.json';
import VyronXLotteryABI from './abi/VyronXLottery.json';
import VyronXAuctionABI from './abi/VyronXAuction.json';

export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;
export const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS as `0x${string}`;
export const STAKING_ADDRESS = '0xc9c5680487f1EFEEAb5F1aDF31D3D110FabA9aB4' as `0x${string}`; // Staking V5 (11 directs cap) — hardcoded
// Previous V4 (0xeAEA) holds 432.4M VYR — needs to migrate to V5 (0x94E0)
export const STAKING_V1_ADDRESS = '0xeAEAd8DAe5234Ef82B40F308006faB2c7FFF3A9A';
export const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`;
export const PRESALE_REFERRAL_ADDRESS = (process.env.NEXT_PUBLIC_PRESALE_REFERRAL_ADDRESS || '0xcA7Df2522b08453715372EEc33b40aB499d9B86C') as `0x${string}`;
export const LOTTERY_ADDRESS = (process.env.NEXT_PUBLIC_LOTTERY_ADDRESS || '0x22293B30effD86A99A173314914454CaD95AA992') as `0x${string}`;
// Penny auction — DEPLOYED on BSC mainnet
export const AUCTION_ADDRESS = (process.env.NEXT_PUBLIC_AUCTION_ADDRESS || '0xDB266a8f6E3FACa62F396Ad91bc8b54075eC8536') as `0x${string}`;

export const TokenABI = VyronXTokenABI;
export const PresaleABI = VyronXPresaleABI;
export const StakingABI = VyronXStakingV5ABI;
export const ReferralABI = PresaleReferralABI;
export const LotteryABI = VyronXLotteryABI;
export const AuctionABI = VyronXAuctionABI;

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
