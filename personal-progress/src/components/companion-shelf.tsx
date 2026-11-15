import { dailyQuoteForDate } from "@/lib/daily-quotes";

export function GintokiAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={compact ? "gintoki-avatar gintoki-avatar-compact" : "gintoki-avatar"}
      role="img"
      aria-label="海贼王、银魂与毛选语录陪伴角色"
    >
      <span className="gintoki-hair" />
      <span className="gintoki-face">
        <i className="gintoki-eye gintoki-eye-left" />
        <i className="gintoki-eye gintoki-eye-right" />
        <i className="gintoki-mouth" />
      </span>
      <span className="gintoki-collar" />
    </span>
  );
}

export function CompanionShelf() {
  const quote = dailyQuoteForDate(new Date(), 1);
  return (
    <section className="companion-shelf" aria-label="每日语录陪伴角">
      <GintokiAvatar />
      <span className="min-w-0">
        <strong className="block text-xs font-semibold text-foreground">{quote.source}</strong>
        <span className={quote.source === "道德经" ? "mt-1 block text-sm leading-5 text-muted-foreground" : "mt-1 block text-[11px] leading-4 text-muted-foreground"}>
          {quote.quote}
        </span>
        {quote.source === "道德经" && (
          <small className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground">
            释义：{quote.explanation}
          </small>
        )}
      </span>
    </section>
  );
}
