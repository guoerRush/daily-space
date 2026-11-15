"use client";

import { Sun } from "lucide-react";
import { dailyQuoteForDate } from "@/lib/daily-quotes";

export function DailyQuote() {
  const now = new Date();
  const quote = dailyQuoteForDate(now, 0);
  return (
    <div className="border-b border-border/75 bg-secondary/55">
      <div className="mx-auto flex min-h-10 max-w-[1500px] items-center justify-center gap-2 px-4 py-1.5 text-center text-sm text-foreground md:px-8">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#fff4c4] text-[#d19a28]" aria-hidden="true">
          <Sun size={18} strokeWidth={2.2} />
        </span>
        <span className="hidden shrink-0 font-semibold text-primary sm:inline">{quote.source}</span>
        <span className="min-w-0 break-words text-muted-foreground">
          {quote.quote}
          {quote.source === "道德经" && (
            <small className="mt-1 block text-xs leading-relaxed sm:ml-3 sm:mt-0 sm:inline">
              释义：{quote.explanation}
            </small>
          )}
        </span>
      </div>
    </div>
  );
}
