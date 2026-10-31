"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FolderSync, HardDriveDownload, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDataBackup, restoreDataBackup } from "@/lib/record-backup";
import { applyPendingLocalImport } from "@/lib/pending-local-import";
import {
  connectLocalBackupFolder,
  getLocalBackupState,
  LOCAL_LIVE_BACKUP_FILE_NAME,
  readEmergencyBackup,
  requestLocalBackupPermission,
  saveBackupToLocalFolder,
  type LocalBackupState,
} from "@/lib/local-backup";

function formatTime(value?: string) {
  if (!value) return "尚未生成";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LocalBackupPanel() {
  const [state, setState] = useState<LocalBackupState | null>(null);
  const [working, setWorking] = useState<"connect" | "permission" | "backup" | "restore" | null>(null);
  const [message, setMessage] = useState("正在检查本机保护副本…");

  const refresh = useCallback(async () => {
    try {
      const next = await getLocalBackupState();
      setState(next);
      setMessage(next.status.emergencyBackedUpAt
        ? `浏览器保护副本：${formatTime(next.status.emergencyBackedUpAt)}`
        : "将于首次保存后的约 3 秒生成浏览器保护副本。");
    } catch {
      setMessage("无法读取本机备份状态，但当前浏览器数据没有被修改。");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const connect = async () => {
    setWorking("connect");
    try {
      const selected = await connectLocalBackupFolder();
      const imported = await applyPendingLocalImport();
      const result = await saveBackupToLocalFolder(createDataBackup());
      const next = await getLocalBackupState();
      setState(next);
      setMessage(imported.found && imported.applied
        ? `已连接“${selected.directoryName}”，成功日记已核对并导入 ${imported.importedLines} 条，${LOCAL_LIVE_BACKUP_FILE_NAME} 也已更新。`
        : result.saved
          ? `已连接“${selected.directoryName}”，并写入 ${LOCAL_LIVE_BACKUP_FILE_NAME}。`
          : `已选择“${selected.directoryName}”，等待文件夹写入授权。`);
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        setMessage("未选择文件夹，现有数据保持不变。");
      } else {
        setMessage("连接本地文件夹失败。请在 Edge 或 Chrome 中重试。");
      }
    } finally {
      setWorking(null);
    }
  };

  const grantPermission = async () => {
    setWorking("permission");
    try {
      const result = await requestLocalBackupPermission();
      if (result.granted) {
        const imported = await applyPendingLocalImport();
        const saved = await saveBackupToLocalFolder(createDataBackup());
        const next = await getLocalBackupState();
        setState(next);
        setMessage(imported.found && imported.applied
          ? `写入权限已恢复，成功日记已核对并导入 ${imported.importedLines} 条，${saved.saved ? saved.fileName : LOCAL_LIVE_BACKUP_FILE_NAME} 已更新。`
          : saved.saved
            ? `写入权限已恢复，${saved.fileName} 已立即更新。`
            : "本地文件夹写入权限已恢复。下一次输入后会自动保存。");
      } else {
        setMessage("尚未授予写入权限，因此只保留浏览器保护副本。");
      }
    } finally {
      setWorking(null);
    }
  };

  const backupNow = async () => {
    setWorking("backup");
    try {
      const result = await saveBackupToLocalFolder(createDataBackup());
      if (result.saved) {
        setMessage(`${result.fileName} 已覆盖更新：${formatTime(result.savedAt)}。`);
      } else if (result.reason === "permission-needed") {
        setMessage("需要先恢复文件夹写入权限，才可生成本地 JSON 备份。");
      } else {
        setMessage("请先选择本地备份文件夹。");
      }
      await refresh();
    } catch {
      setMessage("生成本地 JSON 备份失败，浏览器保护副本仍保留。");
    } finally {
      setWorking(null);
    }
  };

  const restoreEmergency = async () => {
    setWorking("restore");
    try {
      const backup = await readEmergencyBackup();
      if (!backup) {
        setMessage("还没有可恢复的浏览器保护副本。");
        return;
      }
      const result = restoreDataBackup(backup, { mode: "merge" });
      setMessage(`已从浏览器保护副本合并 ${result.importedRecords} 项记录；当前可见内容没有被覆盖。`);
    } catch {
      setMessage("浏览器保护副本无法恢复，现有数据没有被修改。");
    } finally {
      setWorking(null);
    }
  };

  const folderReady = state?.directoryConnected && state.permission === "granted";

  return (
    <section className="mt-5 border border-[#dfe5df] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#2f6651]">
            <FolderSync size={19} />
            <h2 className="font-semibold">持续本地备份</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65736a]">
            每次编辑后约 3 秒会把当前全部网站数据覆盖写入“{LOCAL_LIVE_BACKUP_FILE_NAME}”。始终只更新这一个实时文件，不再生成每日快照，也不会重复追加旧数据。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={working !== null}>
          <RefreshCw data-icon="inline-start" className={working ? "animate-spin" : undefined} />
          刷新状态
        </Button>
      </div>

      <div className="mt-4 grid gap-3 border-y border-[#edf1ed] py-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[#718077]">浏览器保护副本</p>
          <p className="mt-1 font-medium text-[#354b3b]">{formatTime(state?.status.emergencyBackedUpAt)}</p>
        </div>
        <div>
          <p className="text-[#718077]">本地实时文件</p>
          <p className="mt-1 font-medium text-[#354b3b]">
            {folderReady
              ? `${state?.directoryName} / ${LOCAL_LIVE_BACKUP_FILE_NAME} · ${formatTime(state?.status.fileBackedUpAt)}`
              : "尚未连接或等待写入授权"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!state ? (
          <p className="text-sm text-[#718077]">正在检查浏览器的文件夹写入能力…</p>
        ) : !state.supported ? (
          <p className="text-sm text-[#8b6945]">当前浏览器不支持自动写入本地文件夹，请使用 Edge 或 Chrome，并保留手动导出的备份文件。</p>
        ) : !state.directoryConnected ? (
          <Button type="button" onClick={() => void connect()} disabled={working !== null}>
            <FolderSync data-icon="inline-start" />
            {working === "connect" ? "正在选择" : "选择本地备份文件夹"}
          </Button>
        ) : state.permission !== "granted" ? (
          <Button type="button" onClick={() => void grantPermission()} disabled={working !== null}>
            <FolderSync data-icon="inline-start" />
            {working === "permission" ? "正在授权" : "恢复文件夹写入权限"}
          </Button>
        ) : null}
        {state?.supported && state.directoryConnected ? (
          <Button type="button" variant="outline" onClick={() => void connect()} disabled={working !== null}>
            <FolderSync data-icon="inline-start" />
            {working === "connect" ? "正在选择" : "更改保存路径"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => void backupNow()} disabled={working !== null || !folderReady}>
          <HardDriveDownload data-icon="inline-start" />
          {working === "backup" ? "正在保存" : "立即更新本地文件"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void restoreEmergency()} disabled={working !== null}>
          <RotateCcw data-icon="inline-start" />
          {working === "restore" ? "正在恢复" : "从浏览器保护副本合并恢复"}
        </Button>
      </div>

      <p role="status" className="mt-4 flex items-start gap-2 rounded-md border border-[#dce8dd] bg-[#f3f8f2] px-3 py-2 text-sm leading-6 text-[#3f6650]">
        <Download className="mt-0.5 shrink-0" size={16} />
        {message}
      </p>
    </section>
  );
}
