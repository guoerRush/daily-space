"use client";

import Link from "next/link";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const login = async (signUp: boolean) => {
    const supabase = getSupabaseClient();
    if (!supabase) { setMessage("账号服务尚未配置，请先完成 Supabase 配置。"); return; }
    if (!email.trim() || password.length < 6) { setMessage("请输入邮箱和至少 6 位密码。"); return; }
    const result = signUp ? await supabase.auth.signUp({ email: email.trim(), password }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setMessage(result.error ? result.error.message : signUp ? "注册成功，请前往邮箱完成验证后登录。" : "登录成功，正在同步你的个人记录。");
  };
  return <AppFrame><div className="mx-auto max-w-md"><div className="border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-2 text-primary"><LockKeyhole size={20} /><h1 className="text-xl font-semibold">账号登录</h1></div><p className="mt-2 text-sm leading-6 text-muted-foreground">登录后，你的历史记录会同步到自己的账号，可在不同设备继续使用。</p><div className="mt-6 flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">邮箱<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label><label className="flex flex-col gap-2 text-sm font-medium">密码<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" /></label><div className="flex gap-2"><Button className="flex-1" onClick={() => void login(false)}>登录</Button><Button className="flex-1" variant="outline" onClick={() => void login(true)}>注册</Button></div>{message ? <p className="text-sm text-primary">{message}</p> : null}</div><Link href="/" className="mt-5 inline-block text-sm text-muted-foreground hover:text-foreground">返回今日</Link></div></div></AppFrame>;
}
