import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { isValidContractId } from "@/lib/validation";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const CONTRACT_IDS: string[] = (
  process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS ?? ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const VALID_STATUSES = [
  "Active",
  "Successful",
  "Refunded",
  "Cancelled",
  "Paused",
] as const;

export type CampaignStatus = (typeof VALID_STATUSES)[number];

export interface InitializeParams {
  contractId: string;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  minContribution: bigint;
  title: string;
  description: string;
  socialLinks?: string[];
  acceptedTokens?: string[];
  platformFeeAddress?: string;
  platformFeeBps?: number;
}

export interface CampaignInfo {
  contractId: string;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  minContribution: bigint;
  title: string;
  description: string;
  status: CampaignStatus;
  hasPlatformConfig: boolean;
  platformFeeBps: number;
  platformAddress: string;
  socialLinks: string[];
  acceptedTokens?: string[];
}

export interface CampaignStats {
  totalRaised: bigint;
  goal: bigint;
  progressBps: number;
  contributorCount: number;
  averageContribution: bigint;
  largestContribution: bigint;
}

export interface CampaignData {
  contractId: string;
  title: string;
  description: string;
  raised: number;
  goal: number;
  deadline: string;
  creator: string;
  socialLinks: string[];
  contributorCount: number;
  averageContribution: number;
  status: CampaignStatus;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Unexpected Soroban response shape");
}

function toBigIntValue(value: unknown, fallback = 0n): bigint {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  return fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function toStringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toStringValue(item)).filter(Boolean);
}

function normalizeStatus(value: unknown): CampaignStatus {
  if (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as CampaignStatus)
  ) {
    return value as CampaignStatus;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const tagged = record.tag;
    if (
      typeof tagged === "string" &&
      VALID_STATUSES.includes(tagged as CampaignStatus)
    ) {
      return tagged as CampaignStatus;
    }

    for (const key of Object.keys(record)) {
      if (VALID_STATUSES.includes(key as CampaignStatus)) {
        return key as CampaignStatus;
      }
    }
  }

async function simulateView(contractId: string, method: string, args: xdr.ScVal[] = []) {
  const rpc = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(contractId);
  const account = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(result.error);
  }

  const simulation =
    result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  if (!simulation.result) {
    throw new Error(`No result returned for ${method}`);
  }

  return scValToNative(simulation.result.retval);
}

function normalizeCampaignInfo(
  contractId: string,
  infoValue: unknown,
  socialLinksValue: unknown,
): CampaignInfo {
  const info = toRecord(infoValue);

  return {
    contractId,
    creator: toStringValue(info.creator),
    token: toStringValue(info.token),
    goal: toBigIntValue(info.goal),
    deadline: toBigIntValue(info.deadline),
    minContribution: toBigIntValue(info.min_contribution),
    title: toStringValue(info.title),
    description: toStringValue(info.description),
    status: normalizeStatus(info.status),
    hasPlatformConfig: toBooleanValue(info.has_platform_config),
    platformFeeBps: toNumberValue(info.platform_fee_bps),
    platformAddress: toStringValue(info.platform_address),
    socialLinks: toStringArrayValue(socialLinksValue),
    acceptedTokens: toStringArrayValue(info.accepted_tokens), // Added acceptedTokens
  };
}

function normalizeCampaignStats(statsValue: unknown): CampaignStats {
  const stats = toRecord(statsValue);

  return {
    totalRaised: toBigIntValue(stats.total_raised),
    goal: toBigIntValue(stats.goal),
    progressBps: toNumberValue(stats.progress_bps),
    contributorCount: toNumberValue(stats.contributor_count),
    averageContribution: toBigIntValue(stats.average_contribution),
    largestContribution: toBigIntValue(stats.largest_contribution),
  };
}

export async function fetchCampaignView(contractId: string): Promise<{
  info: CampaignInfo;
  stats: CampaignStats;
}> {
  if (!isValidContractId(contractId)) {
    throw new Error(`Invalid contract ID format: ${contractId}`);
  }

  const [infoValue, statsValue, socialLinksValue] = await Promise.all([
    simulateView(contractId, "get_campaign_info"),
    simulateView(contractId, "get_stats"),
    simulateView(contractId, "social_links").catch(() => []),
  ]);

  return {
    info: normalizeCampaignInfo(contractId, infoValue, socialLinksValue),
    stats: normalizeCampaignStats(statsValue),
  };
}

export async function fetchCampaign(contractId: string): Promise<CampaignData> {
  if (!isValidContractId(contractId)) {
    throw new Error(`Invalid contract ID format: ${contractId}`);
  }

  const { info, stats } = await fetchCampaignView(contractId);

  return {
    contractId,
    title: info.title,
    description: info.description,
    raised: stroopsToXlm(stats.totalRaised),
    goal: stroopsToXlm(info.goal),
    deadline: ledgerTimestampToIso(info.deadline),
    creator: info.creator,
    socialLinks: info.socialLinks,
    contributorCount: stats.contributorCount,
    averageContribution: stroopsToXlm(stats.averageContribution),
    status: info.status,
  };
}

