"use client";

import React, { useEffect } from "react";
import { Loader2, CheckCircle, XCircle, CircleDot, FileSignature, Send, Clock, FlaskConical } from "lucide-react";

export type TxStatus = "idle" | "simulating" | "signing" | "submitting" | "confirming" | "success" | "error";

export interface TransactionStatusProps {
  status: TxStatus;
  txHash?: string;
  errorMessage?: string;
  onDismiss?: () => void;
}

export function TransactionStatus({ status, txHash, errorMessage, onDismiss }: TransactionStatusProps) {
  // Auto-dismiss on success after 5 seconds
  useEffect(() => {
    if (status === "success" && onDismiss) {
      const timer = setTimeout(() => onDismiss(), 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  const steps = [
    { key: "idle",       label: "Idle",       icon: CircleDot },
    { key: "simulating", label: "Simulating", icon: FlaskConical },
    { key: "signing",    label: "Signing",    icon: FileSignature },
    { key: "submitting", label: "Submitting", icon: Send },
    { key: "confirming", label: "Confirming", icon: Clock },
  ];

  const getCurrentStepIndex = () => {
    if (status === "idle")       return 0;
    if (status === "simulating") return 1;
    if (status === "signing")    return 2;
    if (status === "submitting") return 3;
    if (status === "confirming") return 4;
    if (status === "success" || status === "error") return 4;
    return 0;
  };

  const currentIndex = getCurrentStepIndex();

  if (status === "idle") return null;

  return (
    <div className="space-y-4 p-4 bg-gray-800/50 rounded-xl">
      {/* Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLoading =
            isCurrent &&
            (status === "simulating" ||
              status === "signing" ||
              status === "submitting" ||
              status === "confirming");

          return (
            <div key={step.key} className="flex items-center">
              <div
                className={`flex items-center gap-2 ${
                  isCompleted
                    ? "text-green-400"
                    : isCurrent
                    ? "text-indigo-400"
                    : "text-gray-500"
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : isCompleted ? (
                  <CheckCircle size={20} />
                ) : (
                  <Icon size={20} />
                )}
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-2 ${
                    index < currentIndex ? "bg-green-400" : "bg-gray-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Final state */}
      {status === "success" && (
        <div className="flex items-center gap-3 p-3 bg-green-900/30 rounded-lg border border-green-400/30">
          <CheckCircle className="text-green-400" size={24} />
          <div className="flex-1">
            <p className="text-white font-medium">Transaction Successful</p>
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 hover:underline"
              >
                View on Stellar Expert →
              </a>
            )}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-3 p-3 bg-red-900/30 rounded-lg border border-red-400/30">
          <XCircle className="text-red-400" size={24} />
          <div className="flex-1">
            <p className="text-white font-medium">Transaction Failed</p>
            {errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}