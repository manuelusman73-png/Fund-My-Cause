"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { getNetworkDetails } from "@stellar/freighter-api";
import { useToast } from "@/components/ui/Toast";
import { NETWORK_PASSPHRASE, NETWORK_NAME } from "@/lib/constants";
import { freighterAdapter } from "@/lib/freighterAdapter";
import { lobstrAdapter } from "@/lib/lobstrAdapter";
import type { WalletAdapter } from "@/lib/walletAdapters";
import { useXlmBalance } from "@/hooks/useXlmBalance";
import { WalletSelectModal } from "@/components/ui/WalletSelectModal";

const SESSION_KEY = "fmc:wallet_address";
const SESSION_WALLET_KEY = "fmc:wallet_type";

const ADAPTERS: Record<"freighter" | "lobstr", WalletAdapter> = {
  freighter: freighterAdapter,
  lobstr: lobstrAdapter,
};

/**
 * Context value provided by WalletProvider.
 */
interface WalletContextType {
  address: string | null;
  /** XLM balance string (e.g. "42.50"), null while loading or disconnected. */
  xlmBalance: string | null;
  /** Refresh the XLM balance (call after a transaction). */
  refreshBalance: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (xdr: string) => Promise<string>;
  isConnecting: boolean;
  isAutoConnecting: boolean;
  /** True while a transaction is being signed — use to disable buttons. */
  isSigning: boolean;
  error: string | null;
  networkMismatch: boolean;
  walletNetwork: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [activeAdapter, setActiveAdapter] = useState<WalletAdapter | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const { addToast } = useToast();

  const { balance: xlmBalance, refresh: refreshBalance } = useXlmBalance(address);

  const checkNetwork = useCallback(async () => {
    const result = await getNetworkDetails();
    if (result.error) return;
    setWalletNetwork(result.network);
    setNetworkMismatch(result.networkPassphrase !== NETWORK_PASSPHRASE);
  }, []);

  // Auto-restore from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const walletType = (sessionStorage.getItem(SESSION_WALLET_KEY) ?? "freighter") as "freighter" | "lobstr";
      setAddress(saved);
      setActiveAdapter(ADAPTERS[walletType]);
      checkNetwork().finally(() => setIsAutoConnecting(false));
    } else {
      setIsAutoConnecting(false);
    }
  }, [checkNetwork]);

  const connectWith = useCallback(async (walletType: "freighter" | "lobstr") => {
    setShowWalletSelect(false);
    setIsConnecting(true);
    setError(null);
    const adapter = ADAPTERS[walletType];
    try {
      const addr = await adapter.connect();
      sessionStorage.setItem(SESSION_KEY, addr);
      sessionStorage.setItem(SESSION_WALLET_KEY, walletType);
      setAddress(addr);
      setActiveAdapter(adapter);
      await checkNetwork();
      addToast("Wallet connected successfully!", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect wallet.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setIsConnecting(false);
    }
  }, [checkNetwork, addToast]);

  const connect = useCallback(async () => {
    setShowWalletSelect(true);
  }, []);

  const disconnect = useCallback(async () => {
    await activeAdapter?.disconnect?.();
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_WALLET_KEY);
    setAddress(null);
    setActiveAdapter(null);
    setNetworkMismatch(false);
    setWalletNetwork(null);
    addToast("Wallet disconnected", "info");
  }, [activeAdapter, addToast]);

  /**
   * Signs a transaction XDR with the connected wallet.
   * - Shows "Transaction cancelled" toast on user rejection.
   * - Shows "Network error, please try again" toast on network failures.
   * - Re-throws unexpected errors for callers to handle.
   * - Sets isSigning=true during the operation.
   */
  const signTx = useCallback(async (xdr: string): Promise<string> => {
    if (!activeAdapter) throw new Error("No wallet connected");
    setIsSigning(true);
    try {
      return await activeAdapter.signTransaction(xdr, NETWORK_PASSPHRASE);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/declined|rejected|cancel|denied/i.test(msg)) {
        addToast("Transaction cancelled", "info");
        throw e;
      }
      if (/network|fetch|timeout|connection/i.test(msg)) {
        addToast("Network error, please try again", "error");
        throw e;
      }
      throw e;
    } finally {
      setIsSigning(false);
    }
  }, [activeAdapter, addToast]);

  return (
    <WalletContext.Provider
      value={{
        address,
        xlmBalance,
        refreshBalance,
        connect,
        disconnect,
        signTx,
        isConnecting,
        isAutoConnecting,
        isSigning,
        error,
        networkMismatch,
        walletNetwork,
      }}
    >
      {children}
      {showWalletSelect && (
        <WalletSelectModal
          onSelect={connectWith}
          onClose={() => setShowWalletSelect(false)}
        />
      )}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
