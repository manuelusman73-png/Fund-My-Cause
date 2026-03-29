import React from "react";
import { render, screen } from "@testing-library/react";
import { Navbar } from "./Navbar";

jest.mock("@/context/WalletContext", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: jest.fn() }),
}));

jest.mock("@/lib/constants", () => ({
  NETWORK_NAME: "Testnet",
}));

import { useWallet } from "@/context/WalletContext";

const mockUseWallet = useWallet as jest.Mock;

const baseWallet = {
  address: null,
  xlmBalance: null,
  refreshBalance: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnecting: false,
  isAutoConnecting: false,
  isSigning: false,
  error: null,
  networkMismatch: false,
  walletNetwork: null,
};

describe("Navbar snapshots", () => {
  it("matches snapshot in disconnected state", () => {
    mockUseWallet.mockReturnValue(baseWallet);
    const { asFragment } = render(<Navbar />);
    expect(asFragment()).toMatchSnapshot();
  });

  it("matches snapshot in connected state", () => {
    mockUseWallet.mockReturnValue({
      ...baseWallet,
      address: "GABCDE...WXYZ",
      xlmBalance: "42.50",
    });
    const { asFragment } = render(<Navbar />);
    expect(asFragment()).toMatchSnapshot();
  });
});

describe("Navbar balance display", () => {
  it("shows XLM balance next to truncated address when connected", () => {
    mockUseWallet.mockReturnValue({
      ...baseWallet,
      address: "GABCDE12345WXYZ",
      xlmBalance: "99.99",
    });
    render(<Navbar />);
    expect(screen.getAllByText(/99\.99 XLM/).length).toBeGreaterThan(0);
  });

  it("shows address without balance when xlmBalance is null", () => {
    mockUseWallet.mockReturnValue({
      ...baseWallet,
      address: "GABCDE12345WXYZ",
      xlmBalance: null,
    });
    render(<Navbar />);
    // Should not show XLM text
    expect(screen.queryByText(/XLM/)).toBeNull();
  });
});
