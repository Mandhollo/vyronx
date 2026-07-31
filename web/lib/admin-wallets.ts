/**
 * Authorized admin wallets.
 * Only these wallets can access /admin.
 * To add more, just append to this array.
 */
export const ADMIN_WALLETS: readonly string[] = [
  '0xd7a8484fd713d28870fcd4ad198fab9e3ffdedb1', // Anderson
].map((a) => a.toLowerCase());

export function isAdminWallet(address?: string): boolean {
  if (!address) return false;
  return ADMIN_WALLETS.includes(address.toLowerCase());
}
