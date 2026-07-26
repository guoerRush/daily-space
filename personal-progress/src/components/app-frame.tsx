"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, BookOpen, CalendarDays, CalendarHeart, ClipboardList, LayoutDashboard, LogOut, Settings, StickyNote, Target } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { CloudRecordSync } from "@/components/cloud-record-sync";
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
  { href: "/goals", label: "目标与习惯", icon: Target },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return <AuthGate><div className="min-h-screen bg-[#f9faf6] text-[#26382d]">
    <header className="sticky top-0 z-20 border-b border-[#d9e2d8] bg-[#fffdf8]/88 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#47745a] text-white shadow-[0_4px_12px_rgba(54,91,67,0.18)]"><BookOpen size={18} /></span><span><span className="block text-sm font-semibold leading-4">日常留白</span><span className="mt-0.5 block text-[11px] text-[#758078]">个人记录与复盘</span></span></Link>
        <div className="flex items-center gap-1.5"><DailyStatus /><VoiceDictationButton /><AccountControl /><Link href="/settings#reminders" aria-label="提醒设置" title="提醒设置" className="relative grid h-9 w-9 place-items-center rounded-lg text-[#5f6d64] hover:bg-[#eef4eb]"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#d18a72]" /></Link><Link href="/settings" aria-label="设置" title="设置" className="grid h-9 w-9 place-items-center rounded-lg text-[#5f6d64] hover:bg-[#eef4eb]"><Settings size={18} /></Link></div>
      </div>
    </header>
    <DailyQuote />
    <div className="grid w-full grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]"><aside className="sticky top-16 hidden h-[calc(100vh-4rem)] self-start overflow-y-auto border-r border-[#d9e2d8] bg-[#fbfcf8]/72 px-4 py-7 lg:block"><p className="px-3 pb-3 text-[11px] font-semibold text-[#8a948d]">工作台</p><nav className="flex flex-col gap-1 text-sm">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${pathname === href ? "bg-[#e5f0e4] font-semibold text-[#315f45]" : "text-[#68766e] hover:bg-[#f0f5ed]"}`}><Icon size={17} />{label}</Link>)}</nav></aside><main className="min-w-0 px-4 py-6 pb-24 md:px-8 md:py-9 lg:pb-12">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-[#d9e2d8] bg-[#fffdf8]/95 px-1 lg:hidden">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid min-w-[76px] flex-1 place-items-center gap-1 py-2.5 text-[11px] ${pathname === href ? "font-semibold text-[#47745a]" : "text-[#78847d]"}`}><Icon size={18} />{label}</Link>)}</nav>
    <PocketPet /><VoiceDictationButton floating /><ReminderWatcher /><CloudRecordSync />
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
