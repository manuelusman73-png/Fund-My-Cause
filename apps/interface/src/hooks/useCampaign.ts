import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCampaignView, type CampaignInfo, type CampaignStats } from "@/lib/soroban";
import { isValidContractId } from "@/lib/validation";

export function useCampaign(contractId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error: rawError } = useQuery<
    { info: CampaignInfo; stats: CampaignStats },
    Error
  >({
    queryKey: ["campaign", contractId],
    queryFn: () => fetchCampaignView(contractId),
    enabled: isValidContractId(contractId),
    retry: false,
  });

  const error =
    rawError?.message ??
    (isValidContractId(contractId) ? null : `Invalid contract ID format: ${contractId}`);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["campaign", contractId] });

  return {
    info: data?.info ?? null,
    stats: data?.stats ?? null,
    loading,
    error,
    refresh,
  };
}

export function useContribute(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contributor,
      amount,
      signTx,
    }: {
      contributor: string;
      amount: bigint;
      signTx: (xdr: string) => Promise<string>;
    }) => {
      const { contribute } = await import("@/lib/contract");
      return contribute(contractId, contributor, amount, signTx);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", contractId] }),
  });
}

export function useWithdraw(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      creator,
      signTx,
    }: {
      creator: string;
      signTx: (xdr: string) => Promise<string>;
    }) => {
      const { withdraw } = await import("@/lib/contract");
      return withdraw(contractId, creator, signTx);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", contractId] }),
  });
}

export function useRefund(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contributor,
      signTx,
    }: {
      contributor: string;
      signTx: (xdr: string) => Promise<string>;
    }) => {
      const { refundSingle } = await import("@/lib/contract");
      return refundSingle(contractId, contributor, signTx);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign", contractId] }),
  });
}
