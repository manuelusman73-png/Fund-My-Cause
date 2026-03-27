import React from "react";
import { render } from "@testing-library/react";
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
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnecting: false,
  isAutoConnecting: false,
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
    });
    const { asFragment } = render(<Navbar />);
    expect(asFragment()).toMatchSnapshot();
  });
});
