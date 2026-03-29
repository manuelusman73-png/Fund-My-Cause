import { useState, useEffect } from "react";
import { HORIZON_URL } from "@/lib/constants";

/**
 * Checks whether a Stellar account is funded (exists on the network).
 * @param {string|null} address - Stellar account address to check
 * @returns {{ exists: boolean, loading: boolean }}
 */
export function useAccountExists(address: string | null): { exists: boolean; loading: boolean } {
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setExists(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${HORIZON_URL}/accounts/${address}`)
      .then((res) => { if (!cancelled) setExists(res.ok); })
      .catch(() => { if (!cancelled) setExists(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  return { exists, loading };
}
