"use client";

import { browserRecords, flushBrowserRecords } from "@/lib/browser-records";
import { useEffect, useRef, useState } from "react";
import { CloudCheck, CloudOff, RefreshCw } from "lucide-react";
import { deactivateAccountStorage } from "@/lib/account-storage";
import { RecordSynchronizer } from "@/lib/record-sync";
import { dispatchStorageChanges, isLocalStorageQuotaError, subscribeToStorageChanges } from "@/lib/storage-contract";
import { getSupabaseClient } from "@/lib/supabase";
import { isCloudQuotaError, syncErrorDetail } from "@/lib/cloud-errors";
import { createDataBackup, downloadDataBackup } from "@/lib/record-backup";

type Status = "pending" | "syncing" | "synced" | "error" | "offline";

export function CloudRecordSync() {
  const [status, setStatus] = useState<Status>("pending");
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");
  const [offerBackup, setOfferBackup] = useState(false);
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let synchronizer: RecordSynchronizer | null = null;
    let timer: number | undefined;
    let retryTimer: number | undefined;
    let retryDelay = 2_000;
    let active = true;
    let generation = 0;
    let ready = false;
    let inFlight = false;
    let changed = 0;
    let restrictedUntil = 0;

    const clearRetry = () => {
      window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const run = async () => {
      if (!active || !synchronizer || inFlight || Date.now() < restrictedUntil) return;
      window.clearTimeout(timer);
      timer = undefined;
      clearRetry();
      const next = synchronizer;
      const currentGeneration = generation;
      const before = changed;
      inFlight = true;
      setStatus(navigator.onLine ? "syncing" : "offline");
      try {
        void flushBrowserRecords().catch(() => {});
        if (!ready) await next.start();
        else await next.sync();
        if (!active || currentGeneration !== generation) return;
        ready = true;
        setOfferBackup(false);
        retryDelay = 2_000;
        setStatus(before === changed ? "synced" : "pending");
        setDetail(`最近同步：${new Date().toLocaleTimeString("zh-CN")}`);
      } catch (error) {
        if (!active || currentGeneration !== generation) return;
        console.error("Daily Space cloud sync failed.", error);
        setStatus(navigator.onLine ? "error" : "offline");
        if (isCloudQuotaError(error)) restrictedUntil = Date.now() + 15 * 60_000;
        if (isLocalStorageQuotaError(error)) setOfferBackup(true);
        setDetail(syncErrorDetail(error));
        retryTimer = window.setTimeout(() => { void run(); }, Math.max(retryDelay, restrictedUntil - Date.now()));
        retryDelay = Math.min(retryDelay * 2, 30_000);
      } finally {
        if (active && currentGeneration === generation) {
          inFlight = false;
          if (before !== changed && !retryTimer) timer = window.setTimeout(() => { void run(); }, 500);
        }
      }
    };
    const sessionChanged = (session: { user: { id: string; email?: string } } | null) => {
      if (!active) return;
      setEmail(session?.user.email ?? "");
      if (session && synchronizer?.userId === session.user.id) return;
      generation += 1;
      setOfferBackup(false);
      restrictedUntil = 0;
      synchronizer?.dispose();
      clearRetry();
      window.clearTimeout(timer);
      ready = false;
      inFlight = false;
      synchronizer = session ? new RecordSynchronizer(supabase, session.user.id) : null;
      // Supabase holds its auth lock while notifying session listeners.
      if (session) timer = window.setTimeout(() => { void run(); }, 0);
      else {
        deactivateAccountStorage(browserRecords);
        dispatchStorageChanges(window);
      }
    };
    const schedule = () => {
      if (!synchronizer) return;
      try {
        if (!synchronizer.captureLocalChanges()) return;
        changed += 1;
        if (Date.now() < restrictedUntil) {
          setStatus("error");
          return;
        }
        setStatus(navigator.onLine ? "pending" : "offline");
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void run(); }, 2_000);
      } catch (error) {
        setStatus("error");
        setDetail(syncErrorDetail(error));
        if (isLocalStorageQuotaError(error)) setOfferBackup(true);
      }
    };
    const refreshRemote = () => {
      if (document.visibilityState !== "hidden") void run();
    };
    const offline = () => setStatus("offline");
    const visibilityChanged = () => {
      // A background transition is best effort; pending data is retried on return.
      if (document.visibilityState === "hidden" && !timer) {
        try { if (!synchronizer?.captureLocalChanges()) return; }
        catch { /* Let run report a storage error without losing pending data. */ }
      }
      void run();
    };
    const restoreSession = async () => {
      const started = generation;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active || generation !== started) return;
        if (error) throw error;
        if (!session) throw Object.assign(new Error("Missing session"), { code: "PGRST301" });
        sessionChanged(session);
      } catch (error) {
        if (!active || generation !== started) return;
        setStatus("error");
        setDetail(syncErrorDetail(error));
      }
    };
    retry.current = () => {
      restrictedUntil = 0;
      if (synchronizer) void run();
      else void restoreSession();
    };
    void restoreSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session || event === "SIGNED_OUT") sessionChanged(session);
    });
    const unsubscribeChanges = subscribeToStorageChanges(schedule, window);
    const remoteRefresh = window.setInterval(refreshRemote, 60_000);
    window.addEventListener("focus", refreshRemote);
    window.addEventListener("online", refreshRemote);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", visibilityChanged);
    return () => {
      active = false;
      generation += 1;
      clearRetry();
      synchronizer?.dispose();
      subscription.unsubscribe();
      unsubscribeChanges();
      window.clearInterval(remoteRefresh);
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshRemote);
      window.removeEventListener("online", refreshRemote);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pagehide", visibilityChanged);
      retry.current = () => {};
    };
  }, []);
  const failed = status === "error" || status === "offline";
  const Icon = failed ? CloudOff : status === "synced" ? CloudCheck : RefreshCw;
  const label = { pending: "等待云端同步", syncing: "正在同步", synced: "已同步到云端", error: "云端未同步 · 点击重试", offline: "离线 · 等待联网同步" }[status];
  return <div className="border-t border-border/40 bg-card/70 px-4 py-1.5 text-[11px] md:px-8">
    <div className="mx-auto flex max-w-[1436px] flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <span className="max-w-[55vw] truncate text-muted-foreground" title="两端登录同一账号即可同步">{email}</span>
      <button type="button" onClick={() => retry.current()} disabled={status === "syncing"} title={detail || "立即同步手机与电脑的记录"} className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-secondary ${failed ? "text-[#a45f45]" : "text-primary"}`} aria-label="立即同步记录">
        <Icon size={13} className={status === "syncing" ? "animate-spin" : ""} /><span role="status">{label}</span>
      </button>
      {failed && detail ? <span className="w-full text-right text-muted-foreground">{detail}</span> : null}
      {offerBackup && <button type="button" className="text-primary underline" onClick={() => downloadDataBackup(createDataBackup())}>导出本机备份</button>}
    </div>
  </div>;
}
