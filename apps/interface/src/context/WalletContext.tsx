"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { getAddress, isConnected, signTransaction } from "@stellar/freighter-api";
import { useToast } from "@/components/ui/Toast";

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
  const { addToast } = useToast();

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        setError("Freighter wallet not found. Please install it.");
        addToast("Freighter wallet not found. Please install it.", "error");
        return;
      }
      const result = await getAddress();
      if (result.error) {
        setError("Failed to get address from Freighter.");
        addToast("Failed to get address from Freighter.", "error");
        return;
      }
      setAddress(result.address);
      addToast("Wallet connected successfully!", "success");
    } catch (e) {
      setError("Failed to connect wallet.");
      addToast("Failed to connect wallet.", "error");
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = useCallback(() => {
    setAddress(null);
    addToast("Wallet disconnected", "info");
  }, [addToast]);

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
