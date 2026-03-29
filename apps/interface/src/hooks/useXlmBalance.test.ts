import { renderHook, act, waitFor } from "@testing-library/react";
import { useXlmBalance } from "./useXlmBalance";

const mockAccount = {
  balances: [
    { asset_type: "native", balance: "42.5000000" },
    { asset_type: "credit_alphanum4", balance: "100.0000000" },
  ],
};

describe("useXlmBalance", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns null balance when address is null", () => {
    const { result } = renderHook(() => useXlmBalance(null));
    expect(result.current.balance).toBeNull();
  });

  it("returns formatted XLM balance on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAccount),
    });
    const { result } = renderHook(() => useXlmBalance("GABC123"));
    await waitFor(() => expect(result.current.balance).toBe("42.50"));
  });

  it("returns '0' for unfunded accounts (404)", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useXlmBalance("GUNFUNDED"));
    await waitFor(() => expect(result.current.balance).toBe("0"));
  });

  it("returns '0' when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useXlmBalance("GABC123"));
    await waitFor(() => expect(result.current.balance).toBe("0"));
  });

  it("re-fetches when refresh is called", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockAccount) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ balances: [{ asset_type: "native", balance: "100.0000000" }] }),
      });

    const { result } = renderHook(() => useXlmBalance("GABC123"));
    await waitFor(() => expect(result.current.balance).toBe("42.50"));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.balance).toBe("100.00"));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
