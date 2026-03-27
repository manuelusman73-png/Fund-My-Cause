"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCampaignView,
  type CampaignInfo,
  type CampaignStats,
} from "@/lib/soroban";

export function useCampaign(contractId: string): {
  info: CampaignInfo | null;
  stats: CampaignStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [info, setInfo] = useState<CampaignInfo | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(Boolean(contractId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contractId) {
      setInfo(null);
      setStats(null);
      setError("Contract ID is required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchCampaignView(contractId);
      setInfo(result.info);
      setStats(result.stats);
    } catch (err) {
      setInfo(null);
      setStats(null);
      setError(err instanceof Error ? err.message : "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { info, stats, loading, error, refresh };
}
