"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { listCompletions, type CompletionRecord } from "@/lib/completions";

const completionLabels: Record<CompletionRecord["kind"], string> = {
  goal: "目标",
  "goal-task": "目标步骤",
  "plan-task": "待办",
  remark: "备注",
  actual: "实际完成",
};

export function CompletionSummary() {
  const [records, setRecords] = useState<CompletionRecord[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const refresh = () => setRecords(listCompletions());
    const events = [
      "daily-space:completion-history-changed",
      "daily-space:goals-changed",
      "daily-space:plans-changed",
    ];
    refresh();
    events.forEach((event) => window.addEventListener(event, refresh));
    return () =>
      events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);

  const visible = expanded ? records : records.slice(0, 6);

  return (
    <section className="mt-5 border border-[#c8dbe5] bg-[#f5fafc] px-5 py-4 shadow-[0_5px_18px_rgba(66,111,131,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full bg-[#e1f0f5] text-[#426f83]">
            <Archive size={18} />
          </span>
          <div>
            <h3 className="font-semibold text-[#294752]">完成汇总</h3>
            <p className="mt-0.5 text-sm text-[#617a84]">
              已保留 {records.length} 项目标、待办与完成记录
            </p>
          </div>
        </div>
        {records.length > 6 ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#426f83] hover:underline"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? "收起" : "查看全部"}
          </button>
        ) : null}
      </div>
      {visible.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {visible.map((record) => (
            <article
              key={record.id}
              className="flex items-start gap-3 rounded-lg border border-white bg-white/80 px-3 py-2.5"
            >
              <CheckCircle2
                className="mt-0.5 shrink-0 text-[#4e8b70]"
                size={16}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#294752]">
                  {record.title}
                </p>
                <p className="mt-1 text-xs text-[#78909a]">
                  {completionLabels[record.kind]} ·{" "}
                  {new Date(
                    `${record.completedDate}T12:00:00`,
                  ).toLocaleDateString("zh-CN", {
                    month: "numeric",
                    day: "numeric",
                  })}
                  {record.detail ? ` · ${record.detail}` : ""}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-[#c8dbe5] bg-white/55 px-3 py-4 text-sm text-[#78909a]">
          完成第一项目标或待办后，这里会永久保留记录。
        </p>
      )}
    </section>
  );
}
