/**
 * Application-wide constants derived from environment variables.
 * Required variables are validated at module load time — a missing var throws
 * immediately so the error surfaces at startup rather than at runtime.
 */

/**
 * Retrieves a required environment variable.
 * @param {string} key - Environment variable name
 * @returns {string} Environment variable value
 * @throws {Error} If the environment variable is not set
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

/** The Soroban crowdfunding contract address. */
export const CONTRACT_ID = requireEnv("NEXT_PUBLIC_CONTRACT_ID");

/** The Soroban RPC endpoint URL. */
export const RPC_URL = requireEnv("NEXT_PUBLIC_RPC_URL");

/** The Stellar network passphrase (testnet or mainnet). */
export const NETWORK_PASSPHRASE = requireEnv("NEXT_PUBLIC_NETWORK_PASSPHRASE");

/** The Horizon API endpoint URL. */
export const HORIZON_URL = requireEnv("NEXT_PUBLIC_HORIZON_URL");

/** Human-readable network name derived from NETWORK_PASSPHRASE. */
export const NETWORK_NAME =
  NETWORK_PASSPHRASE === "Public Global Stellar Network ; September 2015"
    ? "mainnet"
    : "testnet";
