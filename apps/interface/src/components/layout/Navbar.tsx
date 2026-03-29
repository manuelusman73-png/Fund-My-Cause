"use client";

import React, { useState } from "react";
import { Wallet, Rocket, LogOut, Loader2, Sun, Moon, Menu, X, AlertTriangle } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useTheme } from "@/context/ThemeContext";
import { NETWORK_NAME } from "@/lib/constants";

function truncate(addr: string) {
  return `${addr.substring(0, 5)}...${addr.substring(addr.length - 4)}`;
}

export function Navbar() {
  const { address, xlmBalance, connect, disconnect, isConnecting, isAutoConnecting, error, networkMismatch, walletNetwork } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const addressLabel = address
    ? `${truncate(address)}${xlmBalance !== null ? ` · ${xlmBalance} XLM` : ""}`
    : null;

  return (
    <div>
    <nav className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="flex items-center gap-2 font-bold text-lg">
        <Rocket className="text-indigo-500 dark:text-indigo-400" size={20} />
        <span className="hidden sm:inline">Fund-My-Cause</span>
      </div>

      {/* Desktop menu */}
      <div className="hidden md:flex items-center gap-3">
        {error && <span className="text-red-500 dark:text-red-400 text-sm">{error}</span>}
        {address ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">{addressLabel}</span>
            <button
              onClick={disconnect}
              aria-label="Disconnect wallet"
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              <LogOut size={16} /> Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
          >
            {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            Connect Wallet
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-indigo-600" />}
        </button>
      </div>

      {/* Mobile menu button */}
      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-indigo-600" />}
        </button>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 md:hidden bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 py-4 space-y-4 z-50">
          {error && <span className="text-red-500 dark:text-red-400 text-sm">{error}</span>}
          {address ? (
            <div className="space-y-3">
              <span className="text-sm text-gray-600 dark:text-gray-300 block">{addressLabel}</span>
              <button
                onClick={() => { disconnect(); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition w-full"
              >
                <LogOut size={16} /> Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => { connect(); setMobileMenuOpen(false); }}
              disabled={isConnecting}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-sm font-medium text-white transition disabled:opacity-50 w-full"
            >
              {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
              Connect Wallet
            </button>
          )}
        </div>
      )}
    </nav>
    {networkMismatch && walletNetwork && (
      <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/40 border-b border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 text-sm">
        <AlertTriangle size={15} className="shrink-0" />
        Your wallet is on <strong className="mx-1">{walletNetwork}</strong> but this app uses <strong className="mx-1">{NETWORK_NAME}</strong>. Please switch networks in Freighter.
      </div>
    )}
    {isAutoConnecting && (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs">
        <Loader2 size={12} className="animate-spin" /> Restoring wallet session…
      </div>
    )}
    </div>
  );
}
