/**
 * Minimal Soroban RPC helpers for reading campaign data.
 * Uses the JSON-RPC 2.0 HTTP API — no extra SDK dependency required.
 */

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

// Contract IDs are stored as a comma-separated env var, e.g.:
//   NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS=CABC...,CDEF...
const CONTRACT_IDS: string[] = (
  process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface RpcResponse<T> {
  result?: T;
  error?: { message: string };
}

async function rpcCall<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    next: { revalidate: 30 }, // Next.js cache: refresh every 30 s
  });
  const json: RpcResponse<T> = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

/** Invoke a read-only contract function and return the raw XDR result. */
async function simulateReadOnly(
  contractId: string,
  functionName: string,
  args: unknown[] = []
): Promise<string> {
  const result = await rpcCall<{ results?: { xdr: string }[] }>(
    "simulateTransaction",
    {
      transaction: buildInvokeXdr(contractId, functionName, args),
    }
  );
  const xdr = result.results?.[0]?.xdr;
  if (!xdr) throw new Error(`No result for ${functionName} on ${contractId}`);
  return xdr;
}

/**
 * Builds a minimal base64-encoded XDR envelope for a read-only invocation.
 * We rely on the RPC node to simulate it — no signing needed.
 *
 * In a production app you'd use @stellar/stellar-sdk's TransactionBuilder.
 * Here we call the `simulateTransaction` endpoint with a pre-built XDR string
 * generated via the stellar-sdk on the server, or use `getContractData` for
 * simple storage reads.
 */
function buildInvokeXdr(
  _contractId: string,
  _functionName: string,
  _args: unknown[]
): string {
  // Placeholder — replace with stellar-sdk TransactionBuilder output.
  // The RPC simulation endpoint accepts a signed or unsigned tx envelope XDR.
  throw new Error("buildInvokeXdr: integrate stellar-sdk TransactionBuilder");
}

// ── Public API ────────────────────────────────────────────────────────────────
import {
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
  Horizon,
} from "@stellar/stellar-sdk";

const SERVER_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

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
  platformFeeAddress?: string;
  platformFeeBps?: number;
}

export async function buildInitializeTx(params: InitializeParams): Promise<string> {
  const server = new Horizon.Server(SERVER_URL);
  const account = await server.loadAccount(params.creator);

  const contract = new Contract(params.contractId);

  const socialLinksVal =
    params.socialLinks && params.socialLinks.length > 0
      ? xdr.ScVal.scvVec(params.socialLinks.map((s) => nativeToScVal(s, { type: "string" })))
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
      ),
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export async function submitSignedTx(signedXdr: string): Promise<string> {
  const server = new Horizon.Server(SERVER_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (await import("@stellar/stellar-sdk")).TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE,
  );
  const result = await server.submitTransaction(tx);
  return result.hash;
}

// ── Soroban RPC helpers ───────────────────────────────────────────────────────

import { rpc as SorobanRpc, scValToNative } from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";

async function simulateView(contractId: string, method: string, args: xdr.ScVal[] = []) {
  const rpc = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(contractId);
  // Use a dummy source account for simulation
  const dummyKeypair = (await import("@stellar/stellar-sdk")).Keypair.random();
  const account = new (await import("@stellar/stellar-sdk")).Account(dummyKeypair.publicKey(), "0");
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) throw new Error(result.error);
  const sim = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  return scValToNative(sim.result!.retval);
}

export type CampaignStatus = "Active" | "Successful" | "Refunded" | "Cancelled";

export interface CampaignData {
  contractId: string;
  title: string;
  description: string;
  raised: number;          // stroops → display as XLM (/1e7)
  goal: number;
  deadline: string;        // ISO string derived from ledger timestamp
  creator: string;
  socialLinks: string[];
  contributorCount: number;
  averageContribution: number;
  status: "Active" | "Successful" | "Refunded" | "Cancelled";
}

/**
 * Fetch on-chain stats for a single campaign contract.
 * Uses `getContractData` for simple scalar reads to avoid needing a full tx.
 */
