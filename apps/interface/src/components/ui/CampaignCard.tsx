"use client";

import React, { useState } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { PledgeModal } from "@/components/ui/PledgeModal";
import type { Campaign } from "@/types/campaign";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [pledging, setPledging] = useState(false);
  const progress = campaign.goal > 0 ? (campaign.raised / campaign.goal) * 100 : 0;
  const isFunded = progress >= 100;

  return (
    <>
      <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
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
            onClick={() => !isFunded && setPledging(true)}
            disabled={isFunded}
          >
            {isFunded ? "Successfully Funded" : "Pledge Now"}
          </button>
        </div>
      </div>

      {pledging && (
        <PledgeModal campaignTitle={campaign.title} onClose={() => setPledging(false)} />
      )}
    </>
  );
}
