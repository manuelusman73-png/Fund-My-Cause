import { renderHook, act, waitFor } from "@testing-library/react";
import { useCampaign } from "./useCampaign";
import type { CampaignData } from "@/lib/soroban";

jest.mock("@/lib/soroban");

const { fetchCampaign } = jest.requireMock("@/lib/soroban") as {
  fetchCampaign: jest.Mock;
};

const mockCampaign: CampaignData = {
  contractId: "CABC123",
  title: "Test Campaign",
  description: "A test",
  raised: 500,
  goal: 1000,
  deadline: new Date(Date.now() + 86400_000).toISOString(),
  creator: "GABCDE",
  socialLinks: [],
  contributorCount: 5,
  averageContribution: 100,
  status: "Active",
};

beforeEach(() => jest.clearAllMocks());

describe("useCampaign", () => {
  it("is loading initially and false after fetch", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    const { result } = renderHook(() => useCampaign("CABC123"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("populates info on success", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    const { result } = renderHook(() => useCampaign("CABC123"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.info).toEqual(mockCampaign);
    expect(result.current.error).toBeNull();
  });

  it("sets error when the contract call throws", async () => {
    fetchCampaign.mockRejectedValue(new Error("RPC failure"));
    const { result } = renderHook(() => useCampaign("CABC123"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("RPC failure");
    expect(result.current.info).toBeNull();
  });

  it("re-fetches when refresh is called", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    const { result } = renderHook(() => useCampaign("CABC123"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchCampaign.mockResolvedValue({ ...mockCampaign, raised: 750 });
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchCampaign).toHaveBeenCalledTimes(2);
    expect(result.current.info?.raised).toBe(750);
  });

  it("applyOptimisticContribution updates raised and contributorCount immediately", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    const { result } = renderHook(() => useCampaign("CABC123"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.applyOptimisticContribution(50));

    expect(result.current.info?.raised).toBe(550);
    expect(result.current.info?.contributorCount).toBe(6);
  });

  it("rollbackOptimistic restores previous values", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    const { result } = renderHook(() => useCampaign("CABC123"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.applyOptimisticContribution(50));
    expect(result.current.info?.raised).toBe(550);

    act(() => result.current.rollbackOptimistic());
    expect(result.current.info?.raised).toBe(500);
    expect(result.current.info?.contributorCount).toBe(5);
  });

  it("clears optimistic override on next poll", async () => {
    fetchCampaign.mockResolvedValue(mockCampaign);
    const { result } = renderHook(() => useCampaign("CABC123"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.applyOptimisticContribution(50));
    expect(result.current.info?.raised).toBe(550);

    fetchCampaign.mockResolvedValue({ ...mockCampaign, raised: 600 });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.info?.raised).toBe(600);
  });
});
