/**
 * Contract interaction layer for the Fund-My-Cause crowdfunding contract.
 * Wraps all Soroban RPC calls using @stellar/stellar-sdk.
 */

import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Account,
  nativeToScVal,
  Address,
  scValToNative,
  rpc as SorobanRpc,
  Horizon,
} from "@stellar/stellar-sdk";
import { CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE, HORIZON_URL } from "@/lib/constants";

/** A function that signs a transaction XDR and returns the signed XDR. */
export type SignFn = (xdr: string) => Promise<string>;

/** Thrown when a contract call fails. */
export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

/** High-level campaign metadata returned by the contract. */
export interface CampaignInfo {
  title: string;
  description: string;
  creator: string;
  /** Goal amount in stroops (1 XLM = 10_000_000 stroops). */
  goal: bigint;
  /** Deadline as a Unix timestamp (seconds). */
  deadline: bigint;
  /** Minimum contribution in stroops. */
  minContribution: bigint;
}

/** Live campaign statistics returned by get_stats. */
export interface CampaignStats {
  /** Total raised in stroops. */
  totalRaised: bigint;
  /** Progress as a percentage (progress_bps / 100). */
  progressPercent: number;
  /** Number of unique contributors. */
  contributorCount: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns a configured Soroban RPC server instance.
 *
 * @param rpcUrl - Optional override; defaults to NEXT_PUBLIC_RPC_URL env var.
 */
export function getContractClient(rpcUrl: string = RPC_URL): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl);
}

/**
 * Simulates a read-only contract call and returns the decoded native value.
 * Uses a dummy account — no signing required.
 */
async function simulateView(
  contractId: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[] = [],
): Promise<unknown> {
  const rpc = getContractClient();
  const contract = new Contract(contractId);
  // Dummy account — only used for simulation, never submitted.
  const account = new Account("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN", "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new ContractError(result.error);
  }
  const sim = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  return scValToNative(sim.result!.retval);
}

/**
 * Builds, prepares, signs, submits, and polls a state-changing contract call.
 * Returns the transaction hash on success.
 */
async function invokeContract(
  caller: string,
  contractId: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  signTx: SignFn,
): Promise<string> {
  const rpc = getContractClient();
  const horizon = new Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(caller);

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Prepare (adds footprint / resource fees)
  const prepared = await rpc.prepareTransaction(tx);
  const signedXdr = await signTx(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sendResult = await rpc.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    throw new ContractError(`Submit failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  // Poll until confirmed
  const hash = sendResult.hash;
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await rpc.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return hash;
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new ContractError(`Transaction failed on-chain: ${hash}`);
    }
    attempts++;
  }
  throw new ContractError(`Transaction not confirmed after polling: ${hash}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches high-level campaign metadata from the contract.
 *
 * @param contractId - The Soroban contract address.
 * @returns Decoded CampaignInfo.
 */
export async function getCampaignInfo(contractId: string = CONTRACT_ID): Promise<CampaignInfo> {
  const [title, description, creator, goal, deadline, minContribution] = await Promise.all([
    simulateView(contractId, "title"),
    simulateView(contractId, "description"),
    simulateView(contractId, "creator"),
    simulateView(contractId, "goal"),
    simulateView(contractId, "deadline"),
    simulateView(contractId, "min_contribution"),
  ]);
  return {
    title: String(title),
    description: String(description),
    creator: String(creator),
    goal: BigInt(goal as string | number),
    deadline: BigInt(deadline as string | number),
    minContribution: BigInt(minContribution as string | number),
  };
}

/**
 * Fetches live campaign statistics (raised amount, progress, contributor count).
 *
 * @param contractId - The Soroban contract address.
 * @returns Decoded CampaignStats.
 */
export async function getCampaignStats(contractId: string = CONTRACT_ID): Promise<CampaignStats> {
  const raw = (await simulateView(contractId, "get_stats")) as {
    total_raised: string | number;
    progress_bps: string | number;
    contributor_count: string | number;
  };
  return {
    totalRaised: BigInt(raw.total_raised),
    progressPercent: Number(raw.progress_bps) / 100,
    contributorCount: Number(raw.contributor_count),
  };
}

/**
 * Submits a contribution to the campaign.
 *
 * @param contractId - The Soroban contract address.
 * @param contributor - The contributor's Stellar public key.
 * @param amount - Contribution amount in stroops.
 * @param signTx - Wallet signing function (e.g. from WalletContext).
 * @returns Transaction hash on success.
 */
export async function contribute(
  contractId: string,
  contributor: string,
  amount: bigint,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(
    contributor,
    contractId,
    "contribute",
    [
      new Address(contributor).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ],
    signTx,
  );
}

/**
 * Withdraws raised funds to the campaign creator after a successful campaign.
 *
 * @param contractId - The Soroban contract address.
 * @param creator - The creator's Stellar public key.
 * @param signTx - Wallet signing function.
 * @returns Transaction hash on success.
 */
export async function withdraw(
  contractId: string,
  creator: string,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(creator, contractId, "withdraw", [], signTx);
}

/**
 * Claims a refund for a single contributor after a failed campaign.
 *
 * @param contractId - The Soroban contract address.
 * @param contributor - The contributor's Stellar public key.
 * @param signTx - Wallet signing function.
 * @returns Transaction hash on success.
 */
export async function refundSingle(
  contractId: string,
  contributor: string,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(
    contributor,
    contractId,
    "refund_single",
    [new Address(contributor).toScVal()],
    signTx,
  );
}
