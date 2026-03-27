describe("constants", () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  it("uses testnet passphrase and name by default", async () => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_NETWORK: undefined };
    const { NETWORK_PASSPHRASE, NETWORK_NAME } = await import("./constants");
    expect(NETWORK_PASSPHRASE).toBe("Test SDF Network ; September 2015");
    expect(NETWORK_NAME).toBe("testnet");
  });

  it("uses mainnet passphrase and name when NEXT_PUBLIC_NETWORK=mainnet", async () => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_NETWORK: "mainnet" };
    const { NETWORK_PASSPHRASE, NETWORK_NAME } = await import("./constants");
    expect(NETWORK_PASSPHRASE).toBe("Public Global Stellar Network ; September 2015");
    expect(NETWORK_NAME).toBe("mainnet");
  });
});
