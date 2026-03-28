import { useState, useEffect, useCallback } from "react";
import { fetchCampaign, type CampaignData } from "@/lib/soroban";
import { isValidContractId } from "@/lib/validation";

/**
 * Result object returned by useCampaign hook.
 * @interface UseCampaignResult
 * @property {CampaignData|null} info - Fetched campaign data, or null if loading/error
 * @property {boolean} loading - True while fetching campaign data
 * @property {string|null} error - Error message if fetch failed, null otherwise
 * @property {Function} refresh - Callback to manually refetch campaign data
 */
interface UseCampaignResult {
  info: CampaignData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to fetch and manage campaign data from a Soroban contract.
 * Automatically refetches when contractId changes. Supports manual refresh via returned callback.
 * @param {string} contractId - The Soroban contract address to fetch data from
 * @returns {UseCampaignResult} Campaign data, loading state, error, and refresh function
 * @example
 * const { info, loading, error, refresh } = useCampaign(contractId);
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 * return <div>{info?.title}</div>;
 */
export function useCampaign(contractId: string): UseCampaignResult {
  const [info, setInfo] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Validate contract ID format early
    if (!isValidContractId(contractId)) {
      if (!cancelled) {
        setError(`Invalid contract ID format: ${contractId}`);
        setLoading(false);
      }
      return;
    }

    fetchCampaign(contractId)
      .then((data) => { if (!cancelled) { setInfo(data); setLoading(false); } })
      .catch((e: unknown) => { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [contractId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { info, loading, error, refresh };
}
