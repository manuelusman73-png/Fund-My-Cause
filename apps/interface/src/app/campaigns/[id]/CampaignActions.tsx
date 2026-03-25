"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { PledgeModal } from "@/components/ui/PledgeModal";
import { fetchContribution } from "@/lib/soroban";

interface Props {
  contractId: string;
  creator: string;
  deadlinePassed: boolean;
  goalMet: boolean;
  campaignTitle: string;
  status: "Active" | "Successful" | "Refunded" | "Cancelled";
}

export function CampaignActions({
  contractId,
  creator,
  deadlinePassed,
  goalMet,
  campaignTitle,
  status,
}: Props) {
  const { address, connect } = useWallet();
  const [pledging, setPledging] = useState(false);
  const [userContribution, setUserContribution] = useState(0);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

  useEffect(() => {
    if (address) {
      fetchContribution(contractId, address)
        .then(setUserContribution)
        .catch(() => setUserContribution(0));
    }
  }, [address, contractId]);

  const isCreator = !!address && address === creator;
  const canRefund = !!address && deadlinePassed && !goalMet && userContribution > 0;
  const canWithdraw = isCreator && status === "Successful";

  async function handleRefund() {
    setTxStatus("pending");
    try {
      // TODO: invoke refund_single via Soroban RPC + Freighter signing
      await new Promise((r) => setTimeout(r, 1500)); // placeholder
      setTxStatus("done");
    } catch {
      setTxStatus("error");
    }
  }

  async function handleWithdraw() {
    setTxStatus("pending");
    try {
      // TODO: invoke withdraw via Soroban RPC + Freighter signing
      await new Promise((r) => setTimeout(r, 1500)); // placeholder
      setTxStatus("done");
    } catch {
      setTxStatus("error");
    }
  }

  if (txStatus === "done") {
    return <p className="text-green-400 text-center py-4">Transaction submitted successfully!</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Pledge — always visible when campaign is active */}
        {status === "Active" && !deadlinePassed && (
          <button
            onClick={() => (address ? setPledging(true) : connect())}
            className="w-full py-3 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 transition"
          >
            {address ? "Pledge Now" : "Connect Wallet to Pledge"}
          </button>
        )}

        {/* Claim Refund */}
        {canRefund && (
          <button
            onClick={handleRefund}
            disabled={txStatus === "pending"}
            className="w-full py-3 rounded-xl font-medium bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 transition"
          >
            {txStatus === "pending" ? "Processing…" : `Claim Refund (${userContribution.toLocaleString()} XLM)`}
          </button>
        )}

        {/* Withdraw Funds */}
        {canWithdraw && (
          <button
            onClick={handleWithdraw}
            disabled={txStatus === "pending"}
            className="w-full py-3 rounded-xl font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 transition"
          >
            {txStatus === "pending" ? "Processing…" : "Withdraw Funds"}
          </button>
        )}

        {txStatus === "error" && (
          <p className="text-red-400 text-sm text-center">Transaction failed. Please try again.</p>
        )}
      </div>

      {pledging && (
        <PledgeModal campaignTitle={campaignTitle} onClose={() => setPledging(false)} />
      )}
    </>
  );
}
