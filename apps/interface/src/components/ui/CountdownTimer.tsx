"use client";

import React, { useEffect, useState } from "react";

interface CountdownTimerProps {
  deadline: string; // ISO date string
}

export function CountdownTimer({ deadline }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      
      if (diff <= 0) {
        setTimeLeft("Campaign Ended");
        setIsUrgent(false);
        return;
      }
      
      // Check if less than 24 hours remaining (for red color)
      setIsUrgent(diff < 24 * 60 * 60 * 1000);
      
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      // More than 1 hour: show days, hours, minutes
      if (diff > 3600000) {
        setTimeLeft(`${d}d ${h}h ${m}m left`);
      } else {
        // Less than 1 hour: show hours, minutes, seconds (updating every second)
        setTimeLeft(`${h}h ${m}m ${s}s left`);
      }
    };
    
    update();
    
    // Update every second when under 1 hour, otherwise every minute
    const diff = new Date(deadline).getTime() - Date.now();
    const interval = diff <= 3600000 ? 1000 : 60000;
    const id = setInterval(update, interval);
    
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <p className={`text-xs ${isUrgent ? "text-red-400" : "text-gray-500"}`}>
      {timeLeft}
    </p>
  );
}
