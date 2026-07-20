"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type StoredRecord = Record<string, string>;

function collectRecords(): StoredRecord {
  return Object.keys(window.localStorage).filter((key) => key.startsWith("daily-space:") || key.startsWith("journal:") || key.startsWith("mood:")).reduce<StoredRecord>((result, key) => { result[key] = window.localStorage.getItem(key) ?? ""; return result; }, {});
}

function notifyPages() {
  ["daily-space:journals-changed", "daily-space:notes-changed", "daily-space:plans-changed", "daily-space:success-journals-changed", "daily-space:reminder-changed", "daily-space:habits-changed", "daily-space:days-changed"].forEach((name) => window.dispatchEvent(new Event(name)));
}

function parseList<T>(value: string | undefined): T[] {
  try { const parsed = JSON.parse(value ?? "[]"); return Array.isArray(parsed) ? parsed as T[] : []; } catch { return []; }
}

function mergeByKey<T extends Record<string, unknown>>(remote: T[], local: T[], key: keyof T) {
  const merged = new Map<string, T>();
  [...remote, ...local].forEach((item) => {
    const id = String(item[key]);
    const previous = merged.get(id);
    if (!previous || String(item.updatedAt ?? "") >= String(previous.updatedAt ?? "")) merged.set(id, item);
  });
  return [...merged.values()];
}

function mergeRecords(remote: StoredRecord, local: StoredRecord): StoredRecord {
  const merged = { ...remote, ...local };
  const mergeList = (key: string, identity: string) => {
    if (!remote[key] || !local[key]) return;
    const items = mergeByKey(parseList<Record<string, unknown>>(remote[key]), parseList<Record<string, unknown>>(local[key]), identity);
    merged[key] = JSON.stringify(items.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""))));
  };
  mergeList("daily-space:notes", "id");
  mergeList("daily-space:journals", "date");
  mergeList("daily-space:success-journals", "date");
  mergeList("daily-space:goals", "id");
  mergeList("daily-space:habits", "id");
  mergeList("daily-space:special-days", "id");
  mergeList("daily-space:feishu-reminders", "id");
  Object.keys(merged).filter((key) => key.startsWith("daily-space:plan:") && remote[key] && local[key]).forEach((key) => {
    try {
      const remotePlan = JSON.parse(remote[key]) as Record<string, unknown>;
      const localPlan = JSON.parse(local[key]) as Record<string, unknown>;
      const tasks = mergeByKey(parseList<Record<string, unknown>>(JSON.stringify(remotePlan.tasks ?? [])), parseList<Record<string, unknown>>(JSON.stringify(localPlan.tasks ?? [])), "id");
      merged[key] = JSON.stringify({ ...remotePlan, ...localPlan, tasks });
    } catch { /* Keep the local value if an old plan is malformed. */ }
  });
  return merged;
}

export function CloudRecordSync() {
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let timer: number | undefined;
    let active = true;

    const sync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;
      const local = collectRecords();
      const { data } = await supabase.from("user_records").select("records").eq("user_id", session.user.id).maybeSingle();
      const remote = data?.records && typeof data.records === "object" ? data.records as StoredRecord : {};
      const records = mergeRecords(remote, local);
      const changed = Object.entries(records).some(([key, value]) => window.localStorage.getItem(key) !== value);
      Object.entries(records).forEach(([key, value]) => window.localStorage.setItem(key, value));
      if (changed) notifyPages();
      await supabase.from("user_records").upsert({ user_id: session.user.id, records, updated_at: new Date().toISOString() });
    };

    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;
      const { data } = await supabase.from("user_records").select("records").eq("user_id", session.user.id).maybeSingle();
      const records = data?.records as StoredRecord | undefined;
      if (records && Object.keys(records).length) { Object.entries(records).forEach(([key, value]) => window.localStorage.setItem(key, value)); notifyPages(); }
      else await sync();
    };

    void start();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (session) void start(); });
    const schedule = () => { if (timer) window.clearTimeout(timer); timer = window.setTimeout(() => { void sync(); }, 2000); };
    const remoteRefresh = window.setInterval(() => { void sync(); }, 15_000);
    const events = ["daily-space:journals-changed", "daily-space:notes-changed", "daily-space:plans-changed", "daily-space:success-journals-changed", "daily-space:reminder-changed", "daily-space:habits-changed", "daily-space:days-changed"];
    events.forEach((name) => window.addEventListener(name, schedule));
    return () => { active = false; subscription.unsubscribe(); window.clearInterval(remoteRefresh); if (timer) window.clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, schedule)); };
  }, []);
  return null;
}
