/**
 * Referral code encoding/decoding.
 * Converts a wallet address into a short random-looking code
 * so the wallet is not exposed in the referral link.
 *
 * Encoding: hex address → XOR with secret salt → base62 encode → "VYR" prefix
 * This is NOT cryptographic security — it just obfuscates the address
 * from casual inspection of the URL.
 */

const SALT = 'VyronX2026DeFiBSC';

// Simple XOR between hex string and salt (repeating)
function xorHex(hexStr: string, salt: string): string {
  let result = '';
  for (let i = 0; i < hexStr.length; i++) {
    const charCode = hexStr.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
    result += charCode.toString(16).padStart(2, '0');
  }
  return result;
}

// Base62 encode for compactness
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function toBase62(num: bigint): string {
  if (num === BigInt(0)) return '0';
  let result = '';
  while (num > 0) {
    result = BASE62[Number(num % BigInt(62))] + result;
    num = num / BigInt(62);
  }
  return result;
}

function fromBase62(str: string): bigint {
  let num = BigInt(0);
  for (const char of str) {
    const idx = BASE62.indexOf(char);
    if (idx === -1) return BigInt(0);
    num = num * BigInt(62) + BigInt(idx);
  }
  return num;
}

/**
 * Encode a wallet address into a short referral code.
 * Example: 0xd7A8...DedB1 → VYR8K3mP9xQ2wR
 */
export function encodeReferralCode(address: string): string {
  const clean = address.toLowerCase().replace('0x', '');
  const xored = xorHex(clean, SALT);
  const num = BigInt('0x' + xored);
  const encoded = toBase62(num);
  return 'VYR' + encoded;
}

/**
 * Decode a referral code back into a wallet address.
 * Example: VYR8K3mP9xQ2wR → 0xd7A8...DedB1
 */
export function decodeReferralCode(code: string): string | null {
  try {
    if (!code.startsWith('VYR')) return null;
    const encoded = code.slice(3);
    const num = fromBase62(encoded);
    const hexStr = num.toString(16);
    // Reverse XOR: hex pairs back to chars
    let result = '';
    for (let i = 0; i < hexStr.length; i += 2) {
      const byte = parseInt(hexStr.slice(i, i + 2), 16);
      const originalChar = byte ^ SALT.charCodeAt((i / 2) % SALT.length);
      result += String.fromCharCode(originalChar);
    }
    // result is now the clean hex address (without 0x)
    if (result.match(/^[0-9a-f]{40}$/)) {
      return '0x' + result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a string is a valid encoded referral code
 */
export function isReferralCode(str: string): boolean {
  return str.startsWith('VYR') && str.length > 5;
}
