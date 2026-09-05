"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("正在验证重置链接...");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let active = true;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setReady(true);
        setMessage("请输入新的登录密码。");
      } else {
        setError("重置链接无效或已过期，请返回登录页重新发送。");
      }
    };
    void checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setReady(true);
        setMessage("请输入新的登录密码。");
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !ready) return;
    if (password.length < 6) {
      setError("新密码至少需要 6 位。");
      return;
    }
    if (password !== confirmation) {
      setError("两次输入的密码不一致。");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("密码已更新，请使用新密码登录。");
    window.setTimeout(() => router.replace("/login"), 1200);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><KeyRound /></span>
            <div>
              <CardTitle>设置新密码</CardTitle>
              <CardDescription className="mt-1">{message}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ready ? <form onSubmit={submit}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="new-password">新密码</FieldLabel>
                <Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" autoComplete="new-password" disabled={submitting} aria-invalid={Boolean(error)} />
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="confirm-password">确认新密码</FieldLabel>
                <Input id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="再次输入新密码" autoComplete="new-password" disabled={submitting} aria-invalid={Boolean(error)} />
              </Field>
              {error ? <FieldError>{error}</FieldError> : null}
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? "正在更新" : "保存新密码"}
              </Button>
            </FieldGroup>
          </form> : <div className="space-y-4 text-sm text-muted-foreground">
            {error ? <p className="text-destructive">{error}</p> : !supabase ? <p className="text-destructive">账号服务尚未配置，请返回网站后重试。</p> : <p className="flex items-center gap-2"><CheckCircle2 className="animate-pulse" />{message}</p>}
            <Button type="button" variant="outline" onClick={() => router.replace("/login")}>返回登录</Button>
          </div>}
        </CardContent>
      </Card>
    </main>
  );
}
