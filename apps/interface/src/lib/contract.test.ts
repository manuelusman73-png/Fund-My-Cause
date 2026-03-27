import { getCampaignInfo, getCampaignStats, contribute, ContractError } from "./contract";

// ── Minimal ScVal stand-ins ───────────────────────────────────────────────────
// We avoid jest.requireActual(@stellar/stellar-sdk) because the minified bundle
// crashes in jsdom. Instead we stub every SDK export the module under test uses.

const mockSimulateTransaction = jest.fn();
const mockSendTransaction = jest.fn();

// Tiny ScVal wrapper — just needs to round-trip through scValToNative
function scv(value: unknown) {
  return { __value: value };
}

jest.mock("@stellar/stellar-sdk", () => {
  class MockServer {
    simulateTransaction = mockSimulateTransaction;
    sendTransaction = mockSendTransaction;
  }

  class MockContract {
    call(method: string, ...args: unknown[]) {
      return { type: "invoke", method, args };
    }
  }

  class MockTransactionBuilder {
    private ops: unknown[] = [];
    addOperation(op: unknown) { this.ops.push(op); return this; }
    setTimeout() { return this; }
    build() {
      const xdr = Buffer.from(JSON.stringify({ ops: this.ops }, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v
      )).toString("base64");
      return {
        toXDR: () => xdr,
        toEnvelope: () => ({ toXDR: () => Buffer.from(xdr, "base64") }),
      };
    }
    static fromXDR(xdr: string) { return { xdr }; }
  }

  class MockAccount {
    constructor(public id: string, public seq: string) {}
  }

  return {
    Contract: MockContract,
    TransactionBuilder: MockTransactionBuilder,
    Account: MockAccount,
    BASE_FEE: "100",
    Networks: { TESTNET: "Test SDF Network ; September 2015" },
    nativeToScVal: (v: unknown) => scv(v),
    scValToNative: (v: { __value: unknown }) => v.__value,
    rpc: {
      Server: MockServer,
      Api: { isSimulationError: (r: { error?: string }) => Boolean(r.error) },
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function simSuccess(value: unknown) {
  return { result: { retval: scv(value) } };
}

beforeEach(() => jest.clearAllMocks());

const CONTRACT_ID = "CABC1234";
const CONTRIBUTOR = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ── getCampaignInfo ───────────────────────────────────────────────────────────

describe("getCampaignInfo", () => {
  it("parses the contract response correctly", async () => {
    mockSimulateTransaction
      .mockResolvedValueOnce(simSuccess("Save the Reef"))
      .mockResolvedValueOnce(simSuccess("Ocean cleanup"))
      .mockResolvedValueOnce(simSuccess(CONTRIBUTOR))
      .mockResolvedValueOnce(simSuccess(10000n))
      .mockResolvedValueOnce(simSuccess(1800000000n));

    const info = await getCampaignInfo(CONTRACT_ID);

    expect(info.title).toBe("Save the Reef");
    expect(info.description).toBe("Ocean cleanup");
    expect(info.creator).toBe(CONTRIBUTOR);
    expect(info.goal).toBe(10000n);
    expect(info.deadline).toBe(1800000000n);
  });

  it("surfaces RPC errors as ContractError", async () => {
    mockSimulateTransaction.mockResolvedValue({ error: "HostError: contract not found" });

    await expect(getCampaignInfo(CONTRACT_ID)).rejects.toThrow(ContractError);
    await expect(getCampaignInfo(CONTRACT_ID)).rejects.toThrow("HostError: contract not found");
  });
});

// ── getCampaignStats ──────────────────────────────────────────────────────────

describe("getCampaignStats", () => {
  it("maps progress_bps to a percentage correctly", async () => {
    mockSimulateTransaction.mockResolvedValue(
      simSuccess({ total_raised: 5000n, progress_bps: 5000n, contributor_count: 12n })
    );

    const stats = await getCampaignStats(CONTRACT_ID);

    expect(stats.totalRaised).toBe(5000n);
    expect(stats.progressPercent).toBe(50); // 5000 bps / 100 = 50 %
    expect(stats.contributorCount).toBe(12);
  });

  it("surfaces RPC errors as ContractError", async () => {
    mockSimulateTransaction.mockResolvedValue({ error: "HostError: out of bounds" });

    await expect(getCampaignStats(CONTRACT_ID)).rejects.toThrow(ContractError);
  });
});

// ── contribute ────────────────────────────────────────────────────────────────

describe("contribute", () => {
  it("builds the correct transaction and calls signTx", async () => {
    const signTx = jest.fn().mockImplementation(async (xdr: string) => xdr);
    mockSendTransaction.mockResolvedValue({ status: "PENDING", hash: "abc123" });

    const hash = await contribute(CONTRACT_ID, CONTRIBUTOR, 100n, signTx);

    expect(signTx).toHaveBeenCalledTimes(1);
    expect(typeof signTx.mock.calls[0][0]).toBe("string");
    expect(signTx.mock.calls[0][0].length).toBeGreaterThan(0);
    expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    expect(hash).toBe("abc123");
  });

  it("throws ContractError when sendTransaction returns ERROR status", async () => {
    const signTx = jest.fn().mockImplementation(async (xdr: string) => xdr);
    mockSendTransaction.mockResolvedValue({ status: "ERROR", errorResult: "op_bad_auth" });

    await expect(contribute(CONTRACT_ID, CONTRIBUTOR, 100n, signTx)).rejects.toThrow(ContractError);
    await expect(contribute(CONTRACT_ID, CONTRIBUTOR, 100n, signTx)).rejects.toThrow("Transaction failed");
  });
});
