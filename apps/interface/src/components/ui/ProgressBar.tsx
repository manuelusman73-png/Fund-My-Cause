"use client";

import React from "react";

interface ProgressBarProps {
  progress: number; // 0–100
  animated?: boolean;
}

export function ProgressBar({ progress, animated = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const isFunded = clamped >= 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 relative">
        {/* Progress bar container */}
        <div
          role="progressbar"
          aria-valuenow={Math.round(clamped)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Funding progress: ${Math.round(clamped)}%`}
          className="w-full bg-gray-800 rounded-full h-2 relative overflow-hidden"
        >
          {/* Progress bar fill */}
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isFunded ? "bg-green-500" : "bg-indigo-500"
            } ${animated ? "animate-shimmer" : ""}`}
            style={{ width: `${clamped}%` }}
          />
          {/* 100% milestone marker */}
          <div className="absolute right-0 top-0 h-full w-0.5 bg-gray-600 opacity-50" />
        </div>
      </div>
      {/* Percentage label */}
      <span aria-hidden="true" className={`text-sm font-medium min-w-[3rem] text-right ${
        isFunded ? "text-green-400" : "text-indigo-400"
      }`}>
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
