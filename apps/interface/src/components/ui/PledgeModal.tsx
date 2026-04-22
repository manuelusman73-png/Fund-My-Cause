"use client";

import React, { useState, useRef, useEffect  } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { TransactionStatus, TxStatus } from "@/components/ui/TransactionStatus";
import { useToast } from "@/components/ui/Toast";
import { contribute } from "@/lib/contract";
import { useAccountExists } from "@/hooks/useAccountExists";

const XLM_TO_STROOPS = 10_000_000n;
const PLEDGE_DEBOUNCE_MS = 2000;

interface PledgeModalProps {
  contractId: string;
  campaignTitle: string;
  /** Minimum contribution in stroops. */
  minContribution?: bigint;
  onClose: () => void;
  /** Called after a successful pledge so the parent can refresh stats. */
  onSuccess?: () => void;
  /** Called immediately on submit with XLM amount for optimistic UI update. */
  onOptimisticContribute?: (amountXlm: number) => void;
  /** Called on tx failure to roll back optimistic update. */
  onRollbackOptimistic?: () => void;
}

export function PledgeModal({
  contractId,
  campaignTitle,
  minContribution = 1n,
  onClose,
  onSuccess,
  onOptimisticContribute,
  onRollbackOptimistic,
}: PledgeModalProps) {
  const { address, connect, signTx, isSigning } = useWallet();
  const { exists: accountExists, loading: accountLoading } = useAccountExists(address);
  const { addToast } = useToast();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pendingTx, setPendingTx] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = "pledge-modal-title";

  // Focus trap
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const minXlm = Number(minContribution) / 1e7;

  const handlePledge = async () => {
    if (!address) { await connect(); return; }
    if (pendingTx) return;

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
    setPendingTx(true);
    setTxStatus("signing");
    onOptimisticContribute?.(xlm);

    try {
      const hash = await contribute(contractId, address, stroops, async (xdr) => {
        setTxStatus("signing");
        const signed = await signTx(xdr);
        setTxStatus("submitting");
        return signed;
      });

      setTxStatus("confirming");
      setTxHash(hash);
      setTxStatus("success");
      addToast("Pledge submitted successfully!", "success", hash);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed.";
      setErrorMessage(msg);
      setTxStatus("error");
      onRollbackOptimistic?.();
      addToast(msg, "error");
    } finally {
      setPendingTx(false);
    }
  };

  const handlePledgeWithDebounce = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(handlePledge, PLEDGE_DEBOUNCE_MS);
  };

  const handleDismiss = () => {
    setTxStatus("idle");
    setTxHash("");
    setErrorMessage("");
  };

  const isProcessing = txStatus !== "idle" || pendingTx || isSigning;

  return (
    // Backdrop: closes modal on click. Keyboard dismissal (Escape) is handled by the focus trap inside the dialog.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={titleId}
        className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 id={titleId} className="text-lg font-semibold">Pledge to {campaignTitle}</h2>
          <button
            onClick={onClose}
            aria-label="Close pledge modal"
            disabled={isProcessing}
          >
            <X size={20} aria-hidden="true" />
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
              {address && !accountLoading && !accountExists && (
                <p className="text-xs text-yellow-400" role="alert">
                  ⚠️ This account is not funded on the network. Your transaction will fail.
                </p>
              )}
              <label htmlFor="pledge-amount" className="sr-only">
                Amount in XLM (minimum {minXlm})
              </label>
              <input
                id="pledge-amount"
                type="number"
                placeholder={`Amount in XLM (min ${minXlm})`}
                value={amount}
                min={minXlm}
                step="0.1"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                disabled={isProcessing}
                aria-label={`Amount in XLM, minimum ${minXlm}`}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
              />
              {minContribution > XLM_TO_STROOPS && (
                <p className="text-xs text-gray-500">Minimum: {minXlm} XLM</p>
              )}
            </div>
            <button
              onClick={handlePledgeWithDebounce}
              disabled={isProcessing}
              aria-label={address ? `Confirm pledge to ${campaignTitle}` : "Connect wallet to pledge"}
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
