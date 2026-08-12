/**
 * Authorized admin wallets.
 * Only these wallets can access /admin.
 * To add more, just append to this array.
 */
export const ADMIN_WALLETS: readonly string[] = [
  '0xd7a8484fd713d28870fcd4ad198fab9e3ffdedb1', // Anderson (deployer)
  '0x77619322427f006b14DA3Dbb25F9eb420372f7c7', // Anderson (new owner)
].map((a) => a.toLowerCase());

/**
 * Fee wallet holders — can only access the Arbitrage tab in /admin.
 * These are the 4 wallets that receive the 8% sell tax (in BNB).
 */
export const FEE_WALLETS: readonly string[] = [
  '0x9d7f20ebb6c5d73a4ca57e53e97fe2707fcce720', // Collaborators
  '0x76681cccEb9F03d2a054211df8FEEbcbfE817521', // Infrastructure
  '0x5dBB4282cadE4C3f38F1Ff73c2141Ab0402b5eD3', // Development
  '0xe9A61001c79287C300378F5caB528baec36274Cd', // Marketing
].map((a) => a.toLowerCase());

export function isAdminWallet(address?: string): boolean {
  if (!address) return false;
  return ADMIN_WALLETS.includes(address.toLowerCase());
}

export function isFeeWallet(address?: string): boolean {
  if (!address) return false;
  return FEE_WALLETS.includes(address.toLowerCase());
}
