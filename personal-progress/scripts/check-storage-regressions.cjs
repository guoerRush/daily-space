/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Load the actual TypeScript modules with isolated browser and network adapters.
function loader(mocks = {}, globals = {}) {
  const cache = new Map();
  return function load(name) {
    if (name in mocks) return mocks[name];
    if (!name.startsWith("@/")) return require(name);
    const file = path.join(__dirname, "../src", name.slice(2) + ".ts");
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("require", "module", "exports", ...Object.keys(globals), code)(
      load, loadedModule, loadedModule.exports, ...Object.values(globals),
    );
    return loadedModule.exports;
  };
}

class MemoryStorage {
  data = new Map();
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

async function fitness() {
  const storage = new MemoryStorage();
  const window = new EventTarget();
  const load = loader({}, { localStorage: storage, window });
  const { readFitnessHistory, saveFitnessHistory } = load("@/lib/fitness-history");
  const { RecordSynchronizer } = load("@/lib/record-sync");
  const { deactivateAccountStorage } = load("@/lib/account-storage");
  const rows = new Map();
  const client = { from: () => ({
    select: () => ({ eq: (_, id) => ({ maybeSingle: async () => ({ data: rows.get(id) ?? null }) }) }),
    upsert: async (row) => { rows.set(row.user_id, structuredClone(row)); return {}; },
  }) };
  const legacy = Array.from({ length: 120 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), values: { bench: `${i} kg` },
  }));
  storage.setItem("fitness-weight-history", JSON.stringify(legacy));
  storage.setItem("fitness-weight-records", JSON.stringify({ bench: "40 kg" }));
  const first = new RecordSynchronizer(client, "owner", storage, () => {});
  await first.start();
  assert.equal(readFitnessHistory().length, 120);
  assert.equal(storage.getItem("fitness-weight-history"), null);
  saveFitnessHistory({ date: "2026-11-13", values: { bench: "45 kg" } });
  await first.sync();
  saveFitnessHistory({ date: "2026-11-14", values: { bench: "50 kg" } });
  await first.sync();
  first.dispose();
  const secondDevice = new MemoryStorage();
  const second = new RecordSynchronizer(client, "owner", secondDevice, () => {});
  await second.start();
  assert.equal(readFitnessHistory(secondDevice).length, 122);
  assert.equal(readFitnessHistory(secondDevice)[1].values.bench, "45 kg");
  deactivateAccountStorage(storage);
  const other = new RecordSynchronizer(client, "another-user", storage, () => {});
  await other.start();
  assert.equal(readFitnessHistory().length, 0);
  assert.equal(storage.getItem("fitness-weight-records"), null);
  other.dispose();
  deactivateAccountStorage(storage);
  const reopened = new RecordSynchronizer(client, "owner", storage, () => {});
  await reopened.start();
  assert.equal(readFitnessHistory().length, 122);
  storage.setItem("daily-space:fitness:damaged", "invalid JSON");
  assert.equal(readFitnessHistory().length, 122);
  second.dispose(); reopened.dispose();
  console.log("PASS fitness: 120-day migration, next-day retention, second-device sync, account isolation, reload");
}

async function photos() {
  let uploads = 0, created = 0, removed = 0, linkFails = false;
  const bucket = {
    upload: async (key, bytes, options) => {
      uploads++;
      assert.ok(key.startsWith("owner/photos/"));
      assert.equal(options.contentType, "image/jpeg");
      assert.ok(bytes.byteLength > 0);
      return { error: uploads === 1 ? { message: "Bucket not found" } : null };
    },
    createSignedUrl: async () => linkFails ? { error: new Error("network") } : { data: { signedUrl: "https://example.test/private-photo" } },
    remove: async () => { removed++; return {}; },
  };
  const client = {
    auth: { getUser: async (token) => ({ data: { user: token === "valid" ? { id: "owner" } : null } }) },
    storage: {
      from: () => bucket,
      createBucket: async (_, options) => { assert.equal(options.public, false); created++; return {}; },
    },
  };
  const { POST } = loader({ "@/lib/supabase-server": { getServiceSupabaseClient: () => client } })("@/app/api/photos/route");
  const request = (token, type = "image/jpeg", size = 50) => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(size)], "photo.jpg", { type }));
    return new Request("https://example.test/api/photos", {
      method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form,
    });
  };
  assert.equal((await POST(request())).status, 401);
  assert.equal((await POST(request("invalid"))).status, 401);
  assert.equal((await POST(request("valid", "text/html"))).status, 400);
  assert.equal((await POST(request("valid", "image/jpeg", 4 * 1024 * 1024))).status, 400);
  assert.equal(uploads, 0);
  const response = await POST(request("valid"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).url, "https://example.test/private-photo");
  assert.equal(created, 1);
  linkFails = true;
  assert.equal((await POST(request("valid"))).status, 500);
  assert.equal(removed, 1);
  console.log("PASS photo API: authentication, size/type validation, private bucket creation, upload, cleanup");

  let dimensions, revoked = false, encoded = 0;
  const canvas = {
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (callback) => {
      dimensions = [canvas.width, canvas.height]; encoded++;
      callback(new Blob([new Uint8Array(encoded === 1 ? 4 * 1024 * 1024 : 500_000)], { type: "image/jpeg" }));
    },
  };
  const { uploadPhoto } = loader({ "@/lib/supabase": {
    getSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "valid" } } }) } }),
  } }, {
    Image: class { naturalWidth = 8064; naturalHeight = 6048; async decode() {} },
    document: { createElement: () => canvas },
    URL: { createObjectURL: () => "blob:photo", revokeObjectURL: () => { revoked = true; } },
    fetch: async (_, options) => {
      assert.equal(options.headers.Authorization, "Bearer valid");
      assert.equal(options.body.get("file").size, 500_000);
      return Response.json({ url: "https://example.test/private-photo" });
    },
  })("@/lib/photo-upload");
  assert.equal(await uploadPhoto(new File(["original"], "iphone.jpg")), "https://example.test/private-photo");
  assert.deepEqual(dimensions, [2048, 1536]);
  assert.equal(encoded, 2);
  assert.equal(revoked, true);
  console.log("PASS photo client: 48-megapixel dimensions, adaptive compression, URL-only result, memory cleanup");
}

(async () => { await fitness(); await photos(); })().catch((error) => { console.error(error); process.exitCode = 1; });
