import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Account,
  nativeToScVal,
  scValToNative,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export interface CampaignInfo {
  title: string;
  description: string;
  creator: string;
  goal: bigint;
  deadline: bigint;
}

export interface CampaignStats {
  totalRaised: bigint;
  progressPercent: number; // progress_bps / 100
  contributorCount: number;
}

function makeRpc() {
  return new SorobanRpc.Server(RPC_URL);
}

async function simulateView(
  contractId: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[] = []
): Promise<unknown> {
  const rpc = makeRpc();
  const contract = new Contract(contractId);
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

export async function getCampaignInfo(contractId: string): Promise<CampaignInfo> {
  const [title, description, creator, goal, deadline] = await Promise.all([
    simulateView(contractId, "title"),
    simulateView(contractId, "description"),
    simulateView(contractId, "creator"),
    simulateView(contractId, "goal"),
    simulateView(contractId, "deadline"),
  ]);
  return {
    title: String(title),
    description: String(description),
    creator: String(creator),
    goal: BigInt(goal as string | number),
    deadline: BigInt(deadline as string | number),
  };
}

export async function getCampaignStats(contractId: string): Promise<CampaignStats> {
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

export async function contribute(
  contractId: string,
  contributor: string,
  amount: bigint,
  signTx: (xdr: string) => Promise<string>
): Promise<string> {
  const rpc = makeRpc();
  const contract = new Contract(contractId);
  const account = new Account(contributor, "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "contribute",
        nativeToScVal(contributor, { type: "address" }),
        nativeToScVal(amount, { type: "i128" })
      )
    )
    .setTimeout(30)
    .build();

  const xdr = tx.toXDR();
  const signed = await signTx(xdr);

  const result = await rpc.sendTransaction(
    TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE)
  );
  if (result.status === "ERROR") {
    throw new ContractError(`Transaction failed: ${result.errorResult}`);
  }
  return result.hash;
}
