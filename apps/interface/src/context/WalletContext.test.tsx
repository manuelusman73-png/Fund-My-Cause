import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "./WalletContext";

// ── Mock adapters ─────────────────────────────────────────────────────────────
const mockFreighterConnect = jest.fn();
const mockFreighterSign = jest.fn();
const mockLobstrConnect = jest.fn();
const mockLobstrSign = jest.fn();
const mockLobstrDisconnect = jest.fn();

jest.mock("@/lib/freighterAdapter", () => ({
  freighterAdapter: {
    name: "Freighter",
    connect: (...args: unknown[]) => mockFreighterConnect(...args),
    signTransaction: (...args: unknown[]) => mockFreighterSign(...args),
  },
}));

jest.mock("@/lib/lobstrAdapter", () => ({
  lobstrAdapter: {
    name: "LOBSTR",
    connect: (...args: unknown[]) => mockLobstrConnect(...args),
    signTransaction: (...args: unknown[]) => mockLobstrSign(...args),
    disconnect: (...args: unknown[]) => mockLobstrDisconnect(...args),
  },
}));

// ── Mock Freighter network check ──────────────────────────────────────────────
const mockGetNetworkDetails = jest.fn();
jest.mock("@stellar/freighter-api", () => ({
  getNetworkDetails: (...args: unknown[]) => mockGetNetworkDetails(...args),
}));

// ── Mock Toast ────────────────────────────────────────────────────────────────
const mockAddToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ── Mock WalletSelectModal ────────────────────────────────────────────────────
jest.mock("@/components/ui/WalletSelectModal", () => ({
  WalletSelectModal: ({ onSelect }: { onSelect: (w: "freighter" | "lobstr") => void }) => (
    <div data-testid="wallet-select-modal">
      <button onClick={() => onSelect("freighter")}>select-freighter</button>
      <button onClick={() => onSelect("lobstr")}>select-lobstr</button>
    </div>
  ),
}));

// ── Mock useXlmBalance ────────────────────────────────────────────────────────
const mockRefreshBalance = jest.fn();
jest.mock("@/hooks/useXlmBalance", () => ({
  useXlmBalance: (address: string | null) => ({
    balance: address ? "42.50" : null,
    refresh: mockRefreshBalance,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function WalletConsumer() {
  const { address, xlmBalance, connect, disconnect, signTx, isConnecting, isSigning, error } = useWallet();
  return (
    <div>
      <span data-testid="address">{address ?? "null"}</span>
      <span data-testid="xlm-balance">{xlmBalance ?? "null"}</span>
      <span data-testid="is-connecting">{String(isConnecting)}</span>
      <span data-testid="is-signing">{String(isSigning)}</span>
      <span data-testid="error">{error ?? "null"}</span>
      <button onClick={connect}>connect</button>
      <button onClick={disconnect}>disconnect</button>
      <button onClick={() => signTx("test-xdr").catch(() => {})}>sign</button>
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
const networkOk = { network: "TESTNET", networkPassphrase: TESTNET_PASSPHRASE, error: undefined };

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  mockGetNetworkDetails.mockResolvedValue(networkOk);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WalletContext", () => {
  it("shows wallet select modal when connect is called", async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });

    expect(screen.getByTestId("wallet-select-modal")).toBeInTheDocument();
  });

  it("sets address when Freighter is selected", async () => {
    mockFreighterConnect.mockResolvedValue("GABC123");
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });

    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GABC123"));
    expect(screen.getByTestId("error")).toHaveTextContent("null");
  });

  it("sets address when LOBSTR is selected", async () => {
    mockLobstrConnect.mockResolvedValue("GLOBSTR123");
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-lobstr" }).click(); });

    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GLOBSTR123"));
  });

  it("shows xlmBalance from useXlmBalance when connected", async () => {
    mockFreighterConnect.mockResolvedValue("GABC123");
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });

    await waitFor(() => expect(screen.getByTestId("xlm-balance")).toHaveTextContent("42.50"));
  });

  it("sets error when adapter connect throws", async () => {
    mockFreighterConnect.mockRejectedValue(new Error("Freighter is not installed."));
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("Freighter is not installed."));
    expect(mockAddToast).toHaveBeenCalledWith("Freighter is not installed.", "error");
  });

  it("clears address on disconnect", async () => {
    mockFreighterConnect.mockResolvedValue("GABC123");
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GABC123"));

    await act(async () => { screen.getByRole("button", { name: "disconnect" }).click(); });

    expect(screen.getByTestId("address")).toHaveTextContent("null");
    expect(sessionStorage.getItem("fmc:wallet_address")).toBeNull();
  });

  it("restores address from sessionStorage on mount", async () => {
    sessionStorage.setItem("fmc:wallet_address", "GSAVED123");
    sessionStorage.setItem("fmc:wallet_type", "freighter");
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GSAVED123"));
  });

  it("signTx calls adapter signTransaction", async () => {
    mockFreighterConnect.mockResolvedValue("GABC123");
    mockFreighterSign.mockResolvedValue("signed-xdr-result");
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GABC123"));

    await act(async () => { screen.getByRole("button", { name: "sign" }).click(); });

    expect(mockFreighterSign).toHaveBeenCalledWith("test-xdr", TESTNET_PASSPHRASE);
  });

  it("signTx shows 'Transaction cancelled' toast on user rejection", async () => {
    mockFreighterConnect.mockResolvedValue("GABC123");
    mockFreighterSign.mockRejectedValue(new Error("User declined the request"));
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GABC123"));

    await act(async () => { screen.getByRole("button", { name: "sign" }).click(); });

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith("Transaction cancelled", "info"),
    );
  });

  it("signTx shows 'Network error' toast on network failure", async () => {
    mockFreighterConnect.mockResolvedValue("GABC123");
    mockFreighterSign.mockRejectedValue(new Error("network timeout"));
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("is-connecting")).toHaveTextContent("false"));

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("GABC123"));

    await act(async () => { screen.getByRole("button", { name: "sign" }).click(); });

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith("Network error, please try again", "error"),
    );
  });

  it("detects network mismatch when wallet is on a different network", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      network: "MAINNET",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      error: undefined,
    });
    mockFreighterConnect.mockResolvedValue("GABC123");

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

    act(() => { screen.getByRole("button", { name: "connect" }).click(); });
    await act(async () => { screen.getByRole("button", { name: "select-freighter" }).click(); });

    await waitFor(() => expect(screen.getByTestId("mismatch")).toHaveTextContent("true"));
  });
});
