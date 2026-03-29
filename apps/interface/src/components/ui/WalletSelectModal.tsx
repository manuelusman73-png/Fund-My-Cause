"use client";

import React, { useEffect, useRef } from "react";
import { X, HelpCircle } from "lucide-react";

interface WalletSelectModalProps {
  onSelect: (wallet: "freighter" | "lobstr") => void;
  onClose: () => void;
}

export function WalletSelectModal({ onSelect, onClose }: WalletSelectModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" aria-modal="true">
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="wallet-select-title"
        className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 id="wallet-select-title" className="text-lg font-semibold text-white">Connect Wallet</h2>
          <button onClick={onClose} aria-label="Close wallet selector">
            <X size={20} className="text-gray-400 hover:text-white" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => onSelect("freighter")}
            aria-label="Connect with Freighter browser extension"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-left"
          >
            <span className="text-2xl" aria-hidden="true">🚀</span>
            <div>
              <p className="text-sm font-medium text-white">Freighter</p>
              <p className="text-xs text-gray-400">Browser extension</p>
            </div>
          </button>

          <button
            onClick={() => onSelect("lobstr")}
            aria-label="Connect with LOBSTR via WalletConnect"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-left"
          >
            <span className="text-2xl" aria-hidden="true">🌟</span>
            <div>
              <p className="text-sm font-medium text-white">LOBSTR</p>
              <p className="text-xs text-gray-400">WalletConnect</p>
            </div>
          </button>
        </div>

        <a
          href="https://developers.stellar.org/docs/learn/encyclopedia/wallets"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Learn what a wallet is (opens in new tab)"
          className="flex items-center gap-1 text-xs text-indigo-400 hover:underline"
        >
          <HelpCircle size={13} aria-hidden="true" /> What is a wallet?
        </a>
      </div>
    </div>
  );
}
