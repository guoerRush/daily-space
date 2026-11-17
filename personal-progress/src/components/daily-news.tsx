"use client";

import { ArrowUpRight, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { useTodayKey } from "@/hooks/use-today-key";
import { formatNewsTime, groupedNews, type NewsBrief } from "@/lib/news-brief";

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

  const brief = edition?.brief.date === date ? edition.brief : null;
  const groups = brief ? groupedNews(brief) : [];

  return (
    <section id="daily-news" aria-labelledby="daily-news-title" className="mt-5 scroll-mt-32 rounded-lg border border-border bg-card/90 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-primary">
          <Newspaper size={19} aria-hidden="true" />
          <h2 id="daily-news-title" className="text-lg font-semibold text-foreground">晨间简报</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {date} · 北京时间
        </p>
      </div>
      {groups.length ? (
        <div className="mt-4 space-y-4">
          {groups.map(({ id, title, stories }) => (
            <section key={id} aria-labelledby={`daily-news-${id}`} className="overflow-hidden rounded-lg border border-border/80">
              <h3 id={`daily-news-${id}`} className="border-b border-border/80 bg-secondary/40 px-4 py-2.5 text-sm font-semibold text-primary">{title}</h3>
              <ol className="list-decimal divide-y divide-border/80 pr-4 pl-9 marker:font-semibold marker:text-primary">
                {stories.map((item) => (
                  <li key={item.topic} className="space-y-2 py-4 pl-1">
                    <h4 className="break-words font-semibold leading-relaxed">{item.title}</h4>
                    {item.summary && item.summary !== item.title && <p className="break-words text-sm leading-relaxed text-foreground/90">{item.summary}</p>}
                    {item.context && <p className="break-words text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">关注点 · </span>{item.context}</p>}
                    {item.next && <p className="break-words text-sm leading-relaxed text-muted-foreground">
                      {item.next.text} <a href={item.next.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-2">{item.next.source}<ArrowUpRight className="ml-0.5 inline-block" size={12} aria-hidden="true" /></a>
                    </p>}
                    <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      {item.source} · {formatNewsTime(item.publishedAt, { month: "numeric", day: "numeric" })} <ArrowUpRight size={12} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : <p role="status" className="mt-4 text-sm text-muted-foreground">
        {failedDate === date || brief ? "新闻来源暂不可用，稍后会自动重试。" : "正在读取最新报道…"}
      </p>}
    </section>
  );
}
