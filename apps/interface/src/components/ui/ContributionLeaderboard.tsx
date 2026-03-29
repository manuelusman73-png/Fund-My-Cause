"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchContributorList, type ContributorEntry } from "@/lib/soroban";
import { formatXLM, formatAddress } from "@/lib/format";

interface Props {
  contractId: string;
  totalRaised: bigint;
  connectedAddress?: string | null;
}

interface LeaderboardRow extends ContributorEntry {
  rank: number;
  pct: string;
  isYou: boolean;
}

export function ContributionLeaderboard({ contractId, totalRaised, connectedAddress }: Props) {
  const { data: rows = [], isLoading } = useQuery<LeaderboardRow[]>({
    queryKey: ["leaderboard", contractId],
    queryFn: async () => {
      const entries = await fetchContributorList(contractId, 0, 10);
      const sorted = [...entries].sort((a, b) => (b.amount > a.amount ? 1 : -1));
      return sorted.map((e, i) => ({
        ...e,
        rank: i + 1,
        pct:
          totalRaised > 0n
            ? ((Number(e.amount) / Number(totalRaised)) * 100).toFixed(1) + "%"
            : "0%",
        isYou: !!connectedAddress && e.address === connectedAddress,
      }));
    },
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-gray-500 animate-pulse">Loading leaderboard…</p>;
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="leaderboard-heading" className="space-y-3">
      <h3 id="leaderboard-heading" className="text-base font-semibold">Top Contributors</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm" aria-label="Contribution leaderboard">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th scope="col" className="px-4 py-2">#</th>
              <th scope="col" className="px-4 py-2">Address</th>
              <th scope="col" className="px-4 py-2 text-right">Amount</th>
              <th scope="col" className="px-4 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.address}
                className={`border-b border-gray-800 last:border-0 ${row.isYou ? "bg-indigo-950/40" : ""}`}
                aria-current={row.isYou ? "true" : undefined}
              >
                <td className="px-4 py-2 text-gray-400">{row.rank}</td>
                <td className="px-4 py-2 font-mono text-gray-300">
                  {formatAddress(row.address)}
                  {row.isYou && (
                    <span className="ml-2 text-xs text-indigo-400 font-semibold" aria-label="your entry">
                      You
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-white">{formatXLM(row.amount)}</td>
                <td className="px-4 py-2 text-right text-gray-400">{row.pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
