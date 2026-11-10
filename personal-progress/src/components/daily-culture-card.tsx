"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Film } from "lucide-react";
import { useTodayKey } from "@/hooks/use-today-key";
import { cultureForDate } from "@/lib/daily-culture";

export function DailyCultureCard({ initialDate }: { initialDate: string }) {
  const date = useTodayKey(initialDate);
  const { title, quote, translation, imageUrl, sourceUrl, isFilm } = cultureForDate(date);
  const [failedImage, setFailedImage] = useState<string>();
  const Icon = isFilm ? Film : BookOpen;
  const credit = isFilm ? "TMDB 剧照" : "Project Gutenberg";

  return (
    <figure className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card/90 shadow-sm lg:justify-self-end">
      <div className={`relative grid place-items-center bg-muted ${isFilm ? "aspect-video" : "h-40 bg-secondary/40"}`}>
        {failedImage === imageUrl ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon size={18} aria-hidden="true" /> 图片暂不可用
          </span>
        ) : (
          <Image
            key={imageUrl}
            src={imageUrl}
            alt={`《${title}》${isFilm ? "剧照" : "封面"}`}
            fill
            unoptimized
            className={isFilm ? "object-cover" : "object-contain p-2"}
            onError={() => setFailedImage(imageUrl)}
          />
        )}
      </div>
      <figcaption className="px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-primary">
            <Icon size={14} aria-hidden="true" />
            {isFilm ? "今日电影" : "今日经典"}
          </span>
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
            {credit}<ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>
        <p className="mt-1.5 text-sm font-semibold">《{title}》</p>
        <blockquote className="mt-1 break-words text-sm leading-relaxed text-muted-foreground" lang="en">
          “{quote}”
        </blockquote>
        {translation && (
          <p className="mt-2 text-sm leading-relaxed text-foreground" lang="zh-CN">
            {translation}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
