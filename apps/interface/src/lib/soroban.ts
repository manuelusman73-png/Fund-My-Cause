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

  return "Active";
}

function stroopsToXlm(value: bigint): number {
  return Number(value) / 10_000_000;
}

function ledgerTimestampToIso(value: bigint): string {
  return new Date(Number(value) * 1000).toISOString();
}

async function simulateView(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
) {
  const rpc = new SorobanRpc.Server(SOROBAN_RPC_URL);
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
  return fetchCampaign(contractId);
}

export async function buildInitializeTx(
  params: InitializeParams,
): Promise<string> {
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
