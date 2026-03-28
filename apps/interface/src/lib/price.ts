/**
 * Fetches the current XLM/USD price from CoinGecko's public API.
 * Returns null if the API is unavailable — callers should hide USD amounts gracefully.
 *
 * Next.js `revalidate: 300` caches the response for 5 minutes at the edge.
 * @returns {Promise<number|null>} Current XLM price in USD, or null if unavailable
 */
export async function fetchXlmPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
      {
        next: { revalidate: 300 }, // 5-minute server-side cache
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.stellar?.usd;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null; // network error — degrade gracefully
  }
}

/**
 * Format an XLM amount with an optional USD estimate.
 * @param {number} xlm - Amount in XLM
 * @param {number|null} price - Current XLM/USD price, or null to omit USD estimate
 * @returns {string} Formatted string like "15,400 XLM (~$2,156 USD)" or "15,400 XLM"
 * @example
 * formatXlm(15400, 0.14)  // "15,400 XLM (~$2,156 USD)"
 * formatXlm(15400, null)  // "15,400 XLM"
 */
export function formatXlm(xlm: number, price: number | null): string {
  const xlmStr = xlm.toLocaleString(undefined, { maximumFractionDigits: 7 });
  if (price === null) return `${xlmStr} XLM`;
  const usd = xlm * price;
  const usdStr = usd.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return `${xlmStr} XLM (~${usdStr} USD)`;
}
