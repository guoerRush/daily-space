"use client";

import { useCallback, useEffect, useRef } from "react";
import { createDataBackup } from "@/lib/record-backup";
import {
  saveBackupToLocalFolder,
  saveEmergencyBackup,
} from "@/lib/local-backup";
import { applyPendingLocalImport } from "@/lib/pending-local-import";
import { subscribeToStorageChanges } from "@/lib/storage-contract";

const AUTOSAVE_DELAY_MS = 3_000;

/** Keeps an IndexedDB mirror and an opt-in local file synchronized with edits. */
export function LocalBackupSync() {
  const lastContent = useRef("");
  const running = useRef(false);

  const saveSnapshot = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      await applyPendingLocalImport();

      const backup = createDataBackup();
      const contentSignature = JSON.stringify(backup.records);
      if (contentSignature === lastContent.current) return;
      await saveEmergencyBackup(backup);
      await saveBackupToLocalFolder(backup);
      lastContent.current = contentSignature;
    } catch (error) {
      // The original localStorage write remains the source of truth; retry after the next change.
      console.warn("Daily Space local backup failed.", error);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void saveSnapshot(), AUTOSAVE_DELAY_MS);
    };
    const unsubscribe = subscribeToStorageChanges(schedule, window);
    const interval = window.setInterval(() => void saveSnapshot(), AUTOSAVE_DELAY_MS);
    const onPageHide = () => void saveSnapshot();
    window.addEventListener("pagehide", onPageHide);
    schedule();
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onPageHide);
      if (timer) window.clearTimeout(timer);
    };
  }, [saveSnapshot]);

  return null;
}
