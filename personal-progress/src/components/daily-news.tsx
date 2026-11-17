"use client";

import { ArrowUpRight, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { useTodayKey } from "@/hooks/use-today-key";
import { formatNewsTime, marketWatch, newsSections, type NewsBrief } from "@/lib/news-brief";

type NewsResponse = { brief: NewsBrief; published: boolean };

export function DailyNews({ initialDate }: { initialDate: string }) {
  const date = useTodayKey(initialDate);
  const [edition, setEdition] = useState<NewsResponse | null>(null);
  const [failedDate, setFailedDate] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/news", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load news");
        const data = await response.json() as NewsResponse;
        if (!controller.signal.aborted) {
          setEdition(data);
          setFailedDate("");
        }
      } catch {
        if (!controller.signal.aborted) setFailedDate(date);
      }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 10 * 60 * 1_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [date]);

  const current = edition?.brief.date === date ? edition : null;
  const brief = current?.brief;

  return (
    <section id="daily-news" aria-labelledby="daily-news-title" className="mt-5 scroll-mt-32 rounded-lg border border-border bg-card/90 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-primary">
          <Newspaper size={19} aria-hidden="true" />
          <h2 id="daily-news-title" className="text-lg font-semibold text-foreground">每日新闻</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {date} · 北京时间{brief ? ` · ${current.published ? "早间简报" : "最新选读"} ${formatNewsTime(brief.generatedAt, { hour: "2-digit", minute: "2-digit" })}` : ""}
        </p>
      </div>
      {brief && Object.keys(brief.items).length > 0 ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {newsSections.map((section) => (
            <section key={section.title} className="min-w-0 rounded-lg border border-border/80 bg-background/65 p-4">
              <h3 className="font-semibold text-primary">{section.title}</h3>
              <ul className="mt-1 divide-y divide-border/80">
                {section.topics.map((topic) => {
                  const item = brief.items[topic];
                  return (
                    <li key={topic} className="space-y-1.5 py-3 last:pb-0">
                      <p className="text-xs font-medium text-muted-foreground">{topic}</p>
                      {item ? <>
                        <p className="break-words text-sm font-semibold leading-relaxed">{item.title}</p>
                        {item.summary && item.summary !== item.title && <p className="break-words text-sm leading-relaxed text-muted-foreground">{item.summary}</p>}
                        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          {item.source} · {formatNewsTime(item.publishedAt, { month: "numeric", day: "numeric" })} <ArrowUpRight size={12} aria-hidden="true" />
                        </a>
                      </> : <p className="text-sm text-muted-foreground">暂无符合条件的近期报道</p>}
                      {marketWatch[topic] && <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-medium">关注点 · </span>{marketWatch[topic]}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : <p role="status" className="mt-4 text-sm text-muted-foreground">
        {failedDate === date || brief ? "新闻来源暂不可用，稍后会自动重试。" : "正在读取最新报道…"}
      </p>}
    </section>
  );
}
