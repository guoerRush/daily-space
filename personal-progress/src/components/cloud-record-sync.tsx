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
    let active = true;
    let generation = 0;

    const start = async (userId: string) => {
      const currentGeneration = ++generation;
      synchronizer?.dispose();
      const next = new RecordSynchronizer(supabase, userId);
      synchronizer = next;
      try {
        await next.start();
      } catch (error) {
        console.error("Daily Space record sync failed to start.", error);
      }
      if (!active || currentGeneration !== generation) next.dispose();
    };

    const schedule = () => {
      synchronizer?.captureLocalChanges();
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void synchronizer?.sync().catch((error) => {
          console.error("Daily Space record sync failed.", error);
        });
      }, 500);
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
    const remoteRefresh = window.setInterval(() => {
      void synchronizer?.sync().catch((error) => {
        console.error("Daily Space record refresh failed.", error);
      });
    }, 15_000);

    return () => {
      active = false;
      generation += 1;
      synchronizer?.dispose();
      subscription.unsubscribe();
      unsubscribeChanges();
      window.clearInterval(remoteRefresh);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
  return null;
}
