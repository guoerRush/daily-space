import { cn } from "@/lib/utils";
import {
  formatRecordDate,
  formatRecordDateTime,
  resolveCreatedAt,
  resolveUpdatedAt,
  type RecordTimeSource,
} from "@/lib/record-time";

type RecordTimestampProps = RecordTimeSource & {
  className?: string;
  showCreatedAt?: boolean;
};

export function RecordTimestamp({
  date,
  id,
  createdAt,
  updatedAt,
  className,
  showCreatedAt = false,
}: RecordTimestampProps) {
  const source = { date, id, createdAt, updatedAt };
  const created = resolveCreatedAt(source);
  const updated = resolveUpdatedAt(source);

  return (
    <p className={cn("text-xs leading-5 text-muted-foreground", className)}>
      {date ? `记录日期：${formatRecordDate(date)}` : null}
      {date && (showCreatedAt || updated) ? " · " : null}
      {showCreatedAt ? `创建：${formatRecordDateTime(created)} · ` : null}
      {`修改：${formatRecordDateTime(updated)}`}
    </p>
  );
}
