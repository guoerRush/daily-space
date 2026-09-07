"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Bell,
  CheckCircle2,
  Download,
  ExternalLink,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { RecordTimestamp } from "@/components/record-timestamp";
import { getReminderSettings, saveReminderSettings } from "@/lib/reminder";
import { FeishuInboxConnect } from "@/components/feishu-inbox-connect";
import { CloudRecoveryPanel } from "@/components/cloud-recovery-panel";
import { LocalBackupPanel } from "@/components/local-backup-panel";
import {
  createDataBackup,
  restoreDataBackup,
  serializeDataBackup,
} from "@/lib/record-backup";
import { parsePendingLocalImport } from "@/lib/local-backup";
import {
  listSuccessJournals,
  mergeSuccessJournalLines,
  parseSuccessJournalMarkdown,
} from "@/lib/success-journals";

function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return ready ? <>{children}</> : null;
}

async function readImportFile(file: File) {
  if (typeof file.text === "function") {
    try {
      return await file.text();
    } catch {
      // A few mobile document providers expose File.text() but reject it.
      // Fall through to the older FileReader API in that case.
    }
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("无法读取文件。"));
    reader.readAsText(file, "utf-8");
  });
}

export default function SettingsPage() {
  return (
    <AppFrame>
      <ClientOnly>
        <FeishuInboxConnect />
        <SettingsWorkspace />
      </ClientOnly>
    </AppFrame>
  );
}

