"use client";

import { BookOpen } from "lucide-react";
import { useTodayKey } from "@/hooks/use-today-key";
import { personStoryForDate } from "@/lib/daily-person-stories";

export function DailyPersonStory({ initialDate }: { initialDate: string }) {
  const [name, story] = personStoryForDate(useTodayKey(initialDate));

  return (
    <section aria-label="每日人物故事" className="mb-5 max-w-xl rounded-lg border border-border/70 bg-card/60 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <BookOpen size={14} aria-hidden="true" />
          每日人物故事
        </span>
        <h2 className="text-sm font-semibold">{name}</h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{story}</p>
    </section>
  );
}
