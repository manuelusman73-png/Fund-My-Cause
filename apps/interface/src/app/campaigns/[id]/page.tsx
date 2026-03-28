import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { ShareButton } from "@/components/ui/ShareButton";
import { TransactionHistory } from "@/components/ui/TransactionHistory";
import { fetchCampaign } from "@/lib/soroban";
import { CampaignDetailContent } from "./CampaignDetailContent";

// ── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const c = await fetchCampaign(id);
    return {
      title: `${c.title} — Fund-My-Cause`,
      description: c.description.slice(0, 160),
    };
  } catch {
    return { title: "Campaign — Fund-My-Cause" };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />

      {/* Hero image */}
      <div className="w-full h-72 md:h-96 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1600"
          alt={campaign.title}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Title + creator */}
        <div>
          <h1 className="text-3xl font-bold mb-2">{campaign.title}</h1>
          <p className="text-gray-600 dark:text-gray-500 text-sm">
            by{" "}
            <span className="font-mono text-gray-500 dark:text-gray-400" title={campaign.creator}>
              {truncate(campaign.creator)}
            </span>
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <ProgressBar progress={progress} />
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{campaign.raised.toLocaleString()} XLM raised</span>
            <span>{campaign.goal.toLocaleString()} XLM goal</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4">
            <p className="text-xl font-semibold">{campaign.contributorCount}</p>
            <p className="text-gray-500 text-xs mt-1">Contributors</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4">
            <p className="text-xl font-semibold">
              {campaign.averageContribution.toLocaleString()} XLM
            </p>
            <p className="text-gray-500 text-xs mt-1">Avg. contribution</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4">
            <CountdownTimer deadline={campaign.deadline} />
            <p className="text-gray-500 text-xs mt-1">Remaining</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{campaign.description}</p>

        {/* Transaction history */}
        <TransactionHistory contractId={id} />

        {/* Share buttons */}
        <ShareButton campaignId={id} campaignTitle={campaign.title} />

        {/* Social links */}
        {campaign.socialLinks.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-gray-500 font-medium">Links</p>
            <ul className="space-y-1">
              {campaign.socialLinks.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm break-all"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons — client component for wallet interaction */}
        <CampaignActions
          contractId={id}
          creator={campaign.creator}
          deadlinePassed={deadlinePassed}
          goalMet={goalMet}
          campaignTitle={campaign.title}
          status={campaign.status}
        />
      </div>
      <CampaignDetailContent contractId={id} />
    </main>
  );
}
