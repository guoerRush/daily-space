"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, BookOpen, CalendarDays, CalendarHeart, ClipboardList, LayoutDashboard, Settings, StickyNote, Target } from "lucide-react";
import { CloudRecordSync } from "@/components/cloud-record-sync";
import { DailyQuote } from "@/components/daily-quote";
import { DailyStatus } from "@/components/daily-status";
import { PocketPet } from "@/components/pocket-pet";
import { ReminderWatcher } from "@/components/reminder-watcher";
import { VoiceDictationButton } from "@/components/voice-dictation-button";

const navigation = [
  { href: "/", label: "全景看板", icon: LayoutDashboard }, { href: "/calendar", label: "日程", icon: CalendarDays }, { href: "/days", label: "纪念日倒计时", icon: CalendarHeart }, { href: "/journals", label: "复盘手记", icon: BookOpen }, { href: "/notes", label: "闲思札记", icon: StickyNote }, { href: "/plan", label: "当日计划", icon: ClipboardList }, { href: "/goals", label: "目标与习惯", icon: Target },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-[#f7f9f6] text-[#18241d]">
    <header className="sticky top-0 z-20 border-b border-[#dce5dd] bg-white/85 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 md:px-8">
      <Link href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2f6651] text-white"><BookOpen size={18} /></span><span><span className="block text-sm font-semibold leading-4">日常留白</span><span className="mt-0.5 block text-[11px] text-[#718077]">个人记录与复盘</span></span></Link>
      <div className="flex items-center gap-1.5"><DailyStatus /><VoiceDictationButton /><Link href="/login" aria-label="账号登录" title="账号登录" className="grid h-9 w-9 place-items-center rounded-lg text-[#526158] hover:bg-[#edf4ee]"><span className="text-xs font-semibold">账号</span></Link><Link href="/settings#reminders" aria-label="提醒设置" title="提醒设置" className="relative grid h-9 w-9 place-items-center rounded-lg text-[#526158] hover:bg-[#edf4ee]"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#c76b58]" /></Link><Link href="/settings" aria-label="设置" title="设置" className="grid h-9 w-9 place-items-center rounded-lg text-[#526158] hover:bg-[#edf4ee]"><Settings size={18} /></Link></div>
    </div></header>
    <DailyQuote />
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]"><aside className="hidden border-r border-[#dce5dd] bg-white/35 px-4 py-7 lg:block"><p className="px-3 pb-3 text-[11px] font-semibold text-[#8a968e]">工作台</p><nav className="flex flex-col gap-1 text-sm">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${pathname === href ? "bg-[#dfeee3] font-semibold text-[#245440]" : "text-[#65736a] hover:bg-[#edf4ee]"}`}><Icon size={17} />{label}</Link>)}</nav></aside><main className="min-w-0 px-4 py-6 pb-24 md:px-8 md:py-9 lg:pb-12">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-[#dce5dd] bg-white/95 px-1 lg:hidden">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid min-w-[76px] flex-1 place-items-center gap-1 py-2.5 text-[11px] ${pathname === href ? "font-semibold text-[#2f6651]" : "text-[#718077]"}`}><Icon size={18} />{label}</Link>)}</nav>
    <PocketPet /><ReminderWatcher /><CloudRecordSync />
  </div>;
}
