import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "./WalletContext";

// ── Mock @stellar/freighter-api ───────────────────────────────────────────────

const mockRequestAccess = jest.fn();
const mockGetNetworkDetails = jest.fn();
const mockSignTransaction = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  requestAccess: (...args: unknown[]) => mockRequestAccess(...args),
  getNetworkDetails: (...args: unknown[]) => mockGetNetworkDetails(...args),
  signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
}));

// Mock Toast so WalletProvider doesn't need ToastProvider in the tree
const mockAddToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// A small consumer component that exposes context values via data-testid
function WalletConsumer() {
  const { address, connect, disconnect, signTx, isConnecting, error } = useWallet();
  return (
    <div>
      <span data-testid="address">{address ?? "null"}</span>
      <span data-testid="is-connecting">{String(isConnecting)}</span>
      <span data-testid="error">{error ?? "null"}</span>
      <button onClick={connect}>connect</button>
      <button onClick={disconnect}>disconnect</button>
      <button onClick={() => signTx("test-xdr")}>sign</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <WalletProvider>
      <WalletConsumer />
    </WalletProvider>,
  );
}

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

// Default network response — no mismatch
const networkOk = {
  network: "TESTNET",
  networkPassphrase: TESTNET_PASSPHRASE,
  error: undefined,
};

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  // Default: network check succeeds
  mockGetNetworkDetails.mockResolvedValue(networkOk);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WalletContext", () => {
  // 1. connect sets address on success
  it("sets address when connect succeeds", async () => {
    mockRequestAccess.mockResolvedValue({ address: "GABC123", error: undefined });

    renderWithProvider();
    // Wait for auto-connect effect to settle
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByRole("button", { name: "connect" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GABC123");
    });
    expect(screen.getByTestId("error")).toHaveTextContent("null");
  });

  // 2. connect sets error when Freighter is not installed / returns error
  it("sets error when Freighter returns an error", async () => {
    mockRequestAccess.mockResolvedValue({
      address: "",
      error: { message: "Freighter is not installed." },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByRole("button", { name: "connect" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Freighter is not installed.");
    });
    expect(screen.getByTestId("address")).toHaveTextContent("null");
    expect(mockAddToast).toHaveBeenCalledWith("Freighter is not installed.", "error");
  });

  // 3. disconnect clears address
  it("clears address on disconnect", async () => {
    mockRequestAccess.mockResolvedValue({ address: "GABC123", error: undefined });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    // Connect first
    await act(async () => {
      screen.getByRole("button", { name: "connect" }).click();
    });
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GABC123"));

    // Now disconnect
    act(() => {
      screen.getByRole("button", { name: "disconnect" }).click();
    });

    expect(screen.getByTestId("address")).toHaveTextContent("null");
    expect(sessionStorage.getItem("fmc:wallet_address")).toBeNull();
  });

  // 4. signTx calls signTransaction with correct args
  it("calls signTransaction with the xdr and network passphrase", async () => {
    mockSignTransaction.mockResolvedValue({
      signedTxXdr: "signed-xdr-result",
      error: undefined,
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByRole("button", { name: "sign" }).click();
    });

    expect(mockSignTransaction).toHaveBeenCalledWith("test-xdr", {
      networkPassphrase: TESTNET_PASSPHRASE,
    });
  });

  // 5. isConnecting is true during connect and false after
  it("sets isConnecting true during connect and false after", async () => {
    // Use a deferred promise so we can observe the in-flight state
    let resolveAccess!: (v: unknown) => void;
    const accessPromise = new Promise((res) => { resolveAccess = res; });
    mockRequestAccess.mockReturnValue(accessPromise);

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    // Kick off connect without awaiting
    act(() => {
      screen.getByRole("button", { name: "connect" }).click();
    });

    // isConnecting should be true while the promise is pending
    expect(screen.getByTestId("is-connecting")).toHaveTextContent("true");

    // Resolve the promise
    await act(async () => {
      resolveAccess({ address: "GABC123", error: undefined });
    });

    expect(screen.getByTestId("is-connecting")).toHaveTextContent("false");
  });

  // 6. Auto-restores address from sessionStorage on mount
  it("restores address from sessionStorage on mount", async () => {
    sessionStorage.setItem("fmc:wallet_address", "GSAVED123");

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GSAVED123");
    });
  });

  // 7. connect sets error when requestAccess throws (catch branch)
  it("sets error when requestAccess throws an exception", async () => {
    mockRequestAccess.mockRejectedValue(new Error("Network error"));

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByRole("button", { name: "connect" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Failed to connect wallet.");
    });
    expect(mockAddToast).toHaveBeenCalledWith("Failed to connect wallet.", "error");
  });

  // 8. checkNetwork early-returns when getNetworkDetails returns an error
  it("does not set networkMismatch when getNetworkDetails returns an error", async () => {
    mockGetNetworkDetails.mockResolvedValue({ error: { message: "Not installed" } });
    mockRequestAccess.mockResolvedValue({ address: "GABC123", error: undefined });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByRole("button", { name: "connect" }).click();
    });

    // connect should still succeed; no crash from checkNetwork error path
    await waitFor(() =>
      expect(screen.getByTestId("address")).toHaveTextContent("GABC123"),
    );
  });

  // 9. checkNetwork detects network mismatch when passphrase differs
  it("detects network mismatch when wallet is on a different network", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      network: "MAINNET",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      error: undefined,
    });
    mockRequestAccess.mockResolvedValue({ address: "GABC123", error: undefined });

    // Expose networkMismatch via a consumer
    function MismatchConsumer() {
      const { connect, networkMismatch } = useWallet();
      return (
        <div>
          <span data-testid="mismatch">{String(networkMismatch)}</span>
          <button onClick={connect}>connect</button>
        </div>
      );
    }

    render(
      <WalletProvider>
        <MismatchConsumer />
      </WalletProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "connect" }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("mismatch")).toHaveTextContent("true"),
    );
  });

  // 8. signTx throws when Freighter returns an error
  it("signTx throws when signTransaction returns an error", async () => {
    mockSignTransaction.mockResolvedValue({
      signedTxXdr: "",
      error: { message: "User rejected" },
    });

    // Expose signTx result via a consumer that catches the error
    function SignTxConsumer() {
      const { signTx } = useWallet();
      const [result, setResult] = React.useState("");
      return (
        <button
          onClick={() =>
            signTx("test-xdr").catch((e: Error) => setResult(e.message))
          }
        >
          sign
          <span data-testid="sign-result">{result}</span>
        </button>
      );
    }

    render(
      <WalletProvider>
        <SignTxConsumer />
      </WalletProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: /sign/i }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("sign-result")).toHaveTextContent("User rejected"),
    );
  });
});
