"use client";

import React from "react";

export function LoadingSkeleton() {
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 animate-pulse">
      <div className="w-full h-48 bg-gray-800" />
      <div className="p-5 space-y-3">
        {/* Title */}
        <div className="h-5 bg-gray-800 rounded w-3/4" />
        {/* Description */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-5/6" />
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-gray-800 rounded-full" />
        {/* Stats row */}
        <div className="flex justify-between">
          <div className="h-4 bg-gray-800 rounded w-1/3" />
          <div className="h-4 bg-gray-800 rounded w-1/4" />
        </div>
        {/* Countdown */}
        <div className="h-4 bg-gray-800 rounded w-1/2" />
        {/* Button */}
        <div className="h-9 bg-gray-800 rounded-xl" />
      </div>
    </div>
  );
}

export function LoadingSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} />
      ))}
    </div>
  );
}