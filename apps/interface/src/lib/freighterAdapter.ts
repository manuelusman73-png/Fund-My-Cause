import { requestAccess, signTransaction } from "@stellar/freighter-api";
import type { WalletAdapter } from "./walletAdapters";

export const freighterAdapter: WalletAdapter = {
  name: "Freighter",
  async connect() {
    const result = await requestAccess();
    if (result.error) throw new Error(result.error.message ?? "Freighter connection failed");
    return result.address;
  },
  async signTransaction(xdr, networkPassphrase) {
    const result = await signTransaction(xdr, { networkPassphrase });
    if (result.error) throw new Error(result.error.message ?? "Signing failed");
    return result.signedTxXdr;
  },
};
