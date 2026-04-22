"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { formatXlm } from "@/lib/price";
import type { Campaign } from "@/types/campaign";

export interface CampaignCardProps {
  campaign: Campaign;
  onPledge?: (id: string) => void;
  /** Pass null when price fetch failed — USD amounts are hidden */
  xlmPrice?: number | null;
  /** Stagger index for slide-up animation on listing page */
  index?: number;
}

function StatusBadge({ status }: { status: "funded" | "ended" }) {
  return (
    <span
      className={cn(
        "absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-semibold",
        status === "funded"
          ? "bg-green-500/90 text-white"
          : "bg-gray-700/90 text-gray-300"
      )}
    >
      {status === "funded" ? "Funded" : "Ended"}
    </span>
  );
}

export function CampaignCard({ campaign, onPledge, xlmPrice = null, index = 0 }: CampaignCardProps) {
  const progress = campaign.goal > 0 ? (campaign.raised / campaign.goal) * 100 : 0;
  const isFunded = progress >= 100;
  const isEnded = !isFunded && new Date(campaign.deadline) < new Date();
  const isDisabled = isFunded || isEnded;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: "easeOut" }}
      whileHover={{ scale: 1.02, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}
      className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800"
    >
      <div className="relative">
        <div className="relative w-full h-48">
          <Image
            src={campaign.image}
            alt={`${campaign.title} - campaign header image`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
        {isFunded && <StatusBadge status="funded" />}
        {isEnded && <StatusBadge status="ended" />}
      </div>
      <div className="p-5 space-y-3">
        <h2 className="text-lg font-semibold">{campaign.title}</h2>
        <p className="text-gray-400 text-sm line-clamp-2">{campaign.description}</p>
        <ProgressBar progress={progress} />
        <div className="flex justify-between text-sm text-gray-400">
          <span>{formatXlm(campaign.raised, xlmPrice)} raised</span>
          <span>{formatXlm(campaign.goal, xlmPrice)} goal</span>
        </div>
        <CountdownTimer deadline={campaign.deadline} />
        <button
          className="w-full py-2 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          onClick={() => onPledge?.(campaign.id)}
          disabled={isDisabled}
          aria-label={
            isFunded
              ? `${campaign.title} — successfully funded`
              : isEnded
              ? `${campaign.title} — campaign ended`
              : `Pledge to ${campaign.title}`
          }
        >
          {isFunded ? "Successfully Funded" : isEnded ? "Campaign Ended" : "Pledge Now"}
        </button>
      </div>
    </motion.div>
  );
}
