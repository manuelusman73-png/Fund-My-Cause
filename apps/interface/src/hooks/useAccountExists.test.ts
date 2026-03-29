import { renderHook, waitFor } from "@testing-library/react";
import { useAccountExists } from "./useAccountExists";

const HORIZON = "https://horizon-testnet.stellar.org";

beforeEach(() => {
  jest.resetAllMocks();
  // Provide a stable HORIZON_URL for tests
  jest.mock("@/lib/constants", () => ({ HORIZON_URL: HORIZON }));
});

describe("useAccountExists", () => {
  it("returns loading=false and exists=false when address is null", () => {
    const { result } = renderHook(() => useAccountExists(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.exists).toBe(false);
  });

  it("returns exists=true when Horizon responds with 200", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAccountExists("GABC123"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.exists).toBe(true);
  });

  it("returns exists=false when Horizon responds with 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useAccountExists("GUNFUNDED"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.exists).toBe(false);
  });

  it("returns exists=false when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAccountExists("GABC123"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.exists).toBe(false);
  });
});
