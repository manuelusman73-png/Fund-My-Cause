/**
 * Common interface that every wallet integration must implement.
 * Abstracts over Freighter (extension) and LOBSTR (WalletConnect).
 */
export interface WalletAdapter {
  /** Human-readable wallet name shown in the selection UI. */
  name: string;
  /** Request access and return the user's public key. */
  connect(): Promise<string>;
  /** Sign a transaction XDR and return the signed XDR. */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
  /** Optional cleanup (e.g. disconnect WalletConnect session). */
  disconnect?(): Promise<void>;
}
