import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { PledgeModal } from "./PledgeModal";

// ── Mutable wallet state ──────────────────────────────────────────────────────
let mockWalletAddress: string | null = null;
const mockConnect = jest.fn();
const mockSignTx = jest.fn().mockResolvedValue("signed-xdr");
const mockAddToast = jest.fn();

jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    address: mockWalletAddress,
    connect: mockConnect,
    signTx: mockSignTx,
  }),
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

jest.mock("@/components/ui/TransactionStatus", () => ({
  TransactionStatus: ({ status }: { status: string }) => (
    <div data-testid="tx-status">{status}</div>
  ),
}));

// Mock the contract contribute function
jest.mock("@/lib/contract", () => ({
  contribute: jest.fn().mockResolvedValue("mockhash123"),
  ContractError: class ContractError extends Error {},
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(onClose = jest.fn(), onSuccess = jest.fn()) {
  return render(
    <PledgeModal
      contractId="CTEST123"
      campaignTitle="Save the Rainforest"
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );
}

beforeEach(() => {
  mockWalletAddress = null;
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PledgeModal", () => {
  it("renders the campaign title", () => {
    renderModal();
    expect(screen.getByText("Pledge to Save the Rainforest")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls connect() when pledging without a connected wallet", () => {
    mockWalletAddress = null;
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /connect wallet to pledge/i }));
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when amount is empty", async () => {
    mockWalletAddress = "GABC123";
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /confirm pledge/i }));
    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith("Please enter a valid amount.", "error"),
    );
  });

  it("shows an error toast when amount is below minimum contribution", async () => {
    mockWalletAddress = "GABC123";
    render(
      <PledgeModal
        contractId="CTEST123"
        campaignTitle="Save the Rainforest"
        minContribution={50_000_000n} // 5 XLM
        onClose={jest.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/amount in xlm/i);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm pledge/i }));
    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith(expect.stringContaining("Minimum"), "error"),
    );
  });

  it("calls contribute and shows success state on valid pledge", async () => {
    mockWalletAddress = "GABC123";
    const onSuccess = jest.fn();
    render(
      <PledgeModal
        contractId="CTEST123"
        campaignTitle="Save the Rainforest"
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />,
    );

    const input = screen.getByPlaceholderText(/amount in xlm/i);
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm pledge/i }));

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith(
        "Pledge submitted successfully!",
        "success",
        "mockhash123",
      ),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tx-status")).toHaveTextContent("success");
  });

  it("shows error state when contribute throws", async () => {
    const { contribute } = jest.requireMock("@/lib/contract") as { contribute: jest.Mock };
    contribute.mockRejectedValueOnce(new Error("Network error"));

    mockWalletAddress = "GABC123";
    renderModal();

    const input = screen.getByPlaceholderText(/amount in xlm/i);
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm pledge/i }));

    await waitFor(() =>
      expect(mockAddToast).toHaveBeenCalledWith("Network error", "error"),
    );
    expect(screen.getByTestId("tx-status")).toHaveTextContent("error");
  });
});
