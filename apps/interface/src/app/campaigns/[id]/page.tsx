import React from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { ShareButton } from "@/components/ui/ShareButton";
import { TransactionHistory } from "@/components/ui/TransactionHistory";
import { XlmAmount } from "@/components/ui/XlmAmount";
import { fetchCampaign } from "@/lib/soroban";
import { fetchXlmPrice } from "@/lib/price";
import { CampaignActions } from "./CampaignActions";
import { CampaignDetailContent } from "./CampaignDetailContent";

// ── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fund-my-cause.app";
  try {
    const c = await fetchCampaign(id);
    const description = c.description.slice(0, 160);
    const url = `${BASE_URL}/campaigns/${id}`;
    const image = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1200";
    return {
      title: `${c.title} — Fund-My-Cause`,
      description,
      openGraph: {
        title: c.title,
        description,
        url,
        siteName: "Fund-My-Cause",
        images: [{ url: image, width: 1200, height: 630, alt: c.title }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: c.title,
        description,
        images: [image],
      },
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

  let campaign;
  try {
    campaign = await fetchCampaign(id);
  } catch {
    notFound();
  }

  // Fetch XLM price in parallel — null if CoinGecko is unavailable
  const xlmPrice = await fetchXlmPrice();

  const progress = campaign.goal > 0 ? (campaign.raised / campaign.goal) * 100 : 0;
  const deadlinePassed = new Date(campaign.deadline) < new Date();
  const goalMet = campaign.raised >= campaign.goal;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />

      {/* Hero image */}
      <div className="w-full h-72 md:h-96 overflow-hidden relative">
        <Image
          src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=1600"
          alt={campaign.title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
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
            <span><XlmAmount xlm={campaign.raised} price={xlmPrice} /> raised</span>
            <span><XlmAmount xlm={campaign.goal} price={xlmPrice} /> goal</span>
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
              <XlmAmount xlm={campaign.averageContribution} price={xlmPrice} />
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
