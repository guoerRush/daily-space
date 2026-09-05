"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [message, setMessage] = useState("正在确认邮箱并登录...");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const isRecovery = new URLSearchParams(window.location.search).get("mode") === "recovery"
      || window.location.hash.includes("type=recovery");
    const finishSession = () => {
      window.history.replaceState(null, "", isRecovery ? "/auth/reset-password" : "/auth/callback");
      router.replace(isRecovery ? "/auth/reset-password" : "/");
    };
    const finish = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error || !session) { setMessage("确认链接无效或已过期，请返回登录页重新注册或登录。"); return; }
      finishSession();
    };
    void finish();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finishSession();
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router, supabase]);

  return <main className="grid min-h-screen place-items-center bg-background px-6"><p className="text-sm text-muted-foreground">{supabase ? message : "账号服务尚未配置，请返回网站后重试。"}</p></main>;
}
