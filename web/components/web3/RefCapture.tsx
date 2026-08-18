'use client';

import { useEffect } from 'react';

/**
 * Global ?ref= capture.
 * Saves the first valid referral seen on ANY page URL to localStorage,
 * so attribution survives navigation (e.g. landing on /, buying on /presale).
 * The presale page reads this as a fallback when its own URL has no ?ref=.
 * First-touch wins: an already-saved referrer is never overwritten.
 */
export default function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (!ref) return;
      const valid = ref.startsWith('0x') ? ref.length === 42 : ref.length >= 8;
      if (!valid) return;
      const prev = localStorage.getItem('vyronx-ref');
      if (prev) return; // first-touch attribution — keep existing
      localStorage.setItem('vyronx-ref', JSON.stringify({ ref, ts: Date.now() }));
    } catch {
      // storage unavailable — silently ignore
    }
  }, []);
  return null;
}