export async function fetchContribution(
  contractId: string,
  address: string,
): Promise<number> {
  if (!isValidContractId(contractId)) {
    throw new Error(`Invalid contract ID format: ${contractId}`);
  }

  try {
    const result = await simulateView(contractId, "contribution", [
      new Address(address).toScVal(),
    ]);
    return stroopsToXlm(toBigIntValue(result));
  } catch {
    return 0;
  }
}

export async function fetchAllCampaigns(): Promise<CampaignData[]> {
  if (CONTRACT_IDS.length === 0) return [];

  const results = await Promise.allSettled(
    CONTRACT_IDS.map((id) => fetchCampaign(id)),
  );
  return results
    .filter(
      (result): result is PromiseFulfilledResult<CampaignData> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
}

export async function fetchCampaignData(
  contractId: string,
): Promise<CampaignData> {
  if (!isValidContractId(contractId)) {
    throw new Error(`Invalid contract ID format: ${contractId}`);
  }

  return fetchCampaign(contractId);
}

export async function buildInitializeTx(
  params: InitializeParams,
): Promise<string> {
  if (!isValidContractId(params.contractId)) {
    throw new Error(`Invalid contract ID format: ${params.contractId}`);
  }

  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(params.creator);
  const contract = new Contract(params.contractId);

  const socialLinksVal =
    params.socialLinks && params.socialLinks.length > 0
      ? xdr.ScVal.scvVec(
          params.socialLinks.map((value) =>
            nativeToScVal(value, { type: "string" }),
          ),
        )
      : xdr.ScVal.scvVoid();

  const acceptedTokensVal =
    params.acceptedTokens && params.acceptedTokens.length > 0
      ? xdr.ScVal.scvVec(
          params.acceptedTokens.map((value) => new Address(value).toScVal()),
        )
      : xdr.ScVal.scvVoid();

  const platformConfigVal =
    params.platformFeeAddress && params.platformFeeBps !== undefined
      ? xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: nativeToScVal("address", { type: "symbol" }),
            val: new Address(params.platformFeeAddress).toScVal(),
          }),
          new xdr.ScMapEntry({
            key: nativeToScVal("fee_bps", { type: "symbol" }),
            val: nativeToScVal(params.platformFeeBps, { type: "u32" }),
          }),
        ])
      : xdr.ScVal.scvVoid();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "initialize",
        new Address(params.creator).toScVal(),
        new Address(params.token).toScVal(),
        nativeToScVal(params.goal, { type: "i128" }),
        nativeToScVal(params.deadline, { type: "u64" }),
        nativeToScVal(params.minContribution, { type: "i128" }),
        nativeToScVal(params.title, { type: "string" }),
        nativeToScVal(params.description, { type: "string" }),
        socialLinksVal,
        platformConfigVal,
        acceptedTokensVal,
      ),
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export async function submitSignedTx(signedXdr: string): Promise<string> {
  const server = new Horizon.Server(HORIZON_URL);
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function buildSimpleContractTx(
  caller: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<string> {
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(caller);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export const buildWithdrawTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "withdraw");

export const buildCancelTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "cancel_campaign");

export async function buildRefundTx(
  caller: string,
  contractId: string,
): Promise<string> {
  return buildSimpleContractTx(caller, contractId, "refund_single", [
    new Address(caller).toScVal(),
  ]);
}

export async function buildUpdateMetadataTx(
  caller: string,
  contractId: string,
  title: string,
  description: string,
): Promise<string> {
  return buildSimpleContractTx(caller, contractId, "update_metadata", [
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    xdr.ScVal.scvVoid(),
  ]);
}

/**
 * Build a contribute (pledge) transaction XDR.
 * @param caller  - contributor's Stellar address
 * @param contractId - campaign contract ID
 * @param amountXlm  - amount in XLM (converted to stroops internally)
 */
export async function buildContributeTx(
  caller: string,
  contractId: string,
  amountXlm: number,
): Promise<string> {
  const amountStroops = BigInt(Math.round(amountXlm * 1e7));
  return buildSimpleContractTx(caller, contractId, "contribute", [
    nativeToScVal(amountStroops, { type: "i128" }),
  ]);
}

export interface SimulateResult {
  /** Minimum resource fee in stroops */
  minFee: number;
  /** Fee formatted as XLM string for display, e.g. "0.0001234 XLM" */
  minFeeXlm: string;
  /** Transaction XDR with the simulation-populated soroban data attached */
  preparedXdr: string;
}

/**
 * Simulate a transaction against the Soroban RPC before asking the user to sign.
 * - Estimates the resource fee
 * - Detects contract errors early (before the user touches Freighter)
 * - Returns the fee-bumped, simulation-prepared XDR ready for signing
 *
 * Throws a user-friendly Error if simulation fails.
 */
export async function simulateTx(unsignedXdr: string): Promise<SimulateResult> {
  const rpc = new SorobanRpc.Server(RPC_URL);

  const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
  const result = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(result)) {
    // Surface the contract diagnostic message when available
    const msg = result.error ?? "Simulation failed";
    throw new Error(parseSimulationError(msg));
  }

  if (SorobanRpc.Api.isSimulationRestore(result)) {
    throw new Error(
      "This transaction requires a ledger entry restore. Please try again shortly.",
    );
  }

  const success = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;

  // Attach soroban auth + resource data to the transaction
  const prepared = SorobanRpc.assembleTransaction(tx, success).build();

  const minFee = Number(success.minResourceFee ?? 0);
  const minFeeXlm = (minFee / 1e7).toFixed(7).replace(/\.?0+$/, "") + " XLM";

  return { minFee, minFeeXlm, preparedXdr: prepared.toXDR() };
}

