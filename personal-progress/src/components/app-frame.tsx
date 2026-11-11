"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, BookOpen, CalendarDays, CalendarHeart, ClipboardList, Dumbbell, LayoutDashboard, LogOut, Settings, StickyNote, Target } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { CloudRecordSync } from "@/components/cloud-record-sync";
import { CompanionShelf } from "@/components/companion-shelf";
import { LocalBackupSync } from "@/components/local-backup-sync";
import { ObsidianAutoSync } from "@/components/obsidian-auto-sync";
import { DailyQuote } from "@/components/daily-quote";
import { DailyStatus } from "@/components/daily-status";
import { PocketPet } from "@/components/pocket-pet";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { VoiceDictationButton } from "@/components/voice-dictation-button";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";

const navigation = [
  { href: "/", label: "全景看板", icon: LayoutDashboard },
  { href: "/calendar", label: "日程", icon: CalendarDays },
  { href: "/days", label: "纪念日倒计时", icon: CalendarHeart },
  { href: "/journals", label: "复盘手记", icon: BookOpen },
  { href: "/notes", label: "闲思札记", icon: StickyNote },
  { href: "/plan", label: "当日计划", icon: ClipboardList },
  { href: "/fitness", label: "健身", icon: Dumbbell },
  { href: "/goals", label: "目标与习惯", icon: Target },
];

export function AppFrame({ children, compactContent = false }: { children: ReactNode; compactContent?: boolean }) {
  const pathname = usePathname();

  return <AuthGate><div className="daily-space-shell text-foreground">
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/90 shadow-[0_3px_18px_rgba(49,108,99,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="group flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_5px_14px_rgba(55,122,110,0.2)] transition-transform group-hover:-rotate-3 group-hover:scale-105"><BookOpen size={18} /></span><span><span className="block text-sm font-semibold leading-4">日常留白</span><span className="mt-0.5 block text-[11px] text-muted-foreground">个人记录与复盘</span></span></Link>
        <div className="flex items-center gap-1.5"><DailyStatus /><VoiceDictationButton /><AccountControl /><Link href="/settings#reminders" aria-label="提醒设置" title="提醒设置" className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e97968]" /></Link><Link href="/settings" aria-label="设置" title="设置" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary"><Settings size={18} /></Link></div>
      </div>
    </header>
    <DailyQuote />
    <div className="grid w-full grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]"><aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] self-start flex-col overflow-y-auto border-r border-border/80 bg-card/65 px-4 py-6 backdrop-blur-sm lg:flex"><p className="px-3 pb-3 text-[11px] font-semibold text-muted-foreground">工作台</p><nav className="flex flex-col gap-1 text-sm">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${pathname === href ? "border-primary/15 bg-secondary font-semibold text-primary shadow-[0_5px_14px_rgba(55,122,110,0.08)]" : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-card hover:text-foreground"}`}><Icon size={17} />{label}</Link>)}</nav><CompanionShelf /></aside><main className={`min-w-0 px-4 py-6 pb-24 md:py-9 lg:pb-12 ${compactContent ? "md:px-4" : "md:px-8"}`}>{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-border/80 bg-card/95 px-1 shadow-[0_-6px_20px_rgba(49,108,99,0.07)] backdrop-blur-xl lg:hidden">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid min-w-[76px] flex-1 place-items-center gap-1 py-2.5 text-[11px] ${pathname === href ? "font-semibold text-primary" : "text-muted-foreground"}`}><Icon size={18} />{label}</Link>)}</nav>
    <PocketPet /><VoiceDictationButton floating /><ReminderWatcher /><CloudRecordSync /><LocalBackupSync /><ObsidianAutoSync />
  </div></AuthGate>;
}

function AccountControl() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const readSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setEmail(session?.user.email ?? "");
    };
    void readSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? ""));
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
  };

  return <Button variant="ghost" size="icon-lg" onClick={() => void signOut()} aria-label="退出当前账号" title={email ? `退出 ${email}` : "退出当前账号"}><LogOut /></Button>;
}
