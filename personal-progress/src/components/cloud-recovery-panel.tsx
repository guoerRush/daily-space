"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DatabaseBackup, History, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listCloudRecordBackups,
  recoverCurrentCloudRecords,
  recoverRemoteDiaries,
  restoreCloudRecordBackup,
  type CloudRecordBackup,
} from "@/lib/cloud-backups";

function backupScore(backup: CloudRecordBackup) {
  return backup.counts.journals +
    backup.counts.successJournals +
    backup.counts.notes +
    backup.counts.plans;
}

function formatBackupTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resultMessage(reason: string) {
  if (reason === "not-authenticated") return "登录状态已失效，请重新登录后再恢复。";
  if (reason === "not-configured") return "云端账号服务尚未配置。";
  if (reason === "not-found") return "没有找到可恢复的云端记录。";
  return "云端历史暂时无法读取。若数据库尚未建立历史表，请先执行项目中的备份迁移。";
}

export function CloudRecoveryPanel() {
  const [backups, setBackups] = useState<CloudRecordBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | "all" | "diaries" | null>(null);
  const [status, setStatus] = useState("正在扫描云端历史版本…");
  const bestBackup = useMemo(
    () => [...backups].sort((left, right) => backupScore(right) - backupScore(left))[0],
    [backups],
  );

  const scan = useCallback(async () => {
    setLoading(true);
    const result = await listCloudRecordBackups();
    if (result.ok) {
      setBackups(result.data);
      setStatus(result.data.length
        ? `找到 ${result.data.length} 个云端历史版本，恢复时会与当前数据合并。`
        : "云端历史版本为空，仍可尝试从日记云镜像找回认知复盘。");
    } else {
      setBackups([]);
      setStatus(resultMessage(result.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void scan(), 0);
    return () => window.clearTimeout(timer);
  }, [scan]);

  const restoreBackup = async (backup: CloudRecordBackup) => {
    setRestoring(backup.id);
    setStatus("正在合并历史版本，请不要关闭页面…");
    const result = await restoreCloudRecordBackup(backup.id);
    if (result.ok) {
      const counts = result.data.counts;
      setStatus(`已找回并合并：日记 ${counts.journals} 篇、成功日记 ${counts.successJournals} 篇、随记 ${counts.notes} 条、每日安排 ${counts.plans} 天。`);
    } else {
      setStatus(resultMessage(result.reason));
    }
    setRestoring(null);
  };

  const recoverAll = async () => {
    setRestoring("all");
    setStatus("正在依次合并云端当前版本、历史快照和日记镜像，请不要关闭页面…");
    let finalCounts = null;
    let recoveredSources = 0;

    const current = await recoverCurrentCloudRecords();
    if (current.ok) {
      finalCounts = current.data.counts;
      recoveredSources += 1;
    }
    if (bestBackup) {
      const history = await restoreCloudRecordBackup(bestBackup.id);
      if (history.ok) {
        finalCounts = history.data.counts;
        recoveredSources += 1;
      }
    }
    const diaries = await recoverRemoteDiaries();
    if (diaries.ok) {
      finalCounts = diaries.data.counts;
      recoveredSources += 1;
    }

    if (finalCounts) {
      setStatus(`恢复完成，共合并 ${recoveredSources} 个云端来源：日记 ${finalCounts.journals} 篇、成功日记 ${finalCounts.successJournals} 篇、随记 ${finalCounts.notes} 条、每日安排 ${finalCounts.plans} 天。返回全景看板即可查看。`);
    } else {
      setStatus("没有从云端找到可恢复内容。当前浏览器数据保持不变。");
    }
    setRestoring(null);
  };

  const recoverDiaries = async () => {
    setRestoring("diaries");
    setStatus("正在从日记云镜像重新加载…");
    const result = await recoverRemoteDiaries();
    if (result.ok) {
      setStatus(`已从日记云镜像找到 ${result.data.recoveredDiaries} 篇记录，并与当前日记合并。`);
    } else {
      setStatus(resultMessage(result.reason));
    }
    setRestoring(null);
  };

  return (
    <section className="mt-5 rounded-lg border border-[#d7e3d7] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#2f6651]">
            <DatabaseBackup size={19} />
            <h2 className="font-semibold">找回过往数据</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#65736a]">
            云端历史只补回缺失内容；当前浏览器仍存在的记录优先保留。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void scan()} disabled={loading || restoring !== null}>
          <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          重新扫描
        </Button>
      </div>

      <p role="status" className="mt-4 rounded-md border border-[#dce8dd] bg-[#f3f8f2] px-3 py-2 text-sm leading-6 text-[#3f6650]">
        {status}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void recoverAll()}
          disabled={restoring !== null}
        >
          <RotateCcw data-icon="inline-start" />
          {restoring === "all" ? "正在重新加载" : "一键重新加载全部云端数据"}
        </Button>
        {bestBackup ? (
          <Button type="button" variant="outline" onClick={() => void restoreBackup(bestBackup)} disabled={restoring !== null}>
            <DatabaseBackup data-icon="inline-start" />
            恢复记录最多的历史版本
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => void recoverDiaries()} disabled={restoring !== null}>
          <History data-icon="inline-start" />
          {restoring === "diaries" ? "正在重新加载" : "从日记云镜像找回"}
        </Button>
      </div>

      {backups.length ? (
        <div className="mt-5 divide-y divide-[#e6ece6] border-y border-[#e6ece6]">
          {backups.slice(0, 10).map((backup) => (
            <div key={backup.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="text-sm">
                <p className="font-medium text-[#354b3b]">{formatBackupTime(backup.createdAt)} 的历史版本</p>
                <p className="mt-1 text-xs text-[#718077]">
                  日记 {backup.counts.journals} · 成功日记 {backup.counts.successJournals} · 随记 {backup.counts.notes} · 安排 {backup.counts.plans}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => void restoreBackup(backup)} disabled={restoring !== null}>
                <RotateCcw data-icon="inline-start" />
                合并恢复
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