/** Extract a readable message from a Soroban diagnostic error string. */
function parseSimulationError(raw: string): string {
  // Contract errors often look like: "HostError: Value(ContractError(N))\n..."
  const contractMatch = raw.match(/ContractError\((\d+)\)/);
  if (contractMatch) return `Contract error code ${contractMatch[1]}. Please check your inputs.`;
  if (raw.includes("below minimum")) return "Amount is below the campaign's minimum contribution.";
  if (raw.includes("deadline")) return "This campaign's deadline has passed.";
  if (raw.includes("Cancelled")) return "This campaign has been cancelled.";
  // Fallback: trim to first line so we don't dump a wall of XDR at the user
  return raw.split("\n")[0] ?? "Simulation failed. Please try again.";
}

// ── Transaction history (Horizon) ─────────────────────────────────────────────

export interface ContributionRecord {
  txHash: string;
  contributor: string;   // source account of the invoking transaction
  amountXlm: number;     // parsed from the invoke_host_function operation
  timestamp: string;     // ISO string
}

/**
 * Fetch the 10 most recent contract invocations for a campaign contract
 * using the Horizon operations endpoint.
 *
 * We filter for `invoke_host_function` operations whose function name
 * matches "contribute". Amount is read from the first i128 argument.
 * Returns an empty array when the contract account has no history yet.
 */
export async function fetchAllCampaigns(): Promise<CampaignData[]> {
  if (CONTRACT_IDS.length === 0) return [];
  const results = await Promise.allSettled(
    CONTRACT_IDS.map((id) => fetchCampaign(id))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<CampaignData> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function fetchCampaignData(contractId: string): Promise<CampaignData> {
  const [stats, deadline, title, description] = await Promise.all([
    simulateView(contractId, "get_stats"),
    simulateView(contractId, "deadline"),
    simulateView(contractId, "title"),
    simulateView(contractId, "description"),
  ]);

  // stats shape: { total_raised, goal, progress_bps, contributor_count, average_contribution, ... }
  const raisedStroops = Number(stats.total_raised ?? 0);
  const goalStroops = Number(stats.goal ?? 0);
  const deadlineSecs = Number(deadline);
  const now = Math.floor(Date.now() / 1000);

  let status: CampaignStatus = "Active";
  if (deadlineSecs < now) {
    status = raisedStroops >= goalStroops ? "Successful" : "Refunded";
  }

  return {
    contractId,
    title: String(title),
    description: String(description),
    raised: raisedStroops / 1e7,
    goal: goalStroops / 1e7,
    deadline: new Date(deadlineSecs * 1000).toISOString(),
    creator: "",
    socialLinks: [],
    contributorCount: Number(stats.contributor_count ?? 0),
    averageContribution: Number(stats.average_contribution ?? 0) / 1e7,
    status,
  };
}

// ── Horizon response types (minimal) ─────────────────────────────────────────

interface HorizonOperation {
  type: string;
  transaction_hash: string;
  source_account: string;
  created_at: string;
  /** Present on invoke_host_function ops — base64 XDR of the host function */
  function?: string;
  /** Horizon sometimes surfaces the decoded function name */
  function_name?: string;
  /** Decoded parameters array when available */
  parameters?: { value: string; type: string }[];
}

interface HorizonOperationsPage {
  _embedded?: { records: HorizonOperation[] };
}

/**
 * Attempt to extract the XLM amount from an invoke_host_function operation.
 * Returns null if this is not a "contribute" invocation.
 *
 * Horizon exposes `function_name` on decoded ops. When unavailable we fall
 * back to checking the first numeric parameter as a best-effort heuristic.
 */
function parseContributeAmount(op: HorizonOperation): number | null {
  // Horizon testnet decodes the function name for contract invocations
  if (op.function_name && op.function_name !== "contribute") return null;

  // Try to read the first parameter as the i128 amount in stroops
  const firstParam = op.parameters?.[0];
  if (firstParam) {
    const stroops = Number(firstParam.value);
    if (!isNaN(stroops) && stroops > 0) return stroops / 1e7;
  }

  // If Horizon didn't decode parameters, return a sentinel so the row
  // still appears (amount shown as "—")
  return 0;
}
