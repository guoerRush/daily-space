export type CognitiveSettings = {
  nightlyNoteCleanup: boolean;
  weeklyGrowthSummary: boolean;
};

const defaults: CognitiveSettings = {
  nightlyNoteCleanup: true,
  weeklyGrowthSummary: true,
};

export function getCognitiveSettings(): CognitiveSettings {
  if (typeof window === "undefined") return defaults;
  try {
    return {
      ...defaults,
      ...(JSON.parse(
        window.localStorage.getItem(STORAGE_KEYS.cognitiveSettings) ?? "{}",
      ) as Partial<CognitiveSettings>),
    };
  } catch {
    return defaults;
  }
}

export function saveCognitiveSettings(settings: CognitiveSettings) {
  window.localStorage.setItem(
    STORAGE_KEYS.cognitiveSettings,
    JSON.stringify(settings),
  );
  window.dispatchEvent(new Event(STORAGE_EVENTS.cognitiveSettingsChanged));
}
import { STORAGE_EVENTS, STORAGE_KEYS } from "@/lib/storage-contract";
