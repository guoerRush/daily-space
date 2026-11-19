/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loader, MemoryStorage, cloudClient } = require("./check-storage-regressions.cjs");
// Install @electric-sql/pglite in a temporary QA directory, then set this path.
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const user = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      create table public.user_records(user_id uuid primary key, records jsonb not null default '{}', updated_at timestamptz default clock_timestamp());
      alter table public.user_records enable row level security;
      create policy own on public.user_records to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
      grant select, insert, update on public.user_records to authenticated;
    `);
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261119_incremental_record_sync.sql"), "utf8"));
    const traffic = [];
    function client(id = user) {
      return { rpc: async (name, params) => {
        try {
          const result = await db.transaction(async tx => {
            await tx.exec("set local role authenticated");
            await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
            const args = name === "daily_space_read_changes" ? [params.p_version, params.p_known] : [params.p_expected, params.p_changes];
            return (await tx.query(`select public.${name}($1::timestamptz,$2::jsonb) as data`, args)).rows[0].data;
          });
          traffic.push({ name, params, response: result, bytes: JSON.stringify(result).length });
          return { data: result, error: null };
        } catch (error) { return { error }; }
      }, from: () => { throw new Error("Installed RPC must not download legacy snapshots"); } };
    }
    const load = loader();
    const { RecordSynchronizer } = load("@/lib/record-sync");
    const { RecordSyncTransport } = load("@/lib/record-sync-transport");
    const { readAccountSyncState } = load("@/lib/account-storage");
    const { splitSyncRecords, joinSyncRecords } = load("@/lib/record-sync-parts");
    const history = Array.from({length: 100}, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), content: "历史日记".repeat(1200), updatedAt: "2026-01-01" }));
    const initial = { "daily-space:journals": JSON.stringify(history), "daily-space:plan:2026-11-19": "old plan", "daily-space:habits": "[]" };
    const journalWithImage = { date: "2026-11-19", content: "with photo", images: ["https://example.test/photo.jpg"] };
    assert.deepEqual(joinSyncRecords(splitSyncRecords({"daily-space:journals": JSON.stringify([journalWithImage])})), {"daily-space:journals":JSON.stringify([journalWithImage])});
    await db.query("insert into public.user_records(user_id,records) values($1,$2)", [user, initial]);
    const phone = new MemoryStorage(), desktop = new MemoryStorage();
    let tick = Date.now(); const now = () => new Date(++tick);
    const a = new RecordSynchronizer(client(), user, phone, () => {}, now);
    const b = new RecordSynchronizer(client(), user, desktop, () => {}, now);
    await a.start(); await b.start();
    assert.equal(JSON.parse(phone.getItem("daily-space:journals")).length, 100);
    console.log("PASS SQL migration reads 100 existing journals without changing their original table");

    traffic.length = 0;
    phone.setItem("daily-space:plan:2026-11-19", "phone today's plan");
    await a.sync(); await b.sync();
    assert.equal(desktop.getItem("daily-space:plan:2026-11-19"), "phone today's plan");
    assert.ok(traffic.every(call => !JSON.stringify(call.params).includes("历史日记")));
    assert.ok(traffic.every(call => !JSON.stringify(call.response).includes("历史日记")));
    console.log("PASS plan update transfers no historical journals in either direction");

    traffic.length = 0;
    const journals = JSON.parse(phone.getItem("daily-space:journals"));
    journals.find(item => item.date === history[0].date).content = "only changed date";
    phone.setItem("daily-space:journals", JSON.stringify(journals));
    await a.sync(); await b.sync();
    const journalWrites = traffic.filter(call => call.name === "daily_space_write_changes");
    assert.equal(journalWrites.length, 1);
    assert.deepEqual(Object.keys(journalWrites[0].params.p_changes).filter(key => key.startsWith("__journal_date__:")), ["__journal_date__:" + history[0].date]);
    assert.ok(traffic.every(call => !JSON.stringify(call.params).includes("历史日记")));
    assert.ok(traffic.every(call => !JSON.stringify(call.response).includes("历史日记")));
    assert.ok(traffic.reduce((sum, call) => sum + call.bytes, 0) < 5000);
    console.log("PASS edit one of 100 journals: only that date plus metadata transfers; response under 5 KB");

    traffic.length = 0;
    const reload = new RecordSynchronizer(client(), user, phone, () => {}, now);
    await reload.start();
    assert.ok(traffic.every(call => Object.keys(call.response.changes ?? {}).length === 0));
    assert.ok(traffic.reduce((sum, call) => sum + call.bytes, 0) < 500);
    console.log("PASS page reload reuses account cache: no history download, response under 500 bytes");

    phone.setItem("daily-space:plan:2026-11-19", "concurrent phone");
    desktop.setItem("daily-space:fitness-reflection:2026-11-19", JSON.stringify({date:"2026-11-19",text:"concurrent desktop",savedAt:now().toISOString()}));
    await Promise.all([reload.sync(), b.sync()]); await reload.sync(); await b.sync();
    assert.equal(desktop.getItem("daily-space:plan:2026-11-19"), "concurrent phone");
    assert.ok(phone.getItem("daily-space:fitness-reflection:2026-11-19").includes("concurrent desktop"));
    phone.setItem("daily-space:journals", JSON.stringify(JSON.parse(phone.getItem("daily-space:journals")).filter(item => item.date !== history[0].date)));
    await reload.sync(); await b.sync();
    assert.equal(JSON.parse(desktop.getItem("daily-space:journals")).length, 99);
    console.log("PASS concurrent devices retain both writes; journal deletion persists");

    const left = JSON.parse(phone.getItem("daily-space:journals"));
    const right = JSON.parse(desktop.getItem("daily-space:journals"));
    left.find(item => item.date === history[1].date).content = "phone edits second date";
    right.find(item => item.date === history[2].date).content = "desktop edits third date";
    phone.setItem("daily-space:journals", JSON.stringify(left));
    desktop.setItem("daily-space:journals", JSON.stringify(right));
    await Promise.all([reload.sync(), b.sync()]); await reload.sync(); await b.sync();
    for (const storage of [phone,desktop]) {
      const entries = JSON.parse(storage.getItem("daily-space:journals"));
      assert.equal(entries.find(item => item.date === history[1].date).content, "phone edits second date");
      assert.equal(entries.find(item => item.date === history[2].date).content, "desktop edits third date");
    }
    console.log("PASS simultaneous edits to different journal dates merge after compare-and-swap conflict");

    // The transport's virtual date and metadata keys are not public storage
    // keys. Their hashes must survive a reload to recognize later deletions.
    const reloadedAgain = new RecordSynchronizer(client(), user, phone, () => {}, now);
    await reloadedAgain.start();
    desktop.setItem("daily-space:journals", JSON.stringify(JSON.parse(desktop.getItem("daily-space:journals")).filter(item => item.date !== history[1].date)));
    await b.sync(); await reloadedAgain.sync();
    assert.equal(JSON.parse(phone.getItem("daily-space:journals")).length, 98);
    assert.equal(JSON.parse(phone.getItem("daily-space:journals")).some(item => item.date === history[1].date), false);
    console.log("PASS remote journal deletion after page reload retains virtual-key fingerprints");

    // Older clients and Feishu still write the original table. Fingerprints
    // detect their changes even if they do not update embedded metadata.
    await db.query("update public.user_records set records = records || $1::jsonb, updated_at = clock_timestamp() where user_id=$2", [{"daily-space:notes":"external Feishu note"},user]);
    await reload.sync();
    assert.equal(phone.getItem("daily-space:notes"), "external Feishu note");
    const isolated = await client(other).rpc("daily_space_read_changes", {p_version:null,p_known:{}});
    assert.equal(isolated.data.exists, false);
    assert.deepEqual(isolated.data.changes, {});
    const unauthenticated = await client("").rpc("daily_space_read_changes", {p_version:null,p_known:{}});
    assert.equal(unauthenticated.error.code, "42501");
    console.log("PASS older-client writes, Feishu changes, per-account RLS and unauthenticated rejection");

    // Missing SQL functions fall back without blocking everyday saves.
    const rows = new Map(); const legacy = cloudClient(rows);
    legacy.rpc = async () => ({ error: { code:"PGRST202" } });
    const oldStorage = new MemoryStorage(); oldStorage.setItem("daily-space:notes", "legacy");
    const old = new RecordSynchronizer(legacy, "legacy-user", oldStorage, () => {}, now);
    await old.start();
    legacy.reads.length = 0;
    const oldReload = new RecordSynchronizer(legacy, "legacy-user", oldStorage, () => {}, now);
    await oldReload.start();
    assert.deepEqual(legacy.reads, ["updated_at"]);
    assert.equal(rows.get("legacy-user").records["daily-space:notes"], "legacy");
    console.log("PASS unmigrated database retains compatible saving and skips unchanged history after reload");

    const cached = readAccountSyncState(phone, user);
    assert.ok(cached.deltaCache.hashes);
    assert.equal(cached.deltaCache.parts, undefined, "Do not duplicate history again in cache");
    const transport = new RecordSyncTransport(client(), user);
    const snapshot = await transport.read();
    const conflict = await transport.write({...snapshot,updated_at:"2000-01-01T00:00:00Z"}, {}, now().toISOString());
    assert.equal(conflict, null);
    console.log("PASS stale write rejected by database without overwriting current data");
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
