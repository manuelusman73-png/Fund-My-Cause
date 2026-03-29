import React from "react";

interface EmptyStateProps {
  illustration: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ illustration, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="text-gray-400 dark:text-gray-600">{illustration}</div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Preset illustrations ──────────────────────────────────────────────────────

export function NoCampaignsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
      <path d="M28 52 L40 28 L52 52 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
      <circle cx="40" cy="44" r="2" fill="currentColor" />
      <line x1="40" y1="36" x2="40" y2="41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function NoDashboardCampaignsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <rect x="14" y="22" width="52" height="36" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="14" y1="34" x2="66" y2="34" stroke="currentColor" strokeWidth="2" />
      <line x1="26" y1="44" x2="44" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="50" x2="38" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="57" cy="47" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="57" y1="43" x2="57" y2="47" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="57" cy="50" r="1" fill="currentColor" />
    </svg>
  );
}

export function NoTransactionsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <rect x="18" y="18" width="44" height="44" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="28" y1="32" x2="52" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="40" x2="52" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="48" x2="40" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
