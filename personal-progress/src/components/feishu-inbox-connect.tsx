"use client";

import { useState } from "react";
import { Bot, Copy, KeyRound, MessageCircleMore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";

const labels = {
  title: "\u624b\u673a\u98de\u4e66\u6536\u96c6",
  description: "\u5411\u98de\u4e66\u5e94\u7528\u673a\u5668\u4eba\u53d1\u9001\u6587\u5b57\u6216\u56fe\u7247\uff0c\u5185\u5bb9\u4f1a\u540c\u6b65\u5230\u4f60\u7684\u8bb0\u5f55\u3002\u9ed8\u8ba4\u4fdd\u5b58\u5230 AI \u968f\u8bb0\u3002",
  create: "\u751f\u6210\u7ed1\u5b9a\u7801",
  copyCommand: "\u590d\u5236\u7ed1\u5b9a\u547d\u4ee4",
  signIn: "\u8bf7\u5148\u767b\u5f55\u7f51\u7ad9\u8d26\u53f7\u3002",
  creating: "\u6b63\u5728\u751f\u6210\u7ed1\u5b9a\u7801\u2026",
  failed: "\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u670d\u52a1\u5668\u914d\u7f6e\u3002",
  instruction: "\u8bf7\u5728 10 \u5206\u949f\u5185\u628a\u4e0b\u9762\u7684\u547d\u4ee4\u53d1\u9001\u7ed9\u98de\u4e66\u5e94\u7528\u673a\u5668\u4eba\u3002",
  copied: "\u5df2\u590d\u5236\u3002",
  sendToBot: "\u53d1\u9001\u7ed9\u673a\u5668\u4eba\uff1a",
  expires: "\u7ed1\u5b9a\u7801\u5c06\u5728",
  invalid: "\u5931\u6548\u3002",
  formats: "\u53d1\u9001\u683c\u5f0f",
  callback: "\u98de\u4e66\u5f00\u653e\u5e73\u53f0\u56de\u8c03\u5730\u5740",
};

export function FeishuInboxConnect() {
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState("");
  const callbackUrl = typeof window === "undefined" ? "" : `${window.location.origin}/api/feishu/events`;

  const createCode = async () => {
    const supabase = getSupabaseClient();
    const result = supabase ? await supabase.auth.getSession() : null;
    const session = result?.data.session;
    if (!session) { setStatus(labels.signIn); return; }
    setStatus(labels.creating);
    const response = await fetch("/api/feishu/bindings", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const data = await response.json().catch(() => ({})) as { code?: string; expiresAt?: string; message?: string };
    if (!response.ok || !data.code) { setStatus(data.message || labels.failed); return; }
    setCode(data.code);
    setExpiresAt(new Date(data.expiresAt ?? "").toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
    setStatus(labels.instruction);
  };

  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setStatus(labels.copied); };

  return <section className="mx-auto mt-5 max-w-3xl border border-[#dfe5df] bg-white p-6">
    <div className="flex items-center gap-2 text-[#2f6651]"><MessageCircleMore size={19} /><h2 className="font-semibold">{labels.title}</h2></div>
    <p className="mt-3 text-sm leading-6 text-[#65736a]">{labels.description}</p>
    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void createCode()}><KeyRound data-icon="inline-start" />{labels.create}</Button>{code ? <Button variant="outline" onClick={() => void copy(`\u7ed1\u5b9a ${code}`)}><Copy data-icon="inline-start" />{labels.copyCommand}</Button> : null}</div>
    {code ? <div className="mt-4 border border-[#d8e7db] bg-[#f3f8f4] px-4 py-3"><p className="text-sm text-[#526158]">{labels.sendToBot}</p><p className="mt-1 font-mono text-lg font-semibold text-[#245440]">{`\u7ed1\u5b9a ${code}`}</p><p className="mt-1 text-xs text-[#65736a]">{labels.expires} {expiresAt} {labels.invalid}</p></div> : null}
    <div className="mt-5 border-t border-[#edf1ed] pt-4 text-sm leading-7 text-[#65736a]"><p className="font-medium text-[#526158]">{labels.formats}</p><p><code>/ai</code> \u5185\u5bb9\uff1aAI \u968f\u8bb0</p><p><code>/\u5de5\u4f5c</code> \u5185\u5bb9\uff1a\u5de5\u4f5c\u968f\u8bb0</p><p><code>/\u751f\u6d3b</code> \u5185\u5bb9\uff1a\u5b9e\u7528\u751f\u6d3b\u77e5\u8bc6</p><p><code>/\u65e5\u8bb0</code> \u5185\u5bb9\uff1a\u8ffd\u52a0\u5230\u4eca\u5929\u65e5\u8bb0</p><p><code>/\u5b89\u6392</code> \u5185\u5bb9\uff1a\u52a0\u5165\u4eca\u5929\u5f85\u529e</p><p><code>/\u6210\u529f\u65e5\u8bb0</code> \u5185\u5bb9\uff1a\u4eca\u5929\u6210\u529f\u65e5\u8bb0</p><p><code>/\u957f\u671f\u76ee\u6807</code> \u6216 <code>/\u77ed\u671f\u76ee\u6807</code> \u5185\u5bb9\uff1a\u65b0\u589e\u76ee\u6807</p><p><code>/\u4e60\u60ef</code> \u5185\u5bb9\uff1a\u65b0\u589e\u4e60\u60ef\uff0c<code>/\u6253\u5361</code> \u4e60\u60ef\u540d\uff1a\u4eca\u65e5\u6253\u5361</p><p><code>/\u7eaa\u5ff5\u65e5</code> 2026-12-31 \u6807\u9898\uff1a\u65b0\u589e\u7eaa\u5ff5\u65e5</p><p><code>/\u63d0\u9192</code> 21:50 \u6d88\u606f\uff1a\u65b0\u589e\u98de\u4e66\u63d0\u9192</p></div>
    <div className="mt-5 border-t border-[#edf1ed] pt-4"><div className="flex items-center gap-2 text-sm font-medium text-[#526158]"><Bot size={16} />{labels.callback}</div><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all bg-[#f4f6f3] px-3 py-2 text-xs text-[#526158]">{callbackUrl}</code><Button size="icon-sm" variant="ghost" onClick={() => void copy(callbackUrl)} aria-label="copy callback url"><Copy /></Button></div></div>
    {status ? <p className="mt-4 text-sm text-[#2f6651]">{status}</p> : null}
  </section>;
}
