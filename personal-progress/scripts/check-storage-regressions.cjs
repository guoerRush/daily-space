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

// PostgREST compare-and-swap simulator, shared by isolated device stores.
function cloudClient(rows = new Map()) {
  let revision = 0;
  const client = { fail: false, reads: [], beforeWrite: null, from: () => {
    let mode = "read", row, id, expected, selection;
    const query = {
      select: value => { selection = value; return query; },
      eq: (key, value) => { if (key === "user_id") id = value; else expected = value; return query; },
      is: (key, value) => query.eq(key, value),
      insert: value => { mode = "insert"; row = value; id = value.user_id; return query; },
      update: value => { mode = "update"; row = value; return query; },
      maybeSingle: async () => {
        if (client.fail) return { error: { message: "Offline" } };
        if (mode === "read") {
          client.reads.push(selection);
          const saved = rows.get(id);
          return { data: saved ? structuredClone(selection === "updated_at" ? { updated_at: saved.updated_at } : saved) : null };
        }
        if (client.beforeWrite) { const hook = client.beforeWrite; client.beforeWrite = null; await hook(); }
        if (mode === "insert" && rows.has(id)) return { error: { code: "23505" } };
        if (mode === "update" && rows.get(id)?.updated_at !== expected) return { data: null };
        const updated_at = new Date(Date.UTC(2026, 10, 15) + ++revision).toISOString();
        rows.set(id, structuredClone({ ...row, updated_at }));
        return { data: { updated_at } };
      },
    };
    return query;
  }};
  return client;
}

function quotaLimitedStorage() {
  const storage = new MemoryStorage();
  const setItem = storage.setItem.bind(storage);
  storage.quota = Infinity;
  storage.setItem = (key, value) => {
    const next = new Map(storage.data);
    next.set(key, String(value));
    const size = [...next].reduce((total, [name, text]) => total + name.length + text.length, 0);
    if (size > storage.quota) throw new DOMException("Storage is full", "QuotaExceededError");
    setItem(key, value);
  };
  return storage;
}

function planStorageQuota() {
  const storage = quotaLimitedStorage();
  const window = Object.assign(new EventTarget(), { localStorage: storage });
  const load = loader({}, { window });
  const { saveDailyPlan } = load("@/lib/plans");
  const { browserRecords } = load("@/lib/browser-records");
  const { activateAccountStorage, readAccountRecords, writeAccountRecords } = load("@/lib/account-storage");
  const { collectStoredRecords, replaceStoredRecords, STORAGE_EVENTS, STORAGE_KEYS } = load("@/lib/storage-contract");
  const date = "2026-11-14";
  const planKey = STORAGE_KEYS.planPrefix + date;
  const notesKey = STORAGE_KEYS.notes;
  const journalKey = STORAGE_KEYS.journals;
  const originalPlan = JSON.stringify({ remarks: "原计划" });
  const original = { [planKey]: originalPlan, [notesKey]: "[]", [journalKey]: "[]" };
  replaceStoredRecords(storage, original);
  activateAccountStorage(browserRecords, "owner");
  // Use a large duplicate of managed, visible data to put the origin over quota.
  writeAccountRecords(browserRecords, "owner", { ...original, [notesKey]: "a".repeat(2048) });
  storage.quota = 1200;
  let changes = 0;
  window.addEventListener(STORAGE_EVENTS.plansChanged, () => { changes++; });

  const nextPlan = saveDailyPlan(date, { remarks: "新增内容" });
  assert.equal(JSON.parse(storage.getItem(planKey)).remarks, "新增内容");
  assert.equal(storage.getItem(notesKey), "[]");
  assert.equal(readAccountRecords(browserRecords, "owner")[planKey], originalPlan);
  assert.equal(changes, 1);
  assert.throws(() => saveDailyPlan(date, { remarks: "x".repeat(1300) }), { name: "QuotaExceededError" });
  assert.equal(storage.getItem(planKey), JSON.stringify(nextPlan));
  assert.equal(changes, 1);

  const beforeSync = collectStoredRecords(storage);
  assert.throws(() => replaceStoredRecords(storage, {
    [planKey]: "{}",
    [journalKey]: "x".repeat(1300),
  }), { name: "QuotaExceededError" });
  assert.deepEqual(collectStoredRecords(storage), beforeSync);
  console.log("PASS plan storage: recover from duplicate cache, keep failed draft's previous save, roll back an incomplete sync");
}

