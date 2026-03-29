import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useCampaign } from "./useCampaign";
import type { CampaignInfo, CampaignStats } from "@/lib/soroban";

jest.mock("@/lib/soroban");

const { fetchCampaignView } = jest.requireMock("@/lib/soroban") as {
  fetchCampaignView: jest.Mock;
};

// Valid 56-char Stellar contract ID (starts with C, base32)
const VALID_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const mockInfo: CampaignInfo = {
  contractId: VALID_CONTRACT_ID,
  creator: "GABCDE",
  token: "native",
  goal: 10_000_000_000n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
  minContribution: 10_000_000n,
  title: "Test Campaign",
  description: "A test",
  status: "Active",
  hasPlatformConfig: false,
  platformFeeBps: 0,
  platformAddress: "",
  socialLinks: [],
};

const mockStats: CampaignStats = {
  totalRaised: 5_000_000_000n,
  goal: 10_000_000_000n,
  progressBps: 5000,
  contributorCount: 5,
  averageContribution: 1_000_000_000n,
  largestContribution: 2_000_000_000n,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => jest.clearAllMocks());

describe("useCampaign", () => {
  it("is loading initially and false after fetch", async () => {
    fetchCampaignView.mockResolvedValue({ info: mockInfo, stats: mockStats });
    const { result } = renderHook(() => useCampaign(VALID_CONTRACT_ID), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("populates info and stats on success", async () => {
    fetchCampaignView.mockResolvedValue({ info: mockInfo, stats: mockStats });
    const { result } = renderHook(() => useCampaign(VALID_CONTRACT_ID), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.info).toEqual(mockInfo);
    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.error).toBeNull();
  });

  it("sets error when the contract call throws", async () => {
    fetchCampaignView.mockRejectedValue(new Error("RPC failure"));
    const { result } = renderHook(() => useCampaign(VALID_CONTRACT_ID), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("RPC failure");
    expect(result.current.info).toBeNull();
  });

  it("exposes a refresh function", async () => {
    fetchCampaignView.mockResolvedValue({ info: mockInfo, stats: mockStats });
    const { result } = renderHook(() => useCampaign(VALID_CONTRACT_ID), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refresh).toBe("function");
  });
});
