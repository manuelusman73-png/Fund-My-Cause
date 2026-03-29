"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { ShareButton } from "@/components/ui/ShareButton";
import { useCampaign } from "@/hooks/useCampaign";
import { CampaignActions } from "./CampaignActions";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatXlm(value: bigint) {
  return (Number(value) / 10_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function ContractIdRow({ contractId }: { contractId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(contractId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-100 px-4 py-3 dark:bg-gray-900">
      <span className="font-mono text-xs text-gray-500 break-all flex-1">{contractId}</span>
      <div className="relative flex items-center gap-2">
        <button
          onClick={handleCopy}
          aria-label="Copy contract ID"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
        >
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          <span className={copied ? "text-green-500" : ""}>{copied ? "Copied!" : "Copy"}</span>
        </button>
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${contractId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on Stellar Expert"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-indigo-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
        >
          <ExternalLink size={13} /> Explorer
        </a>
      </div>
    </div>
  );
}

export function CampaignDetailContent({ contractId }: { contractId: string }) {
  const { info, stats, loading, error, refresh, applyOptimisticContribution, rollbackOptimistic } = useCampaign(contractId);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !info || !stats) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm text-red-600 dark:text-red-300">
            {error ?? "Campaign data is unavailable."}
          </p>
          <button
            onClick={refresh}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const progress =
    stats.goal > 0n
      ? Number((stats.totalRaised * 10_000n) / stats.goal) / 100
      : 0;
  const deadlineIso = new Date(Number(info.deadline) * 1000).toISOString();
  const deadlinePassed = Number(info.deadline) * 1000 < Date.now();
  const goalMet = stats.totalRaised >= stats.goal;

  return (
    <>
      <div className="w-full h-72 overflow-hidden md:h-96 relative">
        <Image
          src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1600"
          alt={info.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div>
          <h1 className="mb-2 text-3xl font-bold">{info.title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-500">
            by{" "}
            <span
              className="font-mono text-gray-500 dark:text-gray-400"
              title={info.creator}
            >
              {truncate(info.creator)}
            </span>
          </p>
        </div>

        <ContractIdRow contractId={contractId} />

        <div className="space-y-2">
          <ProgressBar progress={progress} />
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{formatXlm(stats.totalRaised)} XLM raised</span>
            <span>{formatXlm(stats.goal)} XLM goal</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
          <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
            <p className="text-xl font-semibold">{stats.contributorCount}</p>
            <p className="mt-1 text-xs text-gray-500">Contributors</p>
          </div>
          <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
            <p className="text-xl font-semibold">
              {formatXlm(stats.averageContribution)} XLM
            </p>
            <p className="mt-1 text-xs text-gray-500">Avg. contribution</p>
          </div>
          <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
            <CountdownTimer deadline={deadlineIso} />
            <p className="mt-1 text-xs text-gray-500">Remaining</p>
          </div>
        </div>

        <p className="leading-relaxed text-gray-700 dark:text-gray-300">
          {info.description}
        </p>

        <ShareButton campaignId={contractId} campaignTitle={info.title} />

        {info.socialLinks.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Links</p>
            <ul className="space-y-1">
              {info.socialLinks.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <CampaignActions
          contractId={contractId}
          creator={info.creator}
          deadlinePassed={deadlinePassed}
          goalMet={goalMet}
          campaignTitle={info.title}
          status={info.status}
          onOptimisticContribute={applyOptimisticContribution}
          onRollbackOptimistic={rollbackOptimistic}
        />
      </div>
    </>
  );
}
