"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.replace("/login?setup=1");
      return;
    }

    let active = true;
    const redirectToLogin = () => {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    };

    const resolveSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) setAuthenticated(true);
      else redirectToLogin();
    };

    void resolveSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setAuthenticated(true);
      else {
        setAuthenticated(false);
        redirectToLogin();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!authenticated) {
    return <main className="grid min-h-screen place-items-center bg-background px-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" />正在验证账号...</div></main>;
  }

  return <>{children}</>;
}
