'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { bscTestnet, bsc } from 'wagmi/chains';
import { useEffect, useState } from 'react';

// ════════════════════════════════════════════════════════════
// useWallet — Custom hook for wallet connection
// ════════════════════════════════════════════════════════════
export function useWallet() {
  const { address, isConnected, chain, chainId } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const [error, setError] = useState<string | null>(null);
  const [shortAddr, setShortAddr] = useState('');

  useEffect(() => {
    if (address) {
      setShortAddr(`${address.slice(0, 6)}...${address.slice(-4)}`);
    } else {
      setShortAddr('');
    }
  }, [address]);

  // Check if on correct chain (BSC Testnet = 97)
  const isCorrectChain = chainId === bscTestnet.id || chainId === bsc.id;

  const connect = async () => {
    try {
      setError(null);
      // Use the first available connector (usually MetaMask/injected)
      const connector = connectors[0];
      if (connector) {
        await connectAsync({ connector });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    }
  };

  const disconnect = async () => {
    try {
      await disconnectAsync();
    } catch {
      // ignore
    }
  };

  const switchToBsc = async () => {
    try {
      await switchChainAsync({ chainId: bscTestnet.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch network');
    }
  };

  return {
    address,
    isConnected,
    isConnecting,
    isCorrectChain,
    chain,
    chainId,
    error,
    shortAddr,
    connectors,
    connect,
    disconnect,
    switchToBsc,
  };
}
