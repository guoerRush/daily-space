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

function parseAppleHealthXml(xml: string): WellnessRecord[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror") || !document.querySelector("HealthData")) throw new Error("这不是有效的 Apple 健康 export.xml 文件。");
  const byDate = new Map<string, WellnessRecord>();
  const getRecord = (date: string) => {
    const existing = byDate.get(date) ?? emptyRecord(date);
    byDate.set(date, existing);
    return existing;
  };
  document.querySelectorAll("Record").forEach((node) => {
    const type = node.getAttribute("type") ?? "";
    const date = (node.getAttribute("startDate") ?? "").slice(0, 10);
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return;
    const record = getRecord(date);
    const value = Number(node.getAttribute("value"));
    if (type === "HKQuantityTypeIdentifierStepCount" && Number.isFinite(value)) record.steps = String(Math.round(Number(record.steps || 0) + value));
    if (type === "HKQuantityTypeIdentifierActiveEnergyBurned" && Number.isFinite(value)) record.calories = String(Math.round(Number(record.calories || 0) + value));
    if (type === "HKQuantityTypeIdentifierHeartRate" && Number.isFinite(value)) {
      const samples = Number(record.heartRate.split("|")[1] || 0) + 1;
      const total = Number(record.heartRate.split("|")[0] || 0) + value;
      record.heartRate = `${total}|${samples}`;
    }
    if (type === "HKCategoryTypeIdentifierSleepAnalysis" && (node.getAttribute("value") ?? "").includes("Asleep")) {
      const start = Date.parse(node.getAttribute("startDate") ?? "");
      const end = Date.parse(node.getAttribute("endDate") ?? "");
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) record.sleepHours = String(Number((Number(record.sleepHours || 0) + (end - start) / 3_600_000).toFixed(1)));
    }
  });
  return [...byDate.values()].map((record) => ({ ...record, heartRate: record.heartRate.includes("|") ? String(Math.round(Number(record.heartRate.split("|")[0]) / Number(record.heartRate.split("|")[1]))) : record.heartRate, source: "Apple 健康 export.xml", updatedAt: new Date().toISOString() }));
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

  function importAppleHealth(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseAppleHealthXml(String(reader.result));
        const merged = [...imported, ...records].reduce<WellnessRecord[]>((all, record) => all.some((item) => item.date === record.date) ? all : [...all, record], []).sort((left, right) => right.date.localeCompare(left.date));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setRecords(merged);
        setDraft(merged.find((record) => record.date === todayKey()) ?? emptyRecord());
        setMessage(`已导入 Apple 健康 ${imported.length} 天数据。`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Apple 健康文件导入失败。");
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
        <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={saveRecord} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Save size={16} />保存今日状态</button><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"><CloudUpload size={16} />导入 JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => importRecords(event.target.files?.[0])} /></label><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"><HeartPulse size={16} />导入 Apple 健康 XML<input type="file" accept="application/xml,.xml" className="sr-only" onChange={(event) => importAppleHealth(event.target.files?.[0])} /></label>{message ? <span role="status" className="text-sm text-primary">{message}</span> : null}</div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5 md:p-6"><div className="flex items-center gap-2 text-primary"><ShieldCheck size={19} /><h2 className="font-semibold">健康数据来源</h2></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Apple 健康数据需要由 iPhone 原生应用通过 HealthKit 授权读取，网页无法直接访问 HealthKit。你可以在“健康”App 中导出数据，解压后导入 export.xml。小米运动健康支持官方云端 API，自动同步需要开发者应用授权。</p><div className="mt-4 flex flex-wrap gap-3"><a href="https://developer.apple.com/documentation/healthkit/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary">查看 Apple HealthKit 文档<RefreshCw size={15} /></a><a href="https://dev.mi.com/xiaomihyperos/documentation/detail?pId=2333" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground">查看小米授权文档<RefreshCw size={15} /></a></div></section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5 md:p-6"><h2 className="font-semibold">历史状态</h2>{records.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="px-2 py-2">日期</th>{fields.map(([, label]) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead><tbody>{records.slice(0, 30).map((record) => <tr key={record.date} className="border-b border-border/60"><td className="px-2 py-3 font-medium">{record.date}</td>{fields.map(([key, , unit]) => <td key={key} className="px-2 py-3 text-muted-foreground">{record[key] || "—"} {record[key] ? unit : ""}</td>)}</tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-muted-foreground">保存第一条状态数据后，这里会显示每日历史。</p>}</section>
    </div>
  </AppFrame>;
}
