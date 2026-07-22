"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase";

type Mode = "login" | "register";

export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">正在准备登录...</main>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSetupMissing = searchParams.get("setup") === "1";

  const destination = (() => {
    const next = searchParams.get("next");
    return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  })();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const redirectIfSignedIn = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace(destination);
    };
    void redirectIfSignedIn();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(destination);
    });
    return () => subscription.unsubscribe();
  }, [destination, router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage("账号服务尚未配置，暂时无法登录。");
      setHasError(true);
      return;
    }
    if (!email.trim() || password.length < 6) {
      setMessage("请输入邮箱和至少 6 位密码。");
      setHasError(true);
      return;
    }

    setSubmitting(true);
    setMessage("");
    setHasError(false);
    const result = mode === "register"
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
      setHasError(true);
      return;
    }
    if (mode === "register" && !result.data.session) {
      setMessage("注册成功，请在邮箱中确认后继续登录。");
      setHasError(false);
      return;
    }
    router.replace(destination);
  };

  const switchMode = () => {
    setMode((current) => current === "login" ? "register" : "login");
    setMessage("");
    setHasError(false);
  };

  const title = mode === "login" ? "登录账号" : "注册账号";
  const description = mode === "login" ? "登录后继续使用你的个人记录空间。" : "创建账号后，你的记录将归属于自己的账户。";

  return <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_28rem]">
    <section className="hidden min-h-screen flex-col justify-between bg-secondary p-10 lg:flex">
      <div className="flex items-center gap-3 text-primary"><span className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground"><BookOpen /></span><span className="text-lg font-semibold">日常留白</span></div>
      <div className="max-w-md"><p className="text-sm font-medium text-primary">个人记录空间</p><h1 className="mt-3 text-4xl font-semibold leading-tight text-foreground">把每一天留在自己的账号里。</h1><p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">登录后会保留你的日记、计划、习惯与随记，并在你下次打开时直接回到这里。</p></div>
      <p className="text-xs text-muted-foreground">Daily Space</p>
    </section>
    <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><KeyRound /></span><div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div></div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field data-invalid={hasError}>
                <FieldLabel htmlFor="email">邮箱</FieldLabel>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" aria-invalid={hasError} disabled={submitting} />
              </Field>
              <Field data-invalid={hasError}>
                <FieldLabel htmlFor="password">密码</FieldLabel>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位" autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={hasError} disabled={submitting} />
                {mode === "register" ? <FieldDescription>使用至少 6 位的密码。</FieldDescription> : null}
              </Field>
              {message ? hasError ? <FieldError>{message}</FieldError> : <FieldDescription>{message}</FieldDescription> : null}
              {isSetupMissing ? <FieldError>账号服务尚未配置，请联系网站管理员完成 Supabase 配置。</FieldError> : null}
              <Button type="submit" size="lg" disabled={submitting || isSetupMissing}>
                {mode === "register" ? <UserPlus data-icon="inline-start" /> : null}
                {submitting ? "请稍候" : mode === "login" ? "登录并进入" : "注册账号"}
                {mode === "login" ? <ArrowRight data-icon="inline-end" /> : null}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <span className="text-sm text-muted-foreground">{mode === "login" ? "还没有账号？" : "已经有账号？"}</span>
          <Button type="button" variant="link" onClick={switchMode} disabled={submitting}>{mode === "login" ? "注册" : "去登录"}</Button>
        </CardFooter>
      </Card>
    </section>
  </main>;
}
