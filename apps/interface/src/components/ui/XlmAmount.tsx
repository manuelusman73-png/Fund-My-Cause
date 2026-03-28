import React from "react";
import { formatXlm } from "@/lib/price";

interface XlmAmountProps {
  xlm: number;
  /** Pass null when price fetch failed — USD portion is hidden automatically */
  price: number | null;
  className?: string;
}

/**
 * Renders an XLM amount with an optional USD estimate.
 * Works in both server and client components.
 *
 * Example output: "15,400 XLM (~$2,156 USD)"
 */
export function XlmAmount({ xlm, price, className }: XlmAmountProps) {
  const xlmStr = xlm.toLocaleString(undefined, { maximumFractionDigits: 7 });

  if (price === null) {
    return <span className={className}>{xlmStr} XLM</span>;
  }

  const usd = xlm * price;
  const usdStr = usd.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <span className={className}>
      {xlmStr} XLM{" "}
      <span className="text-gray-500 dark:text-gray-400 font-normal">(~{usdStr} USD)</span>
    </span>
  );
}
