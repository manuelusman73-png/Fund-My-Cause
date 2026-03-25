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
