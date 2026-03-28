"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { WalletGuard } from "@/components/WalletGuard";
import { useWallet } from "@/context/WalletContext";
import { buildInitializeTx, submitSignedTx } from "@/lib/soroban";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { uploadToPinata } from "@/lib/pinata";
import {
  validateTitle,
  validateDescription,
  validateGoal,
  validateDeadline,
  validateMinContribution,
  validateFeeBps,
  sanitizeTitle,
  sanitizeDescription,
} from "@/lib/validation";

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
  "w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500";
const labelCls = "block text-sm text-gray-600 dark:text-gray-400 mb-1";

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

interface FieldWithErrorProps {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}

function FieldWithError({ label, error, children }: FieldWithErrorProps) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Step1({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  const titleError = data.title ? validateTitle(data.title) : null;
  const descError = data.description ? validateDescription(data.description) : null;
  const goalError = data.goal ? validateGoal(data.goal) : null;
  const deadlineError = data.deadline ? validateDeadline(data.deadline) : null;
  const minContribError = data.minContribution ? validateMinContribution(data.minContribution, data.goal) : null;

  return (
    <div className="space-y-4">
      <Field label="Contract ID">
        <input className={inputCls} placeholder="C..." value={data.contractId} onChange={(e) => set("contractId", e.target.value)} />
      </Field>
      <Field label="Token Address">
        <input className={inputCls} placeholder="C..." value={data.token} onChange={(e) => set("token", e.target.value)} />
      </Field>
      <FieldWithError label="Title" error={titleError}>
        <input className={inputCls} placeholder="My Campaign" value={data.title} onChange={(e) => set("title", e.target.value)} />
      </FieldWithError>
      <FieldWithError label="Description" error={descError}>
        <textarea rows={3} className={inputCls} placeholder="What are you raising funds for?" value={data.description} onChange={(e) => set("description", e.target.value)} />
      </FieldWithError>
      <div className="grid grid-cols-2 gap-4">
        <FieldWithError label="Goal (XLM)" error={goalError}>
          <input type="number" min="1" className={inputCls} placeholder="10000" value={data.goal} onChange={(e) => set("goal", e.target.value)} />
        </FieldWithError>
        <FieldWithError label="Min Contribution (XLM)" error={minContribError}>
          <input type="number" min="1" className={inputCls} placeholder="1" value={data.minContribution} onChange={(e) => set("minContribution", e.target.value)} />
        </FieldWithError>
      </div>
      <FieldWithError label="Deadline" error={deadlineError}>
        <input type="date" className={inputCls} value={data.deadline} min={new Date().toISOString().split("T")[0]} onChange={(e) => set("deadline", e.target.value)} />
      </FieldWithError>
    </div>
  );
}

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

function Step2({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) { setUploadError("Only PNG, JPG, or WebP allowed."); return; }
    if (file.size > MAX_SIZE) { setUploadError("File must be under 5 MB."); return; }

    setUploadError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const cid = await uploadToPinata(file);
      set("imageUrl", cid);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Campaign Image (PNG / JPG / WebP, max 5 MB)">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-indigo-500 transition">
          <span className="text-sm text-gray-400">
            {uploading ? "Uploading…" : "Click to select a file"}
          </span>
          <input type="file" accept={ACCEPTED.join(",")} className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      </Field>

      {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="preview" className="w-full h-48 object-cover rounded-xl border border-gray-700" />
      )}

      {data.imageUrl && !uploading && (
        <p className="text-xs text-gray-500 break-all">Stored as: {data.imageUrl}</p>
      )}
    </div>
  );
}

function Step3({ data, set }: { data: FormData; set: (k: keyof FormData, v: string) => void }) {
  const feeError = data.feeBps ? validateFeeBps(data.feeBps) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Optional. Leave blank to skip the platform fee.
      </p>
      <Field label="Platform Fee Address">
        <input className={inputCls} placeholder="G... or C..." value={data.feeAddress} onChange={(e) => set("feeAddress", e.target.value)} />
      </Field>
      <FieldWithError label="Fee (basis points, e.g. 250 = 2.5%)" error={feeError}>
        <input type="number" min="0" max="10000" className={inputCls} placeholder="0" value={data.feeBps} onChange={(e) => set("feeBps", e.target.value)} />
      </FieldWithError>
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
    
    const titleErr = validateTitle(data.title);
    if (titleErr) return titleErr;
    
    const descErr = validateDescription(data.description);
    if (descErr) return descErr;
    
    const goalErr = validateGoal(data.goal);
    if (goalErr) return goalErr;
    
    const deadlineErr = validateDeadline(data.deadline);
    if (deadlineErr) return deadlineErr;
    
    const minContribErr = validateMinContribution(data.minContribution, data.goal);
    if (minContribErr) return minContribErr;
  }
  if (step === 2) {
    if (data.feeAddress && !data.feeBps) return "Provide fee bps when a fee address is set.";
    
    const feeErr = validateFeeBps(data.feeBps);
    if (feeErr) return feeErr;
  }
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CreateCampaignPage() {
  const { address, signTx, networkMismatch } = useWallet();
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
        title: sanitizeTitle(data.title),
        description: sanitizeDescription(data.description),
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />
      <WalletGuard message="Connect your wallet to create a campaign.">
        {txStatus === "success" ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-6">
            <CheckCircle2 size={48} className="text-green-500 dark:text-green-400" />
            <h2 className="text-2xl font-bold">Campaign Deployed!</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm break-all">Tx: {txHash}</p>
            <button onClick={() => router.push("/")} className="mt-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl transition text-white">
              Back to Home
            </button>
          </div>
        ) : (
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
                          : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-500"
                      }`}
                    >
                      {i < step ? "✓" : i + 1}
                    </div>
                    <span className="text-xs text-gray-500 hidden sm:block">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${i < step ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step content */}
            <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-semibold">{STEPS[step]}</h2>

              {step === 0 && <Step1 data={data} set={set} />}
              {step === 1 && <Step2 data={data} set={set} />}
              {step === 2 && <Step3 data={data} set={set} />}
              {step === 3 && <Step4 data={data} />}

              {validationError && (
                <p className="text-red-500 dark:text-red-400 text-sm">{validationError}</p>
              )}

              {txStatus === "error" && txError && (
                <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-3">
                  <XCircle size={16} className="mt-0.5 shrink-0" />
                  {txError}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={back}
                  disabled={step === 0}
                  className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition"
                >
                  Back
                </button>

                {step < STEPS.length - 1 ? (
                  <button
                    onClick={next}
                    className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl text-sm font-medium transition text-white"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={deploy}
                    disabled={txStatus === "pending" || networkMismatch}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 text-white"
                  >
                    {txStatus === "pending" && <Loader2 size={16} className="animate-spin" />}
                    {txStatus === "pending" ? "Deploying..." : "Sign & Deploy"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </WalletGuard>
    </main>
  );
}
