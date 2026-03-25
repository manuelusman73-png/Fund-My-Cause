"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useWallet } from "@/context/WalletContext";
import {
  fetchCampaignData,
  buildWithdrawTx,
  buildCancelTx,
  buildUpdateMetadataTx,
  submitSignedTx,
  CampaignData,
  CampaignStatus,
} from "@/lib/soroban";
import { Loader2, PlusCircle } from "lucide-react";

// ── Local storage key for campaigns created by this wallet ───────────────────
// The app stores { address -> contractId[] } in localStorage after deploy.
// Dashboard reads from that registry.
const REGISTRY_KEY = "fmc:campaigns";

function getContractIds(address: string): string[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const map: Record<string, string[]> = JSON.parse(raw);
    return map[address] ?? [];
  } catch {
    return [];
  }
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CampaignStatus, string> = {
  Active: "bg-indigo-900 text-indigo-300",
  Successful: "bg-green-900 text-green-300",
  Refunded: "bg-yellow-900 text-yellow-300",
  Cancelled: "bg-red-900 text-red-300",
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ── Edit metadata modal ───────────────────────────────────────────────────────

function EditModal({
  campaign,
  onClose,
  onSave,
}: {
  campaign: CampaignData;
  onClose: () => void;
  onSave: (contractId: string, title: string, description: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) { setErr("Title is required."); return; }
    setSaving(true);
    try {
      await onSave(campaign.contractId, title, description);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Edit Metadata</h2>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea rows={3} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Campaign card ─────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onAction,
  onEdit,
  actionPending,
}: {
  campaign: CampaignData;
  onAction: (contractId: string, action: "withdraw" | "cancel") => Promise<void>;
  onEdit: (campaign: CampaignData) => void;
  actionPending: string | null; // contractId:action
}) {
  const stroopsToXlm = (n: bigint) => (Number(n) / 10_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const progress = campaign.goal > BigInt(0) ? Math.min(100, Number((campaign.totalRaised * BigInt(10000)) / campaign.goal) / 100) : 0;
  const deadline = new Date(Number(campaign.deadline) * 1000).toLocaleDateString();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isExpired = campaign.deadline < now;

  const canWithdraw = campaign.status === "Successful" || (isExpired && campaign.totalRaised >= campaign.goal);
  const canCancel = campaign.status === "Active";
  const canEdit = campaign.status === "Active";

  const isPending = (action: string) => actionPending === `${campaign.contractId}:${action}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-base leading-tight">{campaign.title}</h2>
        <StatusBadge status={campaign.status} />
      </div>

      <ProgressBar progress={progress} />

      <div className="flex justify-between text-sm text-gray-400">
        <span>{stroopsToXlm(campaign.totalRaised)} XLM raised</span>
        <span>Goal: {stroopsToXlm(campaign.goal)} XLM</span>
      </div>

      <p className="text-xs text-gray-500">Deadline: {deadline}</p>

      <p className="text-xs text-gray-600 truncate font-mono">{campaign.contractId}</p>

      <div className="flex flex-wrap gap-2 pt-1">
        {canWithdraw && (
          <button
            onClick={() => onAction(campaign.contractId, "withdraw")}
            disabled={!!actionPending}
            className="flex items-center gap-1 bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            {isPending("withdraw") && <Loader2 size={12} className="animate-spin" />}
            Withdraw
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => onAction(campaign.contractId, "cancel")}
            disabled={!!actionPending}
            className="flex items-center gap-1 bg-red-800 hover:bg-red-700 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            {isPending("cancel") && <Loader2 size={12} className="animate-spin" />}
            Cancel
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => onEdit(campaign)}
            disabled={!!actionPending}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            Edit Metadata
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { address, connect, isConnecting, signTx } = useWallet();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CampaignData | null>(null);

  const loadCampaigns = useCallback(async (addr: string) => {
    const ids = getContractIds(addr);
    if (ids.length === 0) { setCampaigns([]); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled(ids.map(fetchCampaignData));
      const loaded = results
        .filter((r): r is PromiseFulfilledResult<CampaignData> => r.status === "fulfilled")
        .map((r) => r.value);
      setCampaigns(loaded);
      if (loaded.length < ids.length) setLoadError("Some campaigns could not be loaded.");
    } catch {
      setLoadError("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address) loadCampaigns(address);
  }, [address, loadCampaigns]);

  // Wallet gate — redirect with message
  if (!address) {
    return (
      <main className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-6">
          <p className="text-gray-400">Connect your wallet to view your dashboard.</p>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-medium transition disabled:opacity-50"
          >
            {isConnecting && <Loader2 size={16} className="animate-spin" />}
            Connect Wallet
          </button>
          <button onClick={() => router.push("/")} className="text-sm text-gray-500 hover:text-gray-300 transition">
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  const handleAction = async (contractId: string, action: "withdraw" | "cancel") => {
    setActionPending(`${contractId}:${action}`);
    try {
      const xdr = action === "withdraw"
        ? await buildWithdrawTx(address, contractId)
        : await buildCancelTx(address, contractId);
      const signed = await signTx(xdr);
      await submitSignedTx(signed);
      await loadCampaigns(address);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Transaction failed.");
    } finally {
      setActionPending(null);
    }
  };

  const handleEdit = async (contractId: string, title: string, description: string) => {
    const xdr = await buildUpdateMetadataTx(address, contractId, title, description);
    const signed = await signTx(xdr);
    await submitSignedTx(signed);
    await loadCampaigns(address);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Campaigns</h1>
          <button
            onClick={() => router.push("/create")}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            <PlusCircle size={16} /> New Campaign
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-indigo-400" />
          </div>
        )}

        {!loading && loadError && (
          <p className="text-yellow-400 text-sm mb-4">{loadError}</p>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p>No campaigns found for this wallet.</p>
            <button onClick={() => router.push("/create")} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm transition">
              Create your first campaign →
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.contractId}
              campaign={c}
              onAction={handleAction}
              onEdit={setEditTarget}
              actionPending={actionPending}
            />
          ))}
        </div>
      </div>

      {editTarget && (
        <EditModal
          campaign={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
        />
      )}
    </main>
  );
}
