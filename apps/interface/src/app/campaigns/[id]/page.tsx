import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
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
      <CampaignDetailContent contractId={id} />
    </main>
  );
}
