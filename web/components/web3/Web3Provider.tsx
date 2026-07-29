'use client';

import { createConfig, http, WagmiProvider } from 'wagmi';
import { createPublicClient, http as viemHttp } from 'viem';
import { mainnet, bsc, bscTestnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';
import { ReactNode } from 'react';

// ════════════════════════════════════════════════════════════
// Wagmi Config — BSC Testnet (97) + BSC Mainnet (56)
// ════════════════════════════════════════════════════════════
const config = createConfig({
  chains: [bscTestnet, bsc],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
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
  chain: bscTestnet,
  transport: viemHttp('https://data-seed-prebsc-1-s1.binance.org:8545'),
});
