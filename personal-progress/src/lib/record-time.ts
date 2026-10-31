export type RecordTimeSource = {
  date?: string;
  id?: string | number;
  createdAt?: string;
  updatedAt?: string;
};

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function dateKeyTimestamp(date?: string) {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date}T12:00:00`
    : undefined;
}

export function idTimestamp(id?: string | number) {
  const numeric = typeof id === "number" ? id : Number(id);
  if (!Number.isFinite(numeric) || numeric < 946_684_800_000) return undefined;
  const value = new Date(numeric).toISOString();
  return validDate(value) ? value : undefined;
}

export function resolveCreatedAt(source: RecordTimeSource, fallback?: string) {
  if (validDate(source.createdAt)) return source.createdAt;
  const fromId = idTimestamp(source.id);
  if (fromId) return fromId;
  const fromDate = dateKeyTimestamp(source.date);
  if (fromDate) return fromDate;
  if (validDate(source.updatedAt)) return source.updatedAt;
  if (validDate(fallback)) return fallback;
  return new Date().toISOString();
}

export function resolveUpdatedAt(source: RecordTimeSource) {
  return validDate(source.updatedAt)
    ? source.updatedAt
    : resolveCreatedAt(source);
}

export function formatRecordDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function formatRecordDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
