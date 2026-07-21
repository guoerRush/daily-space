"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const redirectIfSignedIn = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace("/");
    };
    void redirectIfSignedIn();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const submit = async (signUp: boolean) => {
    const supabase = getSupabaseClient();
    if (!supabase) { setMessage("账号服务尚未配置，请先完成 Supabase 配置。"); return; }
    if (!email.trim() || password.length < 6) { setMessage("请输入邮箱和至少 6 位密码。"); return; }
    setSubmitting(true);
    const result = signUp
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (!signUp || result.data.session) { router.replace("/"); return; }
    setMessage("注册成功，请在邮箱中点击确认链接完成登录。");
  };

  return <AppFrame><div className="mx-auto max-w-md"><div className="border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-2 text-primary"><LockKeyhole /><h1 className="text-xl font-semibold">账号登录</h1></div><p className="mt-2 text-sm leading-6 text-muted-foreground">登录后，历史记录会同步到自己的账号，可在不同设备继续使用。</p><div className="mt-6 flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">邮箱<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label><label className="flex flex-col gap-2 text-sm font-medium">密码<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" autoComplete="current-password" /></label><div className="flex gap-2"><Button className="flex-1" disabled={submitting} onClick={() => void submit(false)}>登录</Button><Button className="flex-1" variant="outline" disabled={submitting} onClick={() => void submit(true)}>注册</Button></div>{message ? <p className="text-sm text-primary">{message}</p> : null}</div><Link href="/" className="mt-5 inline-block text-sm text-muted-foreground hover:text-foreground">返回今日</Link></div></div></AppFrame>;
}
