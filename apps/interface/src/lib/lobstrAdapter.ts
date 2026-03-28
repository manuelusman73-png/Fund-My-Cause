import type { WalletAdapter } from "./walletAdapters";

// LOBSTR uses WalletConnect under the hood.
// We lazy-import SignClient to avoid SSR issues.

const LOBSTR_WALLET_CONNECT_APP_URL = "https://lobstr.co";
const STELLAR_NAMESPACE = "stellar";
const STELLAR_CHAIN_TESTNET = "stellar:testnet";
const STELLAR_CHAIN_MAINNET = "stellar:pubnet";

// WalletConnect project ID — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local
function getProjectId(): string {
  return process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
}

let _session: { topic: string } | null = null;
let _client: Awaited<ReturnType<typeof import("@walletconnect/sign-client")["default"]["init"]>> | null = null;

async function getClient() {
  if (_client) return _client;
  const { default: SignClient } = await import("@walletconnect/sign-client");
  _client = await SignClient.init({
    projectId: getProjectId(),
    metadata: {
      name: "Fund-My-Cause",
      description: "Decentralized crowdfunding on Stellar",
      url: typeof window !== "undefined" ? window.location.origin : "",
      icons: [],
    },
  });
  return _client;
}

export const lobstrAdapter: WalletAdapter = {
  name: "LOBSTR",

  async connect() {
    const client = await getClient();
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        [STELLAR_NAMESPACE]: {
          methods: ["stellar_signXDR"],
          chains: [STELLAR_CHAIN_TESTNET, STELLAR_CHAIN_MAINNET],
          events: [],
        },
      },
    });

    // Open WalletConnect URI — in a real app you'd show a QR code modal
    if (uri && typeof window !== "undefined") {
      window.open(
        `${LOBSTR_WALLET_CONNECT_APP_URL}/wc?uri=${encodeURIComponent(uri)}`,
        "_blank",
      );
    }

    const session = await approval();
    _session = session;

    // Extract the account address from the session namespace
    const accounts = session.namespaces[STELLAR_NAMESPACE]?.accounts ?? [];
    if (!accounts.length) throw new Error("No Stellar account returned by LOBSTR");
    // Format: "stellar:testnet:GADDRESS..."
    const address = accounts[0].split(":")[2];
    if (!address) throw new Error("Could not parse address from LOBSTR session");
    return address;
  },

  async signTransaction(xdr) {
    if (!_session) throw new Error("LOBSTR not connected");
    const client = await getClient();
    const result = await client.request<{ signedXDR: string }>({
      topic: _session.topic,
      chainId: STELLAR_CHAIN_TESTNET,
      request: {
        method: "stellar_signXDR",
        params: { xdr },
      },
    });
    return result.signedXDR;
  },

  async disconnect() {
    if (!_session || !_client) return;
    await _client.disconnect({ topic: _session.topic, reason: { code: 6000, message: "User disconnected" } });
    _session = null;
  },
};
