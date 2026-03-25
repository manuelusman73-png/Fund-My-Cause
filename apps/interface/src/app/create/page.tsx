"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { useWallet } from "@/context/WalletContext";
import { buildInitializeTx, submitSignedTx } from "@/lib/soroban";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  contractId: string;
  token: string;
  title: string;
  description: string;
  goal: string;
  deadline: string;
  minContribution: string;
  // Step 2
  imageUrl: string;
  // Step 3
  feeAddress: string;
  feeBps: string;
}

type TxStatus = "idle" | "pending" | "success" | "error";

const STEPS = ["Basic Info", "Media", "Platform Config", "Review & Deploy"];

const INITIAL: FormData = {
  contractId: "",
  token: "",
  title: "",
  description: "",
  goal: "",
  deadline: "",
  minContribution: "1",
  imageUrl: "",
  feeAddress: "",
  feeBps: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500";
const labelCls = "block text-sm text-gray-400 mb-1";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

function Step1({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Contract ID">
        <input className={inputCls} placeholder="C..." value={data.contractId} onChange={(e) => set("contractId", e.target.value)} />
      </Field>
      <Field label="Token Address">
        <input className={inputCls} placeholder="C..." value={data.token} onChange={(e) => set("token", e.target.value)} />
      </Field>
      <Field label="Title">
        <input className={inputCls} placeholder="My Campaign" value={data.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea rows={3} className={inputCls} placeholder="What are you raising funds for?" value={data.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Goal (XLM)">
          <input type="number" min="1" className={inputCls} placeholder="10000" value={data.goal} onChange={(e) => set("goal", e.target.value)} />
        </Field>
        <Field label="Min Contribution (XLM)">
          <input type="number" min="1" className={inputCls} placeholder="1" value={data.minContribution} onChange={(e) => set("minContribution", e.target.value)} />
        </Field>
      </div>
      <Field label="Deadline">
        <input type="date" className={inputCls} value={data.deadline} min={new Date().toISOString().split("T")[0]} onChange={(e) => set("deadline", e.target.value)} />
      </Field>
    </div>
  );
}

function Step2({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Image URL or IPFS URI">
        <input className={inputCls} placeholder="https:// or ipfs://" value={data.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
      </Field>
      {data.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.imageUrl}
          alt="preview"
          className="w-full h-48 object-cover rounded-xl border border-gray-700"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <p className="text-xs text-gray-500">
        Image is stored off-chain. Paste a public URL or an IPFS gateway link.
      </p>
    </div>
  );
}

function Step3({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Optional. Leave blank to skip the platform fee.
      </p>
      <Field label="Platform Fee Address">
        <input className={inputCls} placeholder="G... or C..." value={data.feeAddress} onChange={(e) => set("feeAddress", e.target.value)} />
      </Field>
      <Field label="Fee (basis points, e.g. 250 = 2.5%)">
        <input type="number" min="0" max="10000" className={inputCls} placeholder="0" value={data.feeBps} onChange={(e) => set("feeBps", e.target.value)} />
      </Field>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-gray-800">
      <span className="text-gray-400">{label}</span>
      <span className="text-white max-w-xs truncate text-right">{value || "—"}</span>
    </div>
  );
}

function Step4({ data }: { data: FormData }) {
  const deadlineTs = data.deadline ? new Date(data.deadline).toLocaleDateString() : "—";
  return (
    <div className="space-y-1">
      <ReviewRow label="Contract ID" value={data.contractId} />
      <ReviewRow label="Token" value={data.token} />
      <ReviewRow label="Title" value={data.title} />
      <ReviewRow label="Description" value={data.description} />
      <ReviewRow label="Goal" value={data.goal ? `${data.goal} XLM` : ""} />
      <ReviewRow label="Min Contribution" value={data.minContribution ? `${data.minContribution} XLM` : ""} />
      <ReviewRow label="Deadline" value={deadlineTs} />
      <ReviewRow label="Image" value={data.imageUrl} />
      <ReviewRow label="Fee Address" value={data.feeAddress} />
      <ReviewRow label="Fee (bps)" value={data.feeBps} />
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateStep(step: number, data: FormData): string | null {
  if (step === 0) {
    if (!data.contractId.trim()) return "Contract ID is required.";
    if (!data.token.trim()) return "Token address is required.";
    if (!data.title.trim()) return "Title is required.";
    if (!data.description.trim()) return "Description is required.";
    if (!data.goal || Number(data.goal) <= 0) return "Goal must be greater than 0.";
    if (!data.deadline) return "Deadline is required.";
    if (new Date(data.deadline) <= new Date()) return "Deadline must be in the future.";
  }
  if (step === 2) {
    if (data.feeAddress && !data.feeBps) return "Provide fee bps when a fee address is set.";
    if (data.feeBps && Number(data.feeBps) > 10000) return "Fee cannot exceed 10000 bps (100%).";
  }
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CreateCampaignPage() {
  const { address, connect, isConnecting, signTx } = useWallet();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const set = (k: keyof FormData, v: string) => {
    setData((prev) => ({ ...prev, [k]: v }));
    setValidationError(null);
  };

  const next = () => {
    const err = validateStep(step, data);
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    setStep((s) => s + 1);
  };

  const back = () => { setValidationError(null); setStep((s) => s - 1); };

  const deploy = async () => {
    const err = validateStep(step, data);
    if (err) { setValidationError(err); return; }

    setTxStatus("pending");
    setTxError(null);
    try {
      const deadlineTs = BigInt(Math.floor(new Date(data.deadline).getTime() / 1000));
      const xlmToStroops = (xlm: string) => BigInt(Math.round(Number(xlm) * 10_000_000));

      const xdr = await buildInitializeTx({
        contractId: data.contractId,
        creator: address!,
        token: data.token,
        goal: xlmToStroops(data.goal),
        deadline: deadlineTs,
        minContribution: xlmToStroops(data.minContribution || "1"),
        title: data.title,
        description: data.description,
        socialLinks: data.imageUrl ? [data.imageUrl] : undefined,
        platformFeeAddress: data.feeAddress || undefined,
        platformFeeBps: data.feeBps ? Number(data.feeBps) : undefined,
      });

      const signed = await signTx(xdr);
      const hash = await submitSignedTx(signed);
      // Register contract in dashboard registry
      try {
        const raw = localStorage.getItem("fmc:campaigns");
        const map: Record<string, string[]> = raw ? JSON.parse(raw) : {};
        map[address!] = [...new Set([...(map[address!] ?? []), data.contractId])];
        localStorage.setItem("fmc:campaigns", JSON.stringify(map));
      } catch { /* non-critical */ }
      setTxHash(hash);
      setTxStatus("success");
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Transaction failed.");
      setTxStatus("error");
    }
  };

  // ── Wallet gate ─────────────────────────────────────────────────────────────

  if (!address) {
    return (
      <main className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <p className="text-gray-400">Connect your wallet to create a campaign.</p>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-medium transition disabled:opacity-50"
          >
            {isConnecting && <Loader2 size={16} className="animate-spin" />}
            Connect Wallet
          </button>
        </div>
      </main>
    );
  }

  // ── Post-deploy states ──────────────────────────────────────────────────────

  if (txStatus === "success") {
    return (
      <main className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-6">
          <CheckCircle2 size={48} className="text-green-400" />
          <h2 className="text-2xl font-bold">Campaign Deployed!</h2>
          <p className="text-gray-400 text-sm break-all">Tx: {txHash}</p>
          <button onClick={() => router.push("/")} className="mt-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl transition">
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      <div className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Create Campaign</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition ${
                    i < step
                      ? "bg-indigo-600 text-white"
                      : i === step
                      ? "bg-indigo-500 text-white ring-2 ring-indigo-300"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span className="text-xs text-gray-500 hidden sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < step ? "bg-indigo-600" : "bg-gray-700"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold">{STEPS[step]}</h2>

          {step === 0 && <Step1 data={data} set={set} />}
          {step === 1 && <Step2 data={data} set={set} />}
          {step === 2 && <Step3 data={data} set={set} />}
          {step === 3 && <Step4 data={data} />}

          {validationError && (
            <p className="text-red-400 text-sm">{validationError}</p>
          )}

          {txStatus === "error" && txError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl p-3">
              <XCircle size={16} className="mt-0.5 shrink-0" />
              {txError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <button
              onClick={back}
              disabled={step === 0}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white disabled:opacity-30 transition"
            >
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl text-sm font-medium transition"
              >
                Next
              </button>
            ) : (
              <button
                onClick={deploy}
                disabled={txStatus === "pending"}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                {txStatus === "pending" && <Loader2 size={16} className="animate-spin" />}
                {txStatus === "pending" ? "Deploying..." : "Sign & Deploy"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
