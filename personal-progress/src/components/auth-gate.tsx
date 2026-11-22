"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { browserRecords, flushBrowserRecords, initializeBrowserRecords } from "@/lib/browser-records";
import { activateAccountStorage } from "@/lib/account-storage";
import { syncErrorDetail } from "@/lib/cloud-errors";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.replace("/login?setup=1");
      return;
    }

    let active = true;
    let generation = 0;
    const openWorkspace = async (userId: string) => {
      const request = ++generation;
      await initializeBrowserRecords().catch(() => {});
      if (!active || request !== generation) return;
      activateAccountStorage(browserRecords, userId);
      await flushBrowserRecords().catch(() => {});
      if (active && request === generation) setAuthenticated(true);
      if (active && request === generation) setStorageError(false);
      if (active && request === generation) setSessionError("");
    };
    const redirectToLogin = () => {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    };

    const resolveSession = async () => {
      const started = generation;
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!active || generation !== started) return;
      if (error) setSessionError(syncErrorDetail(error));
      else if (session) await openWorkspace(session.user.id);
      else redirectToLogin();
    };

    const reportStorageError = (error: unknown) => {
      console.error("Could not open account storage.", error);
      if (active) setStorageError(true);
    };
    void resolveSession().catch(reportStorageError);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) void openWorkspace(session.user.id).catch(reportStorageError);
      else if (event === "SIGNED_OUT") {
        generation += 1;
        setAuthenticated(false);
        redirectToLogin();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router, attempt]);

  if (storageError) {
    return <main className="grid min-h-screen place-items-center bg-background px-6"><p role="alert">暂时无法读取账号在此设备上的记录，请重新打开页面后重试。</p></main>;
  }
  if (!authenticated) {
    if (sessionError) return <main className="grid min-h-screen place-items-center bg-background px-6"><div className="space-y-3 text-center"><p role="alert">{sessionError}</p><button type="button" className="text-primary underline" onClick={() => { setSessionError(""); setAttempt(value => value + 1); }}>重新连接账号</button></div></main>;
    return <main className="grid min-h-screen place-items-center bg-background px-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" />正在验证账号...</div></main>;
  }

  return <>{children}</>;
}
