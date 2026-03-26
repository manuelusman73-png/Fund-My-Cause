"use client";

import React, { useState } from "react";
import { Wallet, Rocket, LogOut, Loader2, Sun, Moon, Menu, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useTheme } from "@/context/ThemeContext";

export function Navbar() {
  const { address, connect, disconnect, isConnecting, error } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
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
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {`${address.substring(0, 5)}...${address.substring(address.length - 4)}`}
            </span>
            <button
              onClick={disconnect}
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
          aria-label="Toggle menu"
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
              <span className="text-sm text-gray-600 dark:text-gray-300 block">
                {`${address.substring(0, 5)}...${address.substring(address.length - 4)}`}
              </span>
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
  );
}
