"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { PledgeModal } from "@/components/ui/PledgeModal";
import { TransactionStatus, TxStatus } from "@/components/ui/TransactionStatus";
import { withdraw, refundSingle, getCampaignStats } from "@/lib/contract";
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
  status: "Active" | "Successful" | "Refunded" | "Cancelled";
  /** Total raised in XLM — used to display payout amount after withdraw. */
  raisedXlm?: number;
  /** Minimum contribution in stroops. */
  minContribution?: bigint;
  status: CampaignStatus;
  /** Called with contribution amount (XLM) immediately on submit for optimistic UI */
  onOptimisticContribute?: (amountXlm: number) => void;
  /** Called on tx failure to roll back optimistic update */
  onRollbackOptimistic?: () => void;
}

type ActionStatus = "idle" | "simulating" | "signing" | "submitting" | "done" | "error";

export function CampaignActions({
  contractId,
  creator,
  deadlinePassed,
  goalMet,
  campaignTitle,
  status: initialStatus,
  raisedXlm = 0,
  minContribution,
  onOptimisticContribute,
  onRollbackOptimistic,
}: Props) {
  const { address, connect, signTx, networkMismatch } = useWallet();
  const [pledging, setPledging] = useState(false);
  const [userContribution, setUserContribution] = useState(0);
  const [campaignStatus, setCampaignStatus] = useState(initialStatus);
  const [raised, setRaised] = useState(raisedXlm);
  const [pendingTx, setPendingTx] = useState(false);

  // Withdraw / refund transaction state
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const { addToast } = useToast();

  useEffect(() => {
    if (address) {
      fetchContribution(contractId, address)
        .then(setUserContribution)
        .catch(() => setUserContribution(0));
    }
  }, [address, contractId]);

  const isCreator = !!address && address === creator;
  // Show withdraw only to creator when deadline passed and goal met (or already Successful)
  const canWithdraw =
    isCreator &&
    (campaignStatus === "Successful" || (deadlinePassed && goalMet && campaignStatus === "Active"));
  const canRefund =
    !!address && deadlinePassed && !goalMet && userContribution > 0 && campaignStatus !== "Refunded";

  async function handleWithdraw() {
    if (!address || pendingTx) return;
    setPendingTx(true);
    setTxError("");
    setTxStatus("signing");
    try {
      const hash = await withdraw(contractId, address, async (xdr) => {
        const signed = await signTx(xdr);
        setTxStatus("submitting");
        return signed;
      });
      setTxStatus("confirming");
      setTxHash(hash);
      setTxStatus("success");
      setCampaignStatus("Successful");

      // Refresh stats to get accurate payout amount
      try {
        const stats = await getCampaignStats(contractId);
        setRaised(Number(stats.totalRaised) / 1e7);
      } catch {
        // non-critical
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Withdraw failed.";
      setTxError(msg);
      setTxStatus("error");
    } finally {
      setPendingTx(false);
    }
  }

  async function handleRefund() {
    if (!address || pendingTx) return;
    setPendingTx(true);
    setTxError("");
    setTxStatus("signing");
    try {
      const hash = await refundSingle(contractId, address, async (xdr) => {
        const signed = await signTx(xdr);
        setTxStatus("submitting");
        return signed;
      });
      setTxStatus("confirming");
      setTxHash(hash);
      setTxStatus("success");
      setUserContribution(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refund failed.";
      setTxError(msg);
      setTxStatus("error");
    } finally {
      setPendingTx(false);
    }
  }

  function handleDismiss() {
    setTxStatus("idle");
    setTxHash("");
    setTxError("");
  }

  // Refresh stats after a successful pledge
  async function handlePledgeSuccess() {
    try {
      const stats = await getCampaignStats(contractId);
      setRaised(Number(stats.totalRaised) / 1e7);
    } catch {
      // non-critical
    }
  }

  const isProcessing = txStatus !== "idle" || pendingTx;

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Transaction status overlay for withdraw / refund */}
        {txStatus !== "idle" && (
          <TransactionStatus
            status={txStatus}
            txHash={txHash}
            errorMessage={txError}
            onDismiss={handleDismiss}
          />
        )}

        {/* Success message after withdraw */}
        {txStatus === "success" && txHash && campaignStatus === "Successful" && raised > 0 && (
          <p className="text-green-400 text-sm text-center">
            Funds withdrawn successfully — {raised.toLocaleString()} XLM sent to your wallet.
          </p>
        )}

        {/* Pledge — visible while campaign is active */}
        {campaignStatus === "Active" && !deadlinePassed && (
          <button
            onClick={() => (address ? setPledging(true) : connect())}
            disabled={networkMismatch || isProcessing}
            aria-label={address ? `Pledge to ${campaignTitle}` : "Connect wallet to pledge"}
            className="w-full py-3 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 transition text-white disabled:opacity-50"
          >
            {address ? "Pledge Now" : "Connect Wallet to Pledge"}
          </button>
        )}

        {/* Claim Refund */}
        {canRefund && (
          <button
            onClick={handleRefund}
            disabled={isProcessing}
            aria-label={`Claim refund of ${userContribution.toLocaleString()} XLM`}
            className="w-full py-3 rounded-xl font-medium bg-yellow-600 hover:bg-yellow-500 transition text-white disabled:opacity-50"
          >
            Claim Refund ({userContribution.toLocaleString()} XLM)
          </button>
        )}

        {/* Withdraw Funds — creator only, after deadline + goal met */}
        {canWithdraw && (
          <button
            onClick={handleWithdraw}
            disabled={isProcessing}
            aria-label="Withdraw campaign funds to your wallet"
            className="w-full py-3 rounded-xl font-medium bg-green-600 hover:bg-green-500 transition text-white disabled:opacity-50"
          >
            Withdraw Funds
          </button>
        )}
      </div>

      {pledging && (
        <PledgeModal
          contractId={contractId}
          campaignTitle={campaignTitle}
          minContribution={minContribution}
          onClose={() => setPledging(false)}
          onSuccess={handlePledgeSuccess}
          onOptimisticContribute={onOptimisticContribute}
          onRollbackOptimistic={onRollbackOptimistic}
        />
      )}
    </>
  );
}
