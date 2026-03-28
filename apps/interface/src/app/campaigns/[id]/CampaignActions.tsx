"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { PledgeModal } from "@/components/ui/PledgeModal";
import {
  fetchContribution,
  buildWithdrawTx,
  simulateTx,
  submitSignedTx,
  buildRefundTx,
  type CampaignStatus 
} from "@/lib/soroban";
import { useToast } from "@/components/ui/Toast";

interface Props {
  contractId: string;
  creator: string;
  deadlinePassed: boolean;
  goalMet: boolean;
  campaignTitle: string;
  status: CampaignStatus;
}

type ActionStatus = "idle" | "simulating" | "signing" | "submitting" | "done" | "error";

export function CampaignActions({
  contractId,
  creator,
  deadlinePassed,
  goalMet,
  campaignTitle,
  status,
}: Props) {
  const { address, connect, signTx, networkMismatch } = useWallet();
  const { addToast } = useToast();
  const [pledging, setPledging] = useState(false);
  const [userContribution, setUserContribution] = useState(0);
  const [actionStatus, setActionStatus] = useState<ActionStatus>("idle");
  const [actionError, setActionError] = useState("");
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  const [refundClaimed, setRefundClaimed] = useState(false);
  const { addToast } = useToast();
  const [txStatus, setTxStatus] = useState<
    "idle" | "pending" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      fetchContribution(contractId, address)
        .then(setUserContribution)
        .catch(() => setUserContribution(0));
    }
  }, [address, contractId]);

  const isCreator = !!address && address === creator;
  const canRefund =
    !!address &&
    deadlinePassed &&
    !goalMet &&
    userContribution > 0 &&
    !refundClaimed;
  const canWithdraw = isCreator && status === "Successful";

  /**
   * Shared simulate → sign → submit flow used by both refund and withdraw.
   */
  async function executeAction(buildXdr: () => Promise<string>, successMsg: string) {
    if (!address) return;
    setActionError("");
    setEstimatedFee(null);

    try {
      // Step 1: build
      setActionStatus("simulating");
      const unsignedXdr = await buildXdr();

      // Step 2: simulate — estimate fee and catch contract errors before signing
      const { minFeeXlm, preparedXdr } = await simulateTx(unsignedXdr);
      setEstimatedFee(minFeeXlm);

      // Step 3: sign
      setActionStatus("signing");
      const signedXdr = await signTx(preparedXdr);

      // Step 4: submit
      setActionStatus("submitting");
      const hash = await submitSignedTx(signedXdr);

      setActionStatus("done");
      addToast(successMsg, "success", hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed.";
      setActionError(msg);
      setActionStatus("error");
      addToast(msg, "error");
    }

  function handleRefund() {
    // buildWithdrawTx reused here; replace with buildRefundTx when available
    executeAction(
      () => buildWithdrawTx(address!, contractId),
      "Refund claimed successfully!",
    );
  }

  function handleWithdraw() {
    executeAction(
      () => buildWithdrawTx(address!, contractId),
      "Funds withdrawn successfully!",
    );
  }

  if (actionStatus === "done") {
    return (
      <p className="text-green-500 dark:text-green-400 text-center py-4">
        Transaction submitted successfully!
      </p>
    );
  }

  const isPending = actionStatus === "simulating" || actionStatus === "signing" || actionStatus === "submitting";

  const pendingLabel: Record<string, string> = {
    simulating: "Simulating…",
    signing: "Waiting for signature…",
    submitting: "Submitting…",
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Pledge — active campaigns only */}
        {status === "Active" && !deadlinePassed && (
          <button
            onClick={() => (address ? setPledging(true) : connect())}
            disabled={networkMismatch}
            className="w-full py-3 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 transition text-white disabled:opacity-50"
          >
            {address ? "Pledge Now" : "Connect Wallet to Pledge"}
          </button>
        )}

        {/* Claim Refund */}
        {canRefund && (
          <>
            {estimatedFee && actionStatus === "idle" && (
              <p className="text-xs text-gray-400 text-center">
                Estimated fee: <span className="text-white font-medium">{estimatedFee}</span>
              </p>
            )}
            <button
              onClick={handleRefund}
              disabled={isPending}
              className="w-full py-3 rounded-xl font-medium bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 transition text-white"
            >
              {isPending
                ? pendingLabel[actionStatus]
                : `Claim Refund (${userContribution.toLocaleString()} XLM)`}
            </button>
          </>
        )}

        {/* Withdraw Funds */}
        {canWithdraw && (
          <>
            {estimatedFee && actionStatus === "idle" && (
              <p className="text-xs text-gray-400 text-center">
                Estimated fee: <span className="text-white font-medium">{estimatedFee}</span>
              </p>
            )}
            <button
              onClick={handleWithdraw}
              disabled={isPending}
              className="w-full py-3 rounded-xl font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 transition text-white"
            >
              {isPending ? pendingLabel[actionStatus] : "Withdraw Funds"}
            </button>
          </>
        )}

        {actionStatus === "error" && (
          <p className="text-red-500 dark:text-red-400 text-sm text-center">{actionError}</p>
        )}
      </div>

      {pledging && (
        <PledgeModal
          campaignTitle={campaignTitle}
          contractId={contractId}
          onClose={() => setPledging(false)}
        />
      )}
    </>
  );
}
