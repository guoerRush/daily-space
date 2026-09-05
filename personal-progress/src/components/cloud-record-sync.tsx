"use client";

import { useEffect } from "react";
import { deactivateAccountStorage } from "@/lib/account-storage";
import { RecordSynchronizer } from "@/lib/record-sync";
import {
  dispatchStorageChanges,
  subscribeToStorageChanges,
} from "@/lib/storage-contract";
import { getSupabaseClient } from "@/lib/supabase";

export function CloudRecordSync() {
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let synchronizer: RecordSynchronizer | null = null;
    let timer: number | undefined;
    let retryTimer: number | undefined;
    let retryDelay = 2_000;
    let active = true;
    let generation = 0;

    const clearRetry = (resetDelay = false) => {
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = undefined;
      if (resetDelay) retryDelay = 2_000;
    };

    const start = async (userId: string) => {
      const currentGeneration = ++generation;
      clearRetry();
      synchronizer?.dispose();
      const next = new RecordSynchronizer(supabase, userId);
      synchronizer = next;
      try {
        await next.start();
        retryDelay = 2_000;
      } catch (error) {
        console.error("Daily Space record sync failed to start.", error);
        if (active && currentGeneration === generation) {
          retryTimer = window.setTimeout(() => {
            retryTimer = undefined;
            void start(userId);
          }, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30_000);
        }
      }
      if (!active || currentGeneration !== generation) next.dispose();
    };

    const schedule = () => {
      if (!synchronizer?.captureLocalChanges()) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void synchronizer?.sync().catch((error) => {
          console.error("Daily Space record sync failed.", error);
        });
      }, 500);
    };

    const refreshRemote = () => {
      if (document.visibilityState === "hidden") return;
      void synchronizer?.sync().catch((error) => {
        console.error("Daily Space record refresh failed.", error);
      });
    };

    const flushBeforeBackground = () => {
      synchronizer?.captureLocalChanges();
      void synchronizer?.sync().catch((error) => {
        console.error("Daily Space record flush failed.", error);
      });
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session) void start(session.user.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (synchronizer?.userId !== session.user.id) {
          void start(session.user.id);
        }
        return;
      }
      generation += 1;
      synchronizer?.dispose();
      synchronizer = null;
      deactivateAccountStorage(window.localStorage);
      dispatchStorageChanges(window);
    });
    const unsubscribeChanges = subscribeToStorageChanges(schedule, window);
    const remoteRefresh = window.setInterval(refreshRemote, 15_000);
    window.addEventListener("focus", refreshRemote);
    window.addEventListener("online", refreshRemote);
    window.addEventListener("visibilitychange", refreshRemote);
    window.addEventListener("pagehide", flushBeforeBackground);

    return () => {
      active = false;
      generation += 1;
      clearRetry(true);
      synchronizer?.dispose();
      subscription.unsubscribe();
      unsubscribeChanges();
      window.clearInterval(remoteRefresh);
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", refreshRemote);
      window.removeEventListener("online", refreshRemote);
      window.removeEventListener("visibilitychange", refreshRemote);
      window.removeEventListener("pagehide", flushBeforeBackground);
    };
  }, []);
  return null;
}
