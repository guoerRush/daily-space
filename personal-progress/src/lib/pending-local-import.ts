import {
  markPendingLocalImportCompleted,
  readPendingLocalImport,
} from "@/lib/local-backup";
import { mergeSuccessJournalLines } from "@/lib/success-journals";

/** Applies the connected folder's one-time import and keeps it idempotent. */
export async function applyPendingLocalImport() {
  const pending = await readPendingLocalImport();
  if (!pending.found) return pending;
  if (pending.pendingImport.importedAt) {
    return {
      found: true as const,
      applied: false as const,
      reason: "already-imported" as const,
      importedLines: 0,
    };
  }

  const result = mergeSuccessJournalLines(
    pending.pendingImport.successJournals,
  );
  await markPendingLocalImportCompleted(new Date().toISOString());
  return {
    found: true as const,
    applied: true as const,
    importedLines: result.importedLines,
  };
}
