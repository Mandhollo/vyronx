'use client';

import { createConfig, http, WagmiProvider } from 'wagmi';
import { createPublicClient, http as viemHttp } from 'viem';
import { bsc } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';
import { ReactNode } from 'react';

// ════════════════════════════════════════════════════════════
// Wagmi Config — BSC Mainnet (56)
// multiInjectedProviderDiscovery handles mobile wallet apps
// via browser wallet injection (MetaMask, Trust, Binance, etc)
// ════════════════════════════════════════════════════════════
const config = createConfig({
  chains: [bsc],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  // This is critical for mobile:
  // When a user opens vyronx.io inside MetaMask/Trust Wallet's
  // in-app browser, the wallet injects itself automatically.
  // multiInjectedProviderDiscovery finds it and connects.
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org'),
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config };

// Public client for read-only contract calls
export const publicClient = createPublicClient({
  chain: bsc,
  transport: viemHttp('https://bsc-dataseed.binance.org'),
});
