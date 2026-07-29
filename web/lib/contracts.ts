// ════════════════════════════════════════════════════════════
// VyronX Contract Configuration
// ════════════════════════════════════════════════════════════

import VyronXTokenABI from './abi/VyronXToken.json';
import VyronXPresaleABI from './abi/VyronXPresale.json';
import VyronXStakingABI from './abi/VyronXStaking.json';

export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;
export const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS as `0x${string}`;
export const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_ADDRESS as `0x${string}`;
export const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`;

export const TokenABI = VyronXTokenABI;
export const PresaleABI = VyronXPresaleABI;
export const StakingABI = VyronXStakingABI;

// Chain config
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';

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
