import React from "react";
import { fetchTransactionHistory } from "@/lib/soroban";
import { ExternalLink } from "lucide-react";
import { EmptyState, NoTransactionsIllustration } from "@/components/ui/EmptyState";

interface Props {
  contractId: string;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const network = process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
const STELLAR_EXPERT = `https://stellar.expert/explorer/${network}`;

export async function TransactionHistory({ contractId }: Props) {
  const records = await fetchTransactionHistory(contractId, 10);

  const viewAllUrl = `${STELLAR_EXPERT}/contract/${contractId}`;

  if (records.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent Contributions</h2>
        <EmptyState
          illustration={<NoTransactionsIllustration />}
          title="No contributions yet"
          description="Be the first to pledge and help this campaign reach its goal."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Recent Contributions
        </h2>
        <a
          href={viewAllUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          View all on Stellar Expert
          <ExternalLink size={12} />
        </a>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-2 text-left font-medium">Contributor</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-right font-medium">Date</th>
              <th className="px-4 py-2 text-right font-medium" aria-label="View transaction link">
                <span className="sr-only">Link</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {records.map((r) => (
              <tr
                key={r.txHash}
                className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                  <span title={r.contributor}>{truncate(r.contributor)}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-medium">
                  {r.amountXlm > 0
                    ? `${r.amountXlm.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                  {formatDate(r.timestamp)}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`${STELLAR_EXPERT}/tx/${r.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View transaction on Stellar Expert"
                    className="inline-flex items-center text-indigo-500 hover:text-indigo-400"
                  >
                    <ExternalLink size={14} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
