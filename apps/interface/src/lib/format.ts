const STROOPS_PER_XLM = 10_000_000n;

/** "1,234.56 XLM" */
export function formatXLM(stroops: bigint): string {
  const xlm = Number(stroops) / Number(STROOPS_PER_XLM);
  return `${xlm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;
}

/** "$1,234.56" */
export function formatUSD(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "GABCD...WXYZ" */
export function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

/** "Mar 19, 2026" */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "5d 3h 22m" or "Ended" */
export function formatTimeLeft(deadline: number): string {
  const diff = deadline * 1000 - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
