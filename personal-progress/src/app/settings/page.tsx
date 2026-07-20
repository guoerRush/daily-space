"use client";

import { useRef, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from "react";
import { Bell, CheckCircle2, Download, ExternalLink, Save, ShieldCheck, Upload } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { getReminderSettings, saveReminderSettings } from "@/lib/reminder";
import { FeishuInboxConnect } from "@/components/feishu-inbox-connect";

function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  return ready ? <>{children}</> : null;
}

export default function SettingsPage() { return <AppFrame><ClientOnly><FeishuInboxConnect /><SettingsWorkspace /></ClientOnly></AppFrame>; }

function SettingsWorkspace() {
  const initialReminder = getReminderSettings();
  const [enabled, setEnabled] = useState(initialReminder.enabled);
  const [time, setTime] = useState(initialReminder.time);
  const [status, setStatus] = useState("");
  const [exported, setExported] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const saveReminder = async () => {
    saveReminderSettings({ ...getReminderSettings(), enabled, time, lastNotifiedDate: enabled ? getReminderSettings().lastNotifiedDate : undefined });
    if (enabled && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    setStatus(enabled ? `每日 ${time} 的浏览器提醒已保存。` : "每日提醒已关闭。");
  };
  const testBrowserReminder = () => {
    if (!("Notification" in window)) { setStatus("当前浏览器不支持系统通知。"); return; }
    if (Notification.permission !== "granted") { setStatus("请先点击“保存提醒设置”并允许浏览器通知。"); return; }
    new Notification("日常留白", { body: "这是一条浏览器提醒测试。" });
    setStatus("浏览器提醒测试已发送。");
  };
  const testFeishu = async () => {
    setStatus("正在发送飞书测试提醒...");
    try { const response = await fetch("/api/reminders/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ time }) }); const data = await response.json(); setStatus(data.message ?? "测试完成。"); } catch { setStatus("测试失败，请确认本地服务正在运行。"); }
  };
  const exportData = () => {
    const records = Object.keys(window.localStorage).filter((key) => key.startsWith("daily-space:") || key.startsWith("journal:") || key.startsWith("mood:")).reduce<Record<string, string>>((result, key) => { result[key] = window.localStorage.getItem(key) ?? ""; return result; }, {});
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = href; link.download = `日常留白备份-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(href); setExported("备份文件已下载。");
  };
  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as { records?: unknown };
      if (!backup.records || typeof backup.records !== "object" || Array.isArray(backup.records)) throw new Error("invalid backup");
      const records = Object.entries(backup.records).filter(([key, value]) => (key.startsWith("daily-space:") || key.startsWith("journal:") || key.startsWith("mood:")) && typeof value === "string");
      if (!records.length) throw new Error("empty backup");
      records.forEach(([key, value]) => window.localStorage.setItem(key, value));
      ["daily-space:journals-changed", "daily-space:notes-changed", "daily-space:plans-changed", "daily-space:success-journals-changed", "daily-space:reminder-changed"].forEach((name) => window.dispatchEvent(new Event(name)));
      setExported(`已导入 ${records.length} 项本地数据，请刷新页面查看全部记录。`);
    } catch {
      setExported("导入失败：请选择从“日常留白”导出的备份 JSON 文件。");
    } finally {
      event.target.value = "";
    }
  };
  return <div className="mx-auto max-w-3xl"><p className="text-sm text-[#65736a]">个人偏好、消息通知与数据安全</p><h1 className="mt-1 text-2xl font-semibold md:text-3xl">设置</h1><section id="reminders" className="mt-7 border border-[#dfe5df] bg-white p-6"><div className="flex items-center gap-2 text-[#2f6651]"><Bell size={19} /><h2 className="font-semibold">每日提醒</h2></div><p className="mt-2 text-sm text-[#65736a]">在设定时间提醒你完成当日复盘与日记记录。</p><div className="mt-5 flex flex-wrap items-center gap-4 border-y border-[#edf1ed] py-4"><label className="flex items-center gap-2 text-sm font-medium text-[#526158]"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-[#2f6651]" />开启每日提醒</label><label className="flex items-center gap-2 text-sm text-[#526158]">提醒时间 <input type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={!enabled} className="border border-[#cfd8d0] bg-white px-3 py-2 outline-none disabled:bg-[#f3f5f3]" /></label><button onClick={saveReminder} className="inline-flex items-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"><Save size={16} />保存提醒设置</button></div><div className="mt-5 flex flex-wrap gap-2"><button onClick={testBrowserReminder} className="inline-flex items-center gap-2 border border-[#2f6651] px-4 py-2.5 text-sm font-medium text-[#2f6651]"><Bell size={16} />测试浏览器提醒</button><button onClick={testFeishu} className="inline-flex items-center gap-2 border border-[#cfd8d0] px-4 py-2.5 text-sm font-medium text-[#526158]"><Bell size={16} />发送飞书测试提醒</button></div><p className="mt-4 text-xs leading-5 text-[#718077]">浏览器提醒在本网站打开期间生效。飞书云端定时提醒当前仍按已部署的 21:50 执行；时间测试会使用你当前选择的时间。</p>{status ? <p className="mt-4 flex items-center gap-2 bg-[#edf5ef] px-3 py-2.5 text-sm text-[#2f6651]"><CheckCircle2 size={16} />{status}</p> : null}</section><section className="mt-5 border border-[#dfe5df] bg-white p-6"><div className="flex items-center gap-2 text-[#2f6651]"><ShieldCheck size={19} /><h2 className="font-semibold">数据与隐私</h2></div><p className="mt-3 text-sm leading-6 text-[#65736a]">日记、随记、今日安排、习惯和提醒设置默认保存在当前浏览器。导出后可迁移到新的网址或长期保存。</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={exportData} className="inline-flex items-center gap-2 border border-[#2f6651] px-4 py-2.5 text-sm font-medium text-[#2f6651]"><Download size={16} />导出全部本地数据</button><input ref={importInputRef} type="file" accept="application/json" onChange={importData} className="hidden" /><button onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 bg-[#2f6651] px-4 py-2.5 text-sm font-medium text-white"><Upload size={16} />导入本地备份</button></div>{exported ? <p className="mt-3 text-sm text-[#2f6651]">{exported}</p> : null}</section><section className="mt-5 border border-[#dfe5df] bg-white p-6"><h2 className="font-semibold">飞书云端提醒</h2><p className="mt-3 text-sm leading-6 text-[#65736a]">配置好 <code className="bg-[#edf1ed] px-1">FEISHU_WEBHOOK_URL</code> 后，Vercel Cron 会在每天 21:50（北京时间）发送飞书提醒。</p><a href="https://vercel.com/docs/cron-jobs" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#2f6651]">查看 Vercel Cron 说明 <ExternalLink size={15} /></a></section></div>;
}