async function fitness() {
  const storage = new MemoryStorage();
  const window = new EventTarget();
  const load = loader({}, { localStorage: storage, window });
  const { readFitnessHistory, saveFitnessHistory } = load("@/lib/fitness-history");
  const { RecordSynchronizer } = load("@/lib/record-sync");
  const { deactivateAccountStorage } = load("@/lib/account-storage");
  const rows = new Map();
  const client = cloudClient(rows);
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

async function deviceSync() {
  const load = loader();
  const { RecordSynchronizer } = load("@/lib/record-sync");
  const { STORAGE_KEYS } = load("@/lib/storage-contract");
  const rows = new Map(), client = cloudClient(rows);
  const phone = new MemoryStorage(), desktop = new MemoryStorage();
  let time = Date.UTC(2026, 10, 14), notices = 0;
  const now = () => new Date(++time);
  const a = new RecordSynchronizer(client, "owner", phone, () => notices++, now);
  const b = new RecordSynchronizer(client, "owner", desktop, () => notices++, now);
  await a.start(); await b.start();
  const p1 = STORAGE_KEYS.planPrefix + "2026-11-15", p2 = STORAGE_KEYS.planPrefix + "2026-11-16";
  phone.setItem(p1, "phone plan"); desktop.setItem(p2, "desktop plan");
  await Promise.all([a.sync(), b.sync()]);
  await Promise.all([a.sync(), b.sync()]);
  assert.equal(phone.getItem(p2), "desktop plan");
  assert.equal(desktop.getItem(p1), "phone plan");
  assert.equal(rows.get("owner").records[p1], "phone plan");
  // Phone clock is behind the server; a genuine local edit still uploads.
  phone.setItem(p1, "phone edited offline");
  await a.sync(); await b.sync();
  assert.equal(desktop.getItem(p1), "phone edited offline");
  const key = STORAGE_KEYS.journals;
  const old = {date: "2026-11-01", content: "old", updatedAt: "2026-11-01"};
  phone.setItem(key, JSON.stringify([old]));
  await a.sync(); await b.sync();
  const left = {date: "2026-11-14", content: "phone journal", images: ["https://example.test/photo"], updatedAt: "2026-11-14"};
  const right = {date: "2026-11-15", content: "desktop journal", updatedAt: "2026-11-15"};
  phone.setItem(key, JSON.stringify([left, old]));
  desktop.setItem(key, JSON.stringify([right, old]));
  await Promise.all([a.sync(), b.sync()]); await a.sync(); await b.sync();
  assert.equal(JSON.parse(phone.getItem(key)).length, 3);
  assert.equal(phone.getItem(key), desktop.getItem(key));
  // Deleting one journal while the other device edits a different date keeps both intentions.
  phone.setItem(key, JSON.stringify([left, right]));
  desktop.setItem(key, JSON.stringify([{...right, content: "edited"}, left, old]));
  await Promise.all([a.sync(), b.sync()]); await a.sync(); await b.sync();
  assert.deepEqual(JSON.parse(phone.getItem(key)).map(x => x.date), [right.date, left.date]);
  assert.equal(JSON.parse(phone.getItem(key))[0].content, "edited");
  assert.deepEqual(JSON.parse(phone.getItem(key))[1].images, left.images);
  const { readFitnessReflections, saveFitnessReflection } = load("@/lib/fitness-reflections");
  saveFitnessReflection("2026-11-14", "手机训练后反思", phone);
  saveFitnessReflection("2026-11-15", "电脑休息日反思", desktop);
  await Promise.all([a.sync(), b.sync()]); await a.sync(); await b.sync();
  assert.deepEqual(readFitnessReflections(phone).map(item => item.text), ["电脑休息日反思", "手机训练后反思"]);
  assert.deepEqual(readFitnessReflections(desktop), readFitnessReflections(phone));
  desktop.setItem("daily-space:fitness-reflection:damaged", "invalid JSON");
  assert.equal(readFitnessReflections(desktop).length, 2);
  // No visible incoming writes are applied on a failed upload; local drafts survive.
  phone.setItem(p1, "offline pending"); client.fail = true;
  await assert.rejects(a.sync());
  assert.equal(phone.getItem(p1), "offline pending");
  client.fail = false; await a.sync(); await b.sync();
  assert.equal(desktop.getItem(p1), "offline pending");
  phone.setItem(p1, "first edit");
  client.beforeWrite = () => { phone.setItem(p1, "typed during upload"); a.captureLocalChanges(); };
  await a.sync(); await b.sync();
  assert.equal(desktop.getItem(p1), "typed during upload");
  assert.ok(notices > 0);
  phone.removeItem(p1); await a.sync(); await b.sync();
  assert.equal(desktop.getItem(p1), null);
  client.reads.length = 0;
  await a.sync(); await a.sync(); await a.sync();
  assert.deepEqual(client.reads, ["updated_at", "updated_at", "updated_at"], "Unchanged history must not be downloaded again");
  rows.delete("owner");
  await a.sync();
  assert.ok(rows.get("owner"), "Deleted remote row can be restored from retained local records");
  a.dispose(); b.dispose();
  console.log("PASS two devices: concurrent writes, clock skew, offline retry, in-flight edits, per-date journal and fitness reflection merging, deletion and photo preservation");
}

async function syncTransport() {
  const url = "https://sync-test.supabase.co";
  let directFails = true, status = 200;
  const calls = [];
  const fetch = async (input, init) => {
    const req = new Request(new URL(typeof input === "string" ? input : input.url, "https://site.test"), input instanceof Request ? input : init);
    calls.push({ url: req.url, method: req.method, body: await req.text(), auth: req.headers.get("authorization"), key: req.headers.get("apikey") });
    if (req.url.startsWith(url) && directFails) throw new TypeError("Failed to fetch");
    return Response.json({ message: status === 402 ? "exceed_egress_quota" : "ok" }, { status });
  };
  const { createRecordSyncFetch } = loader({}, { fetch, window: { setTimeout, clearTimeout } })("@/lib/record-sync-fetch");
  const send = createRecordSyncFetch(url);
  await send(url + "/rest/v1/user_records?user_id=eq.owner&updated_at=eq.version", {
    method: "PATCH", headers: { authorization: "Bearer user-token", apikey: "public-key" }, body: JSON.stringify({ records: { draft: "keep" } }),
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].body, calls[0].body);
  assert.equal(calls[1].auth, "Bearer user-token");
  assert.equal(calls[1].key, null);
  assert.ok(calls[1].url.includes("/api/record-sync?user_id=eq.owner&updated_at=eq.version"));
  calls.length = 0;
  await send(url + "/rest/v1/rpc/daily_space_write_changes", {method:"POST", headers:{authorization:"Bearer user-token"}, body:JSON.stringify({p_expected:null,p_changes:{"__journal_date__:2026-11-19":"one date"}})});
  assert.ok(calls[1].url.endsWith("/api/record-sync?rpc=daily_space_write_changes"));
  assert.equal(calls[1].body, calls[0].body);
  calls.length = 0; directFails = false; status = 402;
  assert.equal((await send(url + "/rest/v1/user_records")).status, 402);
  assert.equal(calls.length, 1, "Quota restrictions must not be retried through the proxy");
  const errors = loader()("@/lib/cloud-errors");
  assert.equal(errors.isCloudQuotaError({ message: "Service for this project is restricted due to exceed_egress_quota" }), true);
  assert.ok(errors.authErrorMessage({message: "exceed_egress_quota"}).includes("不是邮箱或密码错误"));
  console.log("PASS mobile transport: network fallback preserves body, account and CAS filters; quota errors stay explicit");

  const upstream = [];
  const routes = loader({}, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" } }, fetch: async (input, init) => {
    upstream.push({ url: String(input), init });
    return Response.json([{updated_at: "2026-11-18T00:00:00Z"}]);
  } })("@/app/api/record-sync/route");
  const owner = "eq.00000000-0000-4000-8000-000000000001";
  const req = (path, method = "GET", auth = "Bearer owner-token") => new Request("https://site.test/api/record-sync" + path, {method, headers: auth ? {authorization:auth} : {}, ...(method === "PATCH" ? {body:"{}"} : {})});
  assert.equal((await routes.GET(req("", "GET", ""))).status, 401);
  assert.equal((await routes.GET(req("?user_id=" + owner, "GET", "Bearer anon"))).status, 401);
  assert.equal((await routes.GET(req("?user_id=not.eq.owner"))).status, 400);
  assert.equal((await routes.PATCH(req("?user_id=" + owner, "PATCH"))).status, 400);
  assert.equal(upstream.length, 0);
  assert.equal((await routes.POST(req("?rpc=arbitrary_admin_function", "POST"))).status, 400);
  const res = await routes.GET(req("?user_id=" + owner + "&select=updated_at"));
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(new URL(upstream[0].url).searchParams.get("select"), "updated_at");
  assert.equal(upstream[0].init.headers.get("authorization"), "Bearer owner-token");
  assert.equal(upstream[0].init.headers.get("apikey"), "anon");
  assert.equal((await routes.PATCH(req("?user_id=" + owner + "&updated_at=eq.2026-11-18T00%3A00%3A00%2B00%3A00", "PATCH"))).status, 200);
  assert.equal((await routes.POST(req("?rpc=daily_space_read_changes", "POST"))).status, 200);
  assert.equal(new URL(upstream[2].url).pathname, "/rest/v1/rpc/daily_space_read_changes");
  console.log("PASS sync proxy: authentication, owner and version filters, minimal version responses, no shared cache");
}

module.exports = { loader, MemoryStorage, cloudClient };
if (require.main === module) (async () => { planStorageQuota(); await fitness(); await photos(); await deviceSync(); await syncTransport(); })().catch((error) => { console.error(error); process.exitCode = 1; });
