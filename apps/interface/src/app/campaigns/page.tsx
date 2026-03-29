import React, { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { CampaignCard } from "@/components/ui/CampaignCard";
import { fetchAllCampaigns } from "@/lib/soroban";
import { fetchXlmPrice } from "@/lib/price";
import type { Campaign } from "@/types/campaign";
import { LoadingSkeletonGrid } from "@/components/ui/LoadingSkeleton";
import { EmptyState, NoCampaignsIllustration } from "@/components/ui/EmptyState";

// ── Campaign grid (async server component) ────────────────────────────────────

async function CampaignGrid() {
  const [onChain, xlmPrice] = await Promise.all([fetchAllCampaigns(), fetchXlmPrice()]);

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
      <EmptyState
        illustration={<NoCampaignsIllustration />}
        title="No campaigns yet"
        description="Be the first to launch a campaign on Fund-My-Cause and start raising funds on Stellar."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} xlmPrice={xlmPrice} />)}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { CampaignCard } from "@/components/ui/CampaignCard";
import { PledgeModal } from "@/components/ui/PledgeModal";
import { EmptyState, NoCampaignsIllustration } from "@/components/ui/EmptyState";
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

const PAGE_SIZE = 9;

// ── Inner component (uses useSearchParams) ────────────────────────────────────

function CampaignsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filter = (searchParams.get("filter") as FilterTab) ?? "all";
  const sort = (searchParams.get("sort") as SortOption) ?? "newest";
  const query = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [pledge, setPledge] = useState<string | null>(null);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "" || (key === "filter" && value === "all") || (key === "sort" && value === "newest")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Reset to page 1 when filters change
    if (key !== "page") params.delete("page");
    router.replace(`/campaigns?${params.toString()}`, { scroll: false });
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p === 1) params.delete("page"); else params.set("page", String(p));
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={query}
            onChange={(e) => setParam("q", e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="newest">Newest</option>
          <option value="most-funded">Most Funded</option>
          <option value="ending-soon">Ending Soon</option>
        </select>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8" role="tablist" aria-label="Filter campaigns">
        {FILTER_TABS.map((tab, idx) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={filter === tab.value}
            tabIndex={filter === tab.value ? 0 : -1}
            onClick={() => setParam("filter", tab.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                const next = FILTER_TABS[(idx + 1) % FILTER_TABS.length];
                setParam("filter", next.value);
                (e.currentTarget.parentElement?.children[(idx + 1) % FILTER_TABS.length] as HTMLElement)?.focus();
              } else if (e.key === "ArrowLeft") {
                const prev = FILTER_TABS[(idx - 1 + FILTER_TABS.length) % FILTER_TABS.length];
                setParam("filter", prev.value);
                (e.currentTarget.parentElement?.children[(idx - 1 + FILTER_TABS.length) % FILTER_TABS.length] as HTMLElement)?.focus();
              }
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === tab.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          illustration={<NoCampaignsIllustration />}
          title="No campaigns found"
          description="Try adjusting your search or filters to find what you're looking for."
          action={{ label: "Clear filters", onClick: () => router.replace("/campaigns") }}
        />
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{filtered.length} campaign{filtered.length !== 1 ? "s" : ""} found</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paginated.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onPledge={(id) => setPledge(id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-10">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-30 transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {pledge && (
        <PledgeModal
          campaignTitle={ALL_CAMPAIGNS.find((c) => c.id === pledge)?.title ?? pledge}
          onClose={() => setPledge(null)}
        />
      )}
    </>
  );
}

// ── Page (Suspense boundary required for useSearchParams) ─────────────────────

export default function CampaignsPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Active Campaigns</h1>
        <Suspense fallback={<LoadingSkeletonGrid count={6} />}>
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
