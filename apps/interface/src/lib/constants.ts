/**
 * Application-wide constants derived from environment variables.
 * Required variables are validated at module load time — a missing var throws
 * immediately so the error surfaces at startup rather than at runtime.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Copy apps/interface/.env.example to apps/interface/.env.local and fill in the values.`,
    );
  }
  return value;
}

export const CONTRACT_ID = requireEnv("NEXT_PUBLIC_CONTRACT_ID");
export const RPC_URL = requireEnv("NEXT_PUBLIC_RPC_URL");
export const NETWORK_PASSPHRASE = requireEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE");
export const HORIZON_URL = requireEnv("NEXT_PUBLIC_HORIZON_URL");

export const NETWORK_NAME =
  NETWORK_PASSPHRASE === "Public Global Stellar Network ; September 2015"
    ? "mainnet"
    : "testnet";
