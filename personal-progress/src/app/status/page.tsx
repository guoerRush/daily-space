"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, CloudUpload, HeartPulse, Moon, RefreshCw, Save, ShieldCheck, Sparkles, Footprints, Flame } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { todayKey } from "@/lib/journals";

type WellnessRecord = {
  date: string;
  heartRate: string;
  sleepHours: string;
  stress: string;
  steps: string;
  calories: string;
  vitality: string;
  source?: string;
  updatedAt: string;
};

const STORAGE_KEY = "daily-space:wellness";
const fields = [
  ["heartRate", "静息心率", "次/分"],
  ["sleepHours", "睡眠时长", "小时"],
  ["stress", "压力", "分"],
  ["steps", "步数", "步"],
  ["calories", "消耗卡路里", "千卡"],
  ["vitality", "元气值", "分"],
] as const;

const icons = [HeartPulse, Moon, Activity, Footprints, Flame, Sparkles];

function emptyRecord(date = todayKey()): WellnessRecord {
  return { date, heartRate: "", sleepHours: "", stress: "", steps: "", calories: "", vitality: "", source: "手动记录", updatedAt: new Date().toISOString() };
}

function readRecords(value: unknown): WellnessRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WellnessRecord => Boolean(item && typeof item === "object" && typeof (item as WellnessRecord).date === "string"));
}

export default function StatusPage() {
  const [records, setRecords] = useState<WellnessRecord[]>([]);
  const [draft, setDraft] = useState<WellnessRecord>(() => emptyRecord());
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const loaded = stored ? readRecords(JSON.parse(stored)) : [];
        setRecords(loaded.sort((left, right) => right.date.localeCompare(left.date)));
        const today = loaded.find((record) => record.date === todayKey());
        if (today) setDraft(today);
      } catch {
        setMessage("状态数据读取失败，请重试。");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const latest = records[0];
  const cards = useMemo(() => fields.map(([key, label, unit], index) => ({ key, label, unit, value: latest?.[key] || "—", Icon: icons[index] })), [latest]);

  function saveRecord() {
    const next = { ...draft, updatedAt: new Date().toISOString(), source: draft.source || "手动记录" };
    const nextRecords = [next, ...records.filter((record) => record.date !== next.date)].sort((left, right) => right.date.localeCompare(left.date));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    setRecords(nextRecords);
    setDraft(next);
    setMessage(`已保存 ${next.date} 的状态数据。`);
  }

  function importRecords(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = readRecords(JSON.parse(String(reader.result)));
        const merged = [...imported, ...records].reduce<WellnessRecord[]>((all, record) => all.some((item) => item.date === record.date) ? all : [...all, record], []).sort((left, right) => right.date.localeCompare(left.date));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setRecords(merged);
        setDraft(merged.find((record) => record.date === todayKey()) ?? emptyRecord());
        setMessage(`已导入 ${imported.length} 条状态记录。`);
      } catch {
        setMessage("导入失败，请选择 JSON 格式的状态数据文件。");
      }
    };
    reader.readAsText(file);
  }

  return <AppFrame>
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-muted-foreground">心率、睡眠、压力与活动数据</p>
      <h1 className="mt-1 text-2xl font-semibold md:text-3xl">状态</h1>

      <section className="mt-7 rounded-xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(47,102,81,0.05)] md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-primary"><Activity size={19} /><h2 className="font-semibold">最新状态</h2></div><p className="mt-1 text-sm text-muted-foreground">数据按日期保存，方便回看变化趋势。</p></div>{latest ? <span className="text-xs text-muted-foreground">最近记录 {latest.date}</span> : null}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(({ key, label, unit, value, Icon }) => <div key={key} className="rounded-lg border border-border/80 bg-secondary/20 p-4"><div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">{label}</span><Icon size={17} /></div><p className="mt-3 text-2xl font-semibold text-primary">{value}<span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span></p></div>)}</div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">记录每日状态</h2><p className="mt-1 text-sm text-muted-foreground">填写小米运动健康中的当天数据，保存后会带日期归档。</p></div><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays size={14} />当前日期 {draft.date}</span></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-medium">日期<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="mt-2 block w-full border border-input bg-background px-3 py-2" /></label>{fields.map(([key, label, unit]) => <label key={key} className="text-sm font-medium">{label}<span className="ml-1 text-xs font-normal text-muted-foreground">({unit})</span><input inputMode="decimal" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="mt-2 block w-full border border-input bg-background px-3 py-2" placeholder="未填写" /></label>)}</div>
        <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={saveRecord} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Save size={16} />保存今日状态</button><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"><CloudUpload size={16} />导入 JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => importRecords(event.target.files?.[0])} /></label>{message ? <span role="status" className="text-sm text-primary">{message}</span> : null}</div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5 md:p-6"><div className="flex items-center gap-2 text-primary"><ShieldCheck size={19} /><h2 className="font-semibold">小米运动健康同步</h2></div><p className="mt-3 text-sm leading-6 text-muted-foreground">小米官方提供运动健康数据服务，但需要开发者应用完成小米账号授权、服务开通和权限审批。当前页面已准备好每日数据记录与 JSON 导入入口，自动同步需要配置你的小米开放平台应用凭证。</p><div className="mt-4 flex flex-wrap gap-3"><a href="https://dev.mi.com/xiaomihyperos/documentation/detail?pId=2333" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary">查看小米授权文档<RefreshCw size={15} /></a><span className="inline-flex items-center rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">等待授权配置</span></div></section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5 md:p-6"><h2 className="font-semibold">历史状态</h2>{records.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="px-2 py-2">日期</th>{fields.map(([, label]) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead><tbody>{records.slice(0, 30).map((record) => <tr key={record.date} className="border-b border-border/60"><td className="px-2 py-3 font-medium">{record.date}</td>{fields.map(([key, , unit]) => <td key={key} className="px-2 py-3 text-muted-foreground">{record[key] || "—"} {record[key] ? unit : ""}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-muted-foreground">保存第一条状态数据后，这里会显示每日历史。</p>}</section>
    </div>
  </AppFrame>;
}
