import React, { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { CampaignCard } from "@/components/ui/CampaignCard";
import { fetchAllCampaigns } from "@/lib/soroban";
import type { Campaign } from "@/types/campaign";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CampaignSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 animate-pulse">
      <div className="w-full h-48 bg-gray-800" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-800 rounded w-full" />
        <div className="h-4 bg-gray-800 rounded w-5/6" />
        <div className="h-2 bg-gray-800 rounded-full" />
        <div className="h-4 bg-gray-800 rounded w-1/2" />
        <div className="h-9 bg-gray-800 rounded-xl" />
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => <CampaignSkeleton key={i} />)}
    </div>
  );
}

// ── Campaign grid (async server component) ────────────────────────────────────

async function CampaignGrid() {
  const onChain = await fetchAllCampaigns();

  // Map on-chain data to Campaign shape; fall back to placeholder image
  const campaigns: Campaign[] = onChain.map((c) => ({
    id: c.contractId,
    title: c.title,
    description: c.description,
    raised: c.raised,
    goal: c.goal,
    deadline: c.deadline,
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800",
    contractId: c.contractId,
  }));

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <p className="text-5xl">🌱</p>
        <h2 className="text-xl font-semibold text-white">No campaigns yet</h2>
        <p className="text-gray-400 max-w-sm">
          Be the first to launch a campaign on Fund-My-Cause and start raising funds on Stellar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { PledgeModal } from "@/components/ui/PledgeModal";
import { Campaign } from "@/types/campaign";
import { Search } from "lucide-react";

// ── Mock data (replace with real fetch) ──────────────────────────────────────

const ALL_CAMPAIGNS: Campaign[] = [
  {
    id: "1",
    title: "Eco-Friendly Water Purification",
    description: "A compact, solar-powered water purification system for off-grid communities.",
    raised: 15400,
    goal: 20000,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "2",
    title: "Open Source AI Education Platform",
    description: "Democratizing AI education with free, high-quality interactive courses for everyone.",
    raised: 8200,
    goal: 50000,
    deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1555949963-aa79dcee5789?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "3",
    title: "Community Solar Microgrid",
    description: "Empowering neighborhoods to generate and share sustainable solar energy.",
    raised: 45000,
    goal: 45000,
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "4",
    title: "Decentralized Medical Records",
    description: "Secure, patient-owned health records on the Stellar blockchain.",
    raised: 3000,
    goal: 30000,
    deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800",
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "active" | "funded" | "ended";
type SortOption = "newest" | "most-funded" | "ending-soon";

// ── Helpers ───────────────────────────────────────────────name────────────────

function getStatus(c: Campaign): FilterTab {
  const ended = new Date(c.deadline) < new Date();
  if (c.raised >= c.goal) return "funded";
  if (ended) return "ended";
  return "active";
}

function applyFilter(campaigns: Campaign[], filter: FilterTab): Campaign[] {
  if (filter === "all") return campaigns;
  return campaigns.filter((c) => getStatus(c) === filter);
}

function applySort(campaigns: Campaign[], sort: SortOption): Campaign[] {
  return [...campaigns].sort((a, b) => {
    if (sort === "most-funded") return b.raised / b.goal - a.raised / a.goal;
    if (sort === "ending-soon") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    return Number(b.id) - Number(a.id); // newest = highest id
  });
}

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Funded", value: "funded" },
  { label: "Ended", value: "ended" },
];

// ── Inner component (uses useSearchParams) ────────────────────────────────────

function CampaignsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filter = (searchParams.get("filter") as FilterTab) ?? "all";
  const sort = (searchParams.get("sort") as SortOption) ?? "newest";
  const query = searchParams.get("q") ?? "";

  const [pledge, setPledge] = useState<string | null>(null);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "" || (key === "filter" && value === "all") || (key === "sort" && value === "newest")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`/campaigns?${params.toString()}`, { scroll: false });
  };

  const filtered = applySort(
    applyFilter(
      ALL_CAMPAIGNS.filter(
        (c) =>
          !query ||
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase()),
      ),
      filter,
    ),
    sort,
  );

  return (
    <>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={query}
            onChange={(e) => setParam("q", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="newest">Newest</option>
          <option value="most-funded">Most Funded</option>
          <option value="ending-soon">Ending Soon</option>
        </select>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setParam("filter", tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === tab.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-20">No campaigns match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map((campaign) => {
            const progress = (campaign.raised / campaign.goal) * 100;
            const isFunded = progress >= 100;
            return (
              <div key={campaign.id} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={campaign.image} alt={campaign.title} className="w-full h-48 object-cover" />
                <div className="p-5 space-y-3">
                  <h2 className="text-lg font-semibold">{campaign.title}</h2>
                  <p className="text-gray-400 text-sm">{campaign.description}</p>
                  <ProgressBar progress={progress} />
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{campaign.raised.toLocaleString()} XLM raised</span>
                    <span>{campaign.goal.toLocaleString()} XLM goal</span>
                  </div>
                  <CountdownTimer deadline={campaign.deadline} />
                  <button
                    className="w-full py-2 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    onClick={() => !isFunded && setPledge(campaign.title)}
                    disabled={isFunded}
                  >
                    {isFunded ? "Successfully Funded" : "Pledge Now"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pledge && <PledgeModal campaignTitle={pledge} onClose={() => setPledge(null)} />}
    </>
  );
}

// ── Page (Suspense boundary required for useSearchParams) ─────────────────────

export default function CampaignsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Active Campaigns</h1>
        <Suspense fallback={<GridSkeleton />}>
          {/* @ts-expect-error async server component */}
          <CampaignGrid />
        </Suspense>
      </section>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Campaigns</h1>
        <Suspense fallback={<div className="text-gray-500 text-center py-20">Loading...</div>}>
          <CampaignsInner />
        </Suspense>
      </div>
    </main>
  );
}
