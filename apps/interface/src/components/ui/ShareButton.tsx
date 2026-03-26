"use client";

import React, { useState, useRef, useEffect } from "react";
import { Share2, Copy, Check } from "lucide-react";

interface ShareButtonProps {
  campaignId: string;
  campaignTitle: string;
}

export function ShareButton({ campaignId, campaignTitle }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const campaignUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/campaigns/${campaignId}`
    : `/campaigns/${campaignId}`;

  const tweetText = `I just backed "${campaignTitle}" on Fund-My-Cause! ${campaignUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(campaignUrl);
      setCopied(true);
      setShowTooltip(true);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        setShowTooltip(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition relative"
        aria-label="Copy campaign URL"
      >
        {copied ? (
          <>
            <Check size={16} className="text-green-500" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy size={16} />
            <span>Copy Link</span>
          </>
        )}
        
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap z-10">
            Copied to clipboard!
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
          </div>
        )}
      </button>

      <button
        onClick={handleShareTwitter}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white transition"
        aria-label="Share on Twitter"
      >
        <Share2 size={16} />
        <span>Share on X</span>
      </button>
    </div>
  );
}
