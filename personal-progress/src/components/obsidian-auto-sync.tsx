"use client";

import { useEffect, useRef } from "react";
import { listJournals } from "@/lib/journals";
import { syncReflectionsToConnectedObsidian } from "@/lib/obsidian-export";
import { listSuccessJournals } from "@/lib/success-journals";
import { STORAGE_EVENTS } from "@/lib/storage-contract";

const AUTO_SYNC_DELAY_MS = 3_000;

export function ObsidianAutoSync() {
  const running = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    let timer: number | undefined;
    const synchronize = async () => {
      if (running.current) {
        pending.current = true;
        return;
      }
      running.current = true;
      try {
        await syncReflectionsToConnectedObsidian(
          listJournals(),
          listSuccessJournals(),
        );
      } catch (error) {
        console.warn("Daily Space Obsidian auto-sync failed.", error);
      } finally {
        running.current = false;
        if (pending.current) {
          pending.current = false;
          void synchronize();
        }
      }
    };
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void synchronize(), AUTO_SYNC_DELAY_MS);
    };
    window.addEventListener(STORAGE_EVENTS.journalsChanged, schedule);
    window.addEventListener(STORAGE_EVENTS.successJournalsChanged, schedule);
    schedule();
    return () => {
      window.removeEventListener(STORAGE_EVENTS.journalsChanged, schedule);
      window.removeEventListener(STORAGE_EVENTS.successJournalsChanged, schedule);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
