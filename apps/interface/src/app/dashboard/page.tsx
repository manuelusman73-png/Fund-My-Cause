"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { WalletGuard } from "@/components/WalletGuard";
import { useWallet } from "@/context/WalletContext";
import { useCampaign } from "@/hooks/useCampaign";
import {
  buildCancelTx,
  buildUpdateMetadataTx,
  buildWithdrawTx,
  submitSignedTx,
  type CampaignInfo,
  type CampaignStats,
  type CampaignStatus,
} from "@/lib/soroban";

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

function formatXlm(value: bigint) {
  return (Number(value) / 10_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  Active: "bg-indigo-900 text-indigo-300",
  Successful: "bg-green-900 text-green-300",
  Refunded: "bg-yellow-900 text-yellow-300",
  Cancelled: "bg-red-900 text-red-300",
  Paused: "bg-slate-800 text-slate-300",
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

type EditableCampaign = {
  contractId: string;
  title: string;
  description: string;
};

function EditModal({
  campaign,
  onClose,
  onSave,
}: {
  campaign: EditableCampaign;
  onClose: () => void;
  onSave: (
    contractId: string,
    title: string,
    description: string,
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [description, setDescription] = useState(campaign.description);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }

    setSaving(true);
    try {
      await onSave(campaign.contractId, title, description);
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold">Edit Metadata</h2>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Title</label>
          <input
            className={inputCls}
            value={title}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setTitle(event.target.value)
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            Description
          </label>
          <textarea
            rows={3}
            className={inputCls}
            value={description}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(event.target.value)
            }
          />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardCampaignCard({
  contractId,
  actionPending,
  onAction,
  onEdit,
  refreshNonce,
}: {
  contractId: string;
  actionPending: string | null;
  onAction: (
    contractId: string,
    action: "withdraw" | "cancel",
  ) => Promise<void>;
  onEdit: (campaign: EditableCampaign) => void;
  refreshNonce: number;
}) {
  const fmtXlm = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const progress = campaign.goal > 0 ? Math.min(100, (campaign.raised / campaign.goal) * 100) : 0;
  const deadline = new Date(campaign.deadline).toLocaleDateString();
  const isExpired = new Date(campaign.deadline) < new Date();

  const canWithdraw = campaign.status === "Successful" || (isExpired && campaign.raised >= campaign.goal);
  const canCancel = campaign.status === "Active";
  const canEdit = campaign.status === "Active";
  const isPending = (action: string) => actionPending === `${campaign.contractId}:${action}`;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-tight">{info.title}</h2>
        <StatusBadge status={info.status} />
      </div>
      <ProgressBar progress={progress} />
      <div className="flex justify-between text-sm text-gray-400">
        <span>{fmtXlm(campaign.raised)} XLM raised</span>
        <span>Goal: {fmtXlm(campaign.goal)} XLM</span>
      </div>
      <p className="text-xs text-gray-500">Deadline: {deadline}</p>
      <p className="truncate font-mono text-xs text-gray-600">{contractId}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {canWithdraw && (
          <button
            onClick={() => onAction(contractId, "withdraw")}
            disabled={!!actionPending}
            className="flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium transition hover:bg-green-600 disabled:opacity-50"
          >
            {isPending("withdraw") && (
              <Loader2 size={12} className="animate-spin" />
            )}
            Withdraw
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => onAction(contractId, "cancel")}
            disabled={!!actionPending}
            className="flex items-center gap-1 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending("cancel") && (
              <Loader2 size={12} className="animate-spin" />
            )}
            Cancel
          </button>
        )}
        {canEdit && (
          <button
            onClick={() =>
              onEdit({
                contractId,
                title: info.title,
                description: info.description,
              })
            }
            disabled={!!actionPending}
            className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium transition hover:bg-gray-600 disabled:opacity-50"
          >
            Edit Metadata
          </button>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { address, signTx, networkMismatch } = useWallet();
  const router = useRouter();

  const [contractIds, setContractIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditableCampaign | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const loadCampaignIds = useCallback((walletAddress: string) => {
    setLoading(true);
    setLoadError(null);

    try {
      setContractIds(getContractIds(walletAddress));
    } catch {
      setContractIds([]);
      setLoadError("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setContractIds([]);
      return;
    }

    loadCampaignIds(address);
  }, [address, loadCampaignIds]);

  const handleAction = async (
    contractId: string,
    action: "withdraw" | "cancel",
  ) => {
    setActionPending(`${contractId}:${action}`);
    try {
      const xdr =
        action === "withdraw"
          ? await buildWithdrawTx(address!, contractId)
          : await buildCancelTx(address!, contractId);
      const signed = await signTx(xdr);
      await submitSignedTx(signed);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setActionPending(null);
    }
  };

  const handleEdit = async (
    contractId: string,
    title: string,
    description: string,
  ) => {
    const xdr = await buildUpdateMetadataTx(
      address!,
      contractId,
      title,
      description,
    );
    const signed = await signTx(xdr);
    await submitSignedTx(signed);
    setRefreshNonce((value) => value + 1);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <WalletGuard message="Connect your wallet to view your dashboard.">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold">My Campaigns</h1>
            <button
              onClick={() => router.push("/create")}
              disabled={networkMismatch}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
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
            <p className="mb-4 text-sm text-yellow-400">{loadError}</p>
          )}

          {!loading && contractIds.length === 0 && (
            <div className="py-20 text-center text-gray-500">
              <p>No campaigns found for this wallet.</p>
              <button
                onClick={() => router.push("/create")}
                className="mt-4 text-sm text-indigo-400 transition hover:text-indigo-300"
              >
                Create your first campaign →
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {contractIds.map((contractId) => (
              <DashboardCampaignCard
                key={contractId}
                contractId={contractId}
                onAction={handleAction}
                onEdit={setEditTarget}
                actionPending={actionPending}
                refreshNonce={refreshNonce}
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
      </WalletGuard>
    </main>
  );
}
