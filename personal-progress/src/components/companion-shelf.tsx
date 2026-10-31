export function GintokiAvatar({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={compact ? "gintoki-avatar gintoki-avatar-compact" : "gintoki-avatar"}
      role="img"
      aria-label="银时风格的银发陪伴角色"
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
  return (
    <section className="companion-shelf" aria-label="银魂陪伴角">
      <GintokiAvatar />
      <span className="min-w-0">
        <strong className="block text-xs font-semibold text-foreground">银时休息站</strong>
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          认真做事，也要安心休息。
        </span>
      </span>
    </section>
  );
}