function SettingsWorkspace() {
  const initialReminder = getReminderSettings();
  const [enabled, setEnabled] = useState(initialReminder.enabled);
  const [time, setTime] = useState(initialReminder.time);
  const [reminderCreatedAt, setReminderCreatedAt] = useState(initialReminder.createdAt);
  const [reminderUpdatedAt, setReminderUpdatedAt] = useState(initialReminder.updatedAt);
  const [status, setStatus] = useState("");
  const [exported, setExported] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const saveReminder = async () => {
    const savedReminder = saveReminderSettings({
      ...getReminderSettings(),
      enabled,
      time,
      lastNotifiedDate: enabled
        ? getReminderSettings().lastNotifiedDate
        : undefined,
    });
    setReminderCreatedAt(savedReminder.createdAt);
    setReminderUpdatedAt(savedReminder.updatedAt);
    if (
      enabled &&
      "Notification" in window &&
      Notification.permission === "default"
    )
      await Notification.requestPermission();
    setStatus(
      enabled ? `每日 ${time} 的浏览器提醒已保存。` : "每日提醒已关闭。",
    );
  };
  const testBrowserReminder = () => {
    if (!("Notification" in window)) {
      setStatus("当前浏览器不支持系统通知。");
      return;
    }
    if (Notification.permission !== "granted") {
      setStatus("请先点击“保存提醒设置”并允许浏览器通知。");
      return;
    }
    new Notification("日常留白", { body: "这是一条浏览器提醒测试。" });
    setStatus("浏览器提醒测试已发送。");
  };
  const testFeishu = async () => {
    setStatus("正在发送飞书测试提醒...");
    try {
      const response = await fetch("/api/reminders/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time }),
      });
      const data = await response.json();
      setStatus(data.message ?? "测试完成。");
    } catch {
      setStatus("测试失败，请确认本地服务正在运行。");
    }
  };
  const exportData = () => {
    const backup = createDataBackup();
    const blob = new Blob(
      [serializeDataBackup(backup)],
      { type: "application/json" },
    );
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `日常留白备份-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
    setExported("备份文件已下载。");
  };
  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      // Some mobile file providers do not implement File.text() reliably.
      // FileReader also handles files shared from the iOS/Android Files app.
      const text = (await readImportFile(file)).replace(/^\uFEFF/, "").trim();
      if (!text) throw new Error("选择的文件为空。请重新导出 JSON 备份。 ");
      const isMarkdown =
        /\.md(?:own)?$/i.test(file.name) ||
        file.type === "text/markdown";
      if (isMarkdown) {
        const entries = parseSuccessJournalMarkdown(text);
        if (!entries.length) throw new Error("Markdown 中没有有效的日期记录。");
        const result = mergeSuccessJournalLines(entries);
        await new Promise((resolve) => window.setTimeout(resolve, 1_200));
        setExported(
          `成功日记 Markdown 导入完成：识别 ${entries.length} 个日期、补充 ${result.importedLines} 条，当前共有 ${listSuccessJournals().length} 个日期。`,
        );
      } else {
        const candidate = JSON.parse(text) as { format?: unknown };
        if (candidate.format === "daily-space-pending-import") {
        const pending = parsePendingLocalImport(candidate);
        const result = mergeSuccessJournalLines(pending.successJournals);
        await new Promise((resolve) => window.setTimeout(resolve, 1_200));
        setExported(
          `成功日记导入完成：补充 ${result.importedLines} 条，当前共有 ${listSuccessJournals().length} 个日期；已有内容没有被覆盖。`,
        );
        } else {
          const result = restoreDataBackup(text, { mode: "merge" });
          setExported(
            `已合并 ${result.importedRecords} 项备份数据，当前已有内容没有被覆盖。请返回全景看板查看。`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "文件读取失败。";
      setExported(`导入失败：${message} 请使用“导出全部本地数据”生成的 JSON 文件。`);
    } finally {
      event.target.value = "";
    }
  };
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-[#65736a]">个人偏好、消息通知与数据安全</p>
      <h1 className="mt-1 text-2xl font-semibold md:text-3xl">设置</h1>
      <section
        id="reminders"
        className="mt-7 border border-[#dfe5df] bg-white p-6"
      >
        <div className="flex items-center gap-2 text-[#2f6651]">
          <Bell size={19} />
          <h2 className="font-semibold">每日提醒</h2>
        </div>
        <p className="mt-2 text-sm text-[#65736a]">
          在设定时间提醒你完成当日复盘与日记记录。
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-[#edf1ed] py-4">
          <label className="flex items-center gap-2 text-sm font-medium text-[#526158]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 accent-[#2f6651]"
            />
            开启每日提醒
          </label>
          <label className="flex items-center gap-2 text-sm text-[#526158]">
            提醒时间{" "}
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={!enabled}
              className="border border-[#cfd8d0] bg-white px-3 py-2 outline-none disabled:bg-[#f3f5f3]"
            />
          </label>
          <button
            onClick={saveReminder}
            className="inline-flex items-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"
          >
            <Save size={16} />
            保存提醒设置
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={testBrowserReminder}
            className="inline-flex items-center gap-2 border border-[#2f6651] px-4 py-2.5 text-sm font-medium text-[#2f6651]"
          >
            <Bell size={16} />
            测试浏览器提醒
          </button>
          <button
            onClick={testFeishu}
            className="inline-flex items-center gap-2 border border-[#cfd8d0] px-4 py-2.5 text-sm font-medium text-[#526158]"
          >
            <Bell size={16} />
            发送飞书测试提醒
          </button>
        </div>
        {reminderUpdatedAt ? (
          <RecordTimestamp createdAt={reminderCreatedAt} updatedAt={reminderUpdatedAt} showCreatedAt className="mt-3" />
        ) : null}
        <p className="mt-4 text-xs leading-5 text-[#718077]">
          浏览器提醒在本网站打开期间生效。飞书云端定时提醒当前仍按已部署的 21:50
          执行；时间测试会使用你当前选择的时间。
        </p>
        {status ? (
          <p className="mt-4 flex items-center gap-2 bg-[#edf5ef] px-3 py-2.5 text-sm text-[#2f6651]">
            <CheckCircle2 size={16} />
            {status}
          </p>
        ) : null}
      </section>
      <CloudRecoveryPanel />
      <LocalBackupPanel />
      <section className="mt-5 border border-[#dfe5df] bg-white p-6">
        <div className="flex items-center gap-2 text-[#2f6651]">
          <ShieldCheck size={19} />
          <h2 className="font-semibold">数据与隐私</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#65736a]">
          日记、随记、今日安排、习惯和提醒设置默认保存在当前浏览器。导出后可迁移到新的网址或长期保存。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={exportData}
            className="inline-flex items-center gap-2 border border-[#2f6651] px-4 py-2.5 text-sm font-medium text-[#2f6651]"
          >
            <Download size={16} />
            导出全部本地数据
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,.md,.markdown,application/json,text/markdown,text/plain"
            onChange={importData}
            className="hidden"
          />
          <button
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"
          >
            <Upload size={16} />
            导入备份 / 成功日记 Markdown
          </button>
        </div>
        {exported ? (
          <p className="mt-3 text-sm text-[#2f6651]">{exported}</p>
        ) : null}
      </section>
      <section className="mt-5 border border-[#dfe5df] bg-white p-6">
        <h2 className="font-semibold">飞书云端提醒</h2>
        <p className="mt-3 text-sm leading-6 text-[#65736a]">
          配置好 <code className="bg-[#edf1ed] px-1">FEISHU_WEBHOOK_URL</code>{" "}
          后，Vercel Cron 会在每天 21:50（北京时间）发送飞书提醒。
        </p>
        <a
          href="https://vercel.com/docs/cron-jobs"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#2f6651]"
        >
          查看 Vercel Cron 说明 <ExternalLink size={15} />
        </a>
      </section>
    </div>
  );
}
