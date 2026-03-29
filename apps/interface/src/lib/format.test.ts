import { formatXLM, formatUSD, formatAddress, formatDate, formatTimeLeft } from "./format";

describe("formatXLM", () => {
  it("converts stroops to XLM with comma separator", () => {
    expect(formatXLM(12345600000n)).toBe("1,234.56 XLM");
  });
  it("handles zero", () => {
    expect(formatXLM(0n)).toBe("0.00 XLM");
  });
});

describe("formatUSD", () => {
  it("formats with dollar sign and two decimals", () => {
    expect(formatUSD(1234.56)).toBe("$1,234.56");
  });
  it("handles zero", () => {
    expect(formatUSD(0)).toBe("$0.00");
  });
});

describe("formatAddress", () => {
  it("truncates long addresses", () => {
    expect(formatAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe("GABCD...WXYZ");
  });
  it("returns short addresses unchanged", () => {
    expect(formatAddress("GABC")).toBe("GABC");
  });
});

describe("formatDate", () => {
  it("formats a unix timestamp as a readable date", () => {
    // Use a known future timestamp: 2026-03-19T00:00:00Z = 1774137600
    const result = formatDate(1774137600);
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/2026/);
  });
});

describe("formatTimeLeft", () => {
  it("returns 'Ended' for past deadlines", () => {
    expect(formatTimeLeft(Math.floor(Date.now() / 1000) - 100)).toBe("Ended");
  });
  it("shows days/hours/minutes for future deadlines", () => {
    const future = Math.floor(Date.now() / 1000) + 5 * 86400 + 3 * 3600 + 22 * 60;
    expect(formatTimeLeft(future)).toMatch(/\d+d \d+h \d+m/);
  });
  it("shows only hours and minutes when less than a day", () => {
    const future = Math.floor(Date.now() / 1000) + 3 * 3600 + 22 * 60;
    expect(formatTimeLeft(future)).toMatch(/^\d+h \d+m$/);
  });
});
