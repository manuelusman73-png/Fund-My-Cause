import { useState, useEffect, useCallback } from "react";
import { HORIZON_URL } from "@/lib/constants";

/**
 * Fetches the native XLM balance for a Stellar account via Horizon.
 * Returns 0 for unfunded accounts. Exposes a refresh callback so callers
 * can re-fetch after a transaction.
 */
export function useXlmBalance(address: string | null): { balance: string | null; refresh: () => void } {
  const [balance, setBalance] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) { setBalance(null); return; }
    let cancelled = false;
    fetch(`${HORIZON_URL}/accounts/${address}`)
      .then((res) => {
        if (!res.ok) { if (!cancelled) setBalance("0"); return; }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const native = (data.balances as { asset_type: string; balance: string }[])
          ?.find((b) => b.asset_type === "native");
        setBalance(native ? parseFloat(native.balance).toFixed(2) : "0");
      })
      .catch(() => { if (!cancelled) setBalance("0"); });
    return () => { cancelled = true; };
  }, [address, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { balance, refresh };
}
