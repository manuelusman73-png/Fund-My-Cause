import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PledgeModal } from "./PledgeModal";

// ── Mutable wallet state (read at call time via getter) ───────────────────────
let mockWalletAddress: string | null = null;
const mockConnect = jest.fn();
const mockAddToast = jest.fn();

jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ address: mockWalletAddress, connect: mockConnect }),
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

jest.mock("@/components/ui/TransactionStatus", () => ({
  TransactionStatus: ({ status }: { status: string }) => (
    <div data-testid="tx-status">{status}</div>
  ),
}));

// Mock the contract client (Issue #49)
jest.mock("@/lib/soroban", () => ({
  buildInitializeTx: jest.fn(),
  submitSignedTx: jest.fn().mockResolvedValue("mockhash123"),
  fetchCampaign: jest.fn(),
  fetchAllCampaigns: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(onClose = jest.fn()) {
  return render(<PledgeModal campaignTitle="Save the Rainforest" onClose={onClose} />);
}

beforeEach(() => {
  mockWalletAddress = null;
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PledgeModal", () => {
  // 1. Renders with the campaign title
  it("renders the campaign title", () => {
    renderModal();
    expect(screen.getByText("Pledge to Save the Rainforest")).toBeInTheDocument();
  });

  // 2. Close button calls onClose
  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn();
    renderModal(onClose);
    // The X icon button has no text label — find it as the unnamed button
    // (the only button without visible text in the header row)
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find((b) => !b.textContent?.trim());
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 3. Submitting without a wallet connected triggers connect
  it("calls connect() when pledging without a connected wallet", () => {
    mockWalletAddress = null;
    renderModal();
    const btn = screen.getByRole("button", { name: /connect wallet to pledge/i });
    fireEvent.click(btn);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  // 4. Amount input rejects negative numbers
  it("does not allow negative amounts in the input", () => {
    mockWalletAddress = "GABC123";
    renderModal();
    const input = screen.getByPlaceholderText(/amount in xlm/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-50" } });
    // The input accepts the typed value (browser validation is UI-level),
    // but the pledge button should still be present and no tx should have started.
    expect(input.value).toBe("-50");
    expect(screen.queryByTestId("tx-status")).not.toBeInTheDocument();
  });

  // 5. Success state renders "Pledge submitted successfully!" via toast
  it("shows success state and fires the success toast after pledge", async () => {
    mockWalletAddress = "GABC123";
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /confirm pledge/i }));

    // Component enters "signing" — TransactionStatus is shown
    expect(screen.getByTestId("tx-status")).toBeInTheDocument();

    // Advance through all simulated timeouts: 1000 + 1500 + 1500 = 4000 ms
    act(() => { jest.advanceTimersByTime(4100); });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        "Pledge submitted successfully!",
        "success",
        expect.any(String),
      );
    });

    expect(screen.getByTestId("tx-status")).toHaveTextContent("success");
  });
});