export async function fetchCampaign(contractId: string): Promise<CampaignData> {
  const [titleXdr, descXdr, raisedXdr, goalXdr, creatorXdr, socialXdr, statsXdr] =
    await Promise.all([
      readInstanceEntry(contractId, "Title"),
      readInstanceEntry(contractId, "Description"),
      readInstanceEntry(contractId, "TotalRaised"),
      readInstanceEntry(contractId, "Goal"),
      readInstanceEntry(contractId, "Creator"),
      readInstanceEntry(contractId, "SocialLinks").catch(() => null),
      readInstanceEntry(contractId, "Stats").catch(() => null),
    ]);

  const stats = statsXdr ? decodeStatsXdr(statsXdr) : null;

  return {
    contractId,
    title: decodeStringXdr(titleXdr),
    description: decodeStringXdr(descXdr),
    raised: decodeI128Xdr(raisedXdr) / 1e7,
    goal: decodeI128Xdr(goalXdr) / 1e7,
    deadline: new Date(Date.now() + 30 * 86400_000).toISOString(), // replace with Deadline entry
    creator: decodeAddressXdr(creatorXdr),
    socialLinks: socialXdr ? decodeStringVecXdr(socialXdr) : [],
    contributorCount: stats?.contributorCount ?? 0,
    averageContribution: stats?.averageContribution ?? 0,
    status: "Active",
  };
}

/** Read a single instance storage entry by its DataKey symbol name. */
async function readInstanceEntry(
  contractId: string,
  keyName: string
): Promise<string> {
  // getLedgerEntries accepts base64 XDR LedgerKey values.
  // Build the key XDR for ContractData(contractId, DataKey::<keyName>, Instance).
  const keyXdr = buildInstanceKeyXdr(contractId, keyName);
  const result = await rpcCall<{ entries?: { xdr: string }[] }>(
    "getLedgerEntries",
    { keys: [keyXdr] }
  );
  const xdr = result.entries?.[0]?.xdr;
  if (!xdr) throw new Error(`Entry ${keyName} not found for ${contractId}`);
  return xdr;
}

// ── XDR helpers (stubs — replace with stellar-sdk ScVal decoders) ─────────────

function buildInstanceKeyXdr(_contractId: string, _keyName: string): string {
  throw new Error("buildInstanceKeyXdr: integrate stellar-sdk xdr module");
}

function decodeStringXdr(_xdr: string): string {
  throw new Error("decodeStringXdr: integrate stellar-sdk xdr module");
}

function decodeI128Xdr(_xdr: string): number {
  throw new Error("decodeI128Xdr: integrate stellar-sdk xdr module");
}

function decodeAddressXdr(_xdr: string): string {
  throw new Error("decodeAddressXdr: integrate stellar-sdk xdr module");
}

function decodeStringVecXdr(_xdr: string): string[] {
  throw new Error("decodeStringVecXdr: integrate stellar-sdk xdr module");
}

function decodeStatsXdr(_xdr: string): { contributorCount: number; averageContribution: number } {
  throw new Error("decodeStatsXdr: integrate stellar-sdk xdr module");
}

/** Fetch the contribution amount for a specific address on a contract. */
export async function fetchContribution(
  contractId: string,
  address: string
): Promise<number> {
  const xdr = await readInstanceEntry(contractId, `Contribution:${address}`).catch(() => null);
  return xdr ? decodeI128Xdr(xdr) / 1e7 : 0;
}

/**
 * Fetch all configured campaign contracts in parallel.
 * Returns successfully resolved campaigns; failed ones are silently skipped.
 */
export async function fetchAllCampaigns(): Promise<CampaignData[]> {
  if (CONTRACT_IDS.length === 0) return [];
  const results = await Promise.allSettled(
    CONTRACT_IDS.map((id) => fetchCampaign(id))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<CampaignData> => r.status === "fulfilled")
    .map((r) => r.value);
  totalRaised: bigint;
  goal: bigint;
  deadline: bigint;
  status: CampaignStatus;
}

export async function fetchCampaignData(contractId: string): Promise<CampaignData> {
  const [stats, deadline] = await Promise.all([
    simulateView(contractId, "get_stats"),
    simulateView(contractId, "deadline"),
  ]);
  // stats is { total_raised, goal, progress_bps, contributor_count, ... }
  // We also need status — read via a separate view by checking get_stats fields
  // Status isn't a direct view fn; derive from contract storage via title + stats
  const title = await simulateView(contractId, "title");

  // Derive status: if progress_bps >= 10000 and deadline passed → Successful
  // We expose status indirectly; use a best-effort derivation
  const now = BigInt(Math.floor(Date.now() / 1000));
  const dl = BigInt(deadline);
  const raised = BigInt(stats.total_raised ?? 0);
  const goal = BigInt(stats.goal ?? 0);

  let status: CampaignStatus = "Active";
  if (dl < now) {
    status = raised >= goal ? "Successful" : "Refunded";
  }

  return {
    contractId,
    title: String(title),
    totalRaised: raised,
    goal,
    deadline: dl,
    status,
  };
}

async function buildSimpleContractTx(
  caller: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<string> {
  const server = new Horizon.Server(SERVER_URL);
  const account = await server.loadAccount(caller);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

export const buildWithdrawTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "withdraw");

export const buildCancelTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "cancel_campaign");

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
