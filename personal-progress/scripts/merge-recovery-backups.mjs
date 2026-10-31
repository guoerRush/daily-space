import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [primaryPath, secondaryPath, outputPath] = process.argv.slice(2);
if (!primaryPath || !secondaryPath || !outputPath) {
  throw new Error("Usage: node scripts/merge-recovery-backups.mjs <primary> <secondary> <output>");
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function identity(value) {
  if (!plainObject(value)) return `value:${JSON.stringify(value)}`;
  for (const key of ["id", "date", "key", "name", "title"]) {
    if (typeof value[key] === "string" || typeof value[key] === "number") {
      return `${key}:${String(value[key])}`;
    }
  }
  return `object:${JSON.stringify(value)}`;
}

function mergeRecoveredValue(recovered, current) {
  if (Array.isArray(recovered) && Array.isArray(current)) {
    const recoveredById = new Map(recovered.map((item) => [identity(item), item]));
    const merged = current.map((item) => {
      const key = identity(item);
      const older = recoveredById.get(key);
      recoveredById.delete(key);
      return older === undefined ? item : mergeRecoveredValue(older, item);
    });
    return [...merged, ...recoveredById.values()];
  }
  if (plainObject(recovered) && plainObject(current)) {
    const result = { ...recovered };
    for (const [key, value] of Object.entries(current)) {
      result[key] = key in recovered ? mergeRecoveredValue(recovered[key], value) : value;
    }
    return result;
  }
  if (typeof current === "string" && current.trim() === "" && typeof recovered === "string" && recovered.trim() !== "") {
    return recovered;
  }
  return current ?? recovered;
}

function mergeRecordText(recovered, current) {
  try {
    return JSON.stringify(mergeRecoveredValue(JSON.parse(recovered), JSON.parse(current)));
  } catch {
    return current || recovered;
  }
}

function validateBackup(value, label) {
  if (!plainObject(value) || !plainObject(value.records)) throw new Error(`${label} is not a Daily Space backup.`);
  if (value.format !== "daily-space-backup" || value.version !== 1) throw new Error(`${label} has an unsupported format.`);
  for (const [key, record] of Object.entries(value.records)) {
    if (typeof record !== "string") throw new Error(`${label} contains a non-string record: ${key}`);
  }
}

const primary = JSON.parse(await readFile(primaryPath, "utf8"));
const secondary = JSON.parse(await readFile(secondaryPath, "utf8"));
validateBackup(primary, "Primary backup");
validateBackup(secondary, "Secondary backup");

const records = { ...secondary.records };
for (const [key, value] of Object.entries(primary.records)) {
  records[key] = key in secondary.records ? mergeRecordText(secondary.records[key], value) : value;
}

const output = JSON.stringify({
  format: "daily-space-backup",
  version: 1,
  exportedAt: new Date().toISOString(),
  records,
}, null, 2);
await writeFile(outputPath, output, "utf8");

process.stdout.write(JSON.stringify({
  recordKeys: Object.keys(records).length,
  bytes: Buffer.byteLength(output),
  sha256: createHash("sha256").update(output).digest("hex").toUpperCase(),
}, null, 2));
