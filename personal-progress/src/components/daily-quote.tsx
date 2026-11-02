"use client";

import { GintokiAvatar } from "@/components/companion-shelf";
import { dailyQuoteForDate } from "@/lib/daily-quotes";

export function DailyQuote() {
  const now = new Date();
  const quote = dailyQuoteForDate(now, 0);
  return <div className="border-b border-border/75 bg-secondary/55"><div className="mx-auto flex min-h-10 max-w-[1500px] items-center justify-center gap-2 px-4 py-1.5 text-center text-sm text-foreground md:px-8"><GintokiAvatar compact /><span className="hidden font-semibold text-primary sm:inline">{quote.source}</span><span className="text-muted-foreground">{quote.quote}</span></div></div>;
}
