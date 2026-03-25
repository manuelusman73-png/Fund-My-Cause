"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { getAddress, isConnected, signTransaction } from "@stellar/freighter-api";

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (xdr: string) => Promise<string>;
  isConnecting: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        setError("Freighter wallet not found. Please install it.");
        return;
      }
      const result = await getAddress();
      if (result.error) {
        setError("Failed to get address from Freighter.");
        return;
      }
      setAddress(result.address);
    } catch (e) {
      setError("Failed to connect wallet.");
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => setAddress(null);

  const signTx = async (xdr: string): Promise<string> => {
    const result = await signTransaction(xdr, { networkPassphrase: "Test SDF Network ; September 2015" });
    if (result.error) throw new Error(result.error.message ?? "Signing failed");
    return result.signedTxXdr;
  };

  return (
    <WalletContext.Provider value={{ address, connect, disconnect, signTx, isConnecting, error }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
