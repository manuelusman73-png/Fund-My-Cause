"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { TransactionStatus, TxStatus } from "@/components/ui/TransactionStatus";
import { useToast } from "@/components/ui/Toast";
import { contribute } from "@/lib/contract";

const XLM_TO_STROOPS = 10_000_000n;

interface PledgeModalProps {
  contractId: string;
  campaignTitle: string;
  /** Minimum contribution in stroops. */
  minContribution?: bigint;
  onClose: () => void;
  /** Called after a successful pledge so the parent can refresh stats. */
  onSuccess?: () => void;
}

export function PledgeModal({
  contractId,
  campaignTitle,
  minContribution = 1n,
  onClose,
  onSuccess,
}: PledgeModalProps) {
  const { address, connect, signTx } = useWallet();
  const { addToast } = useToast();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const minXlm = Number(minContribution) / 1e7;

  const handlePledge = async () => {
    if (!address) {
      await connect();
      return;
    }

    const xlm = parseFloat(amount);
    if (!amount || isNaN(xlm) || xlm <= 0) {
      addToast("Please enter a valid amount.", "error");
      return;
    }

    const stroops = BigInt(Math.round(xlm * 1e7));
    if (stroops < minContribution) {
      addToast(`Minimum contribution is ${minXlm} XLM.`, "error");
      return;
    }

    setErrorMessage("");
    setTxStatus("signing");

    try {
      setTxStatus("signing");
      const hash = await contribute(contractId, address, stroops, async (xdr) => {
        setTxStatus("signing");
        const signed = await signTx(xdr);
        setTxStatus("submitting");
        return signed;
      });

      setTxStatus("confirming");
      // contribute() already polls — by the time it resolves we're confirmed
      setTxHash(hash);
      setTxStatus("success");
      addToast("Pledge submitted successfully!", "success", hash);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed.";
      setErrorMessage(msg);
      setTxStatus("error");
      addToast(msg, "error");
    }
  };

  const handleDismiss = () => {
    setTxStatus("idle");
    setTxHash("");
    setErrorMessage("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Pledge to {campaignTitle}</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {txStatus !== "idle" ? (
          <TransactionStatus
            status={txStatus}
            txHash={txHash}
            errorMessage={errorMessage}
            onDismiss={handleDismiss}
          />
        ) : (
          <>
            <div className="space-y-1">
              <input
                type="number"
                placeholder={`Amount in XLM (min ${minXlm})`}
                value={amount}
                min={minXlm}
                step="0.1"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none"
              />
              {minContribution > XLM_TO_STROOPS && (
                <p className="text-xs text-gray-500">Minimum: {minXlm} XLM</p>
              )}
            </div>
            <button
              onClick={handlePledge}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl font-medium transition disabled:opacity-50"
            >
              {address ? "Confirm Pledge" : "Connect Wallet to Pledge"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
