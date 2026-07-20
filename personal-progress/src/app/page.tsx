import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Bell, CalendarDays, CheckCircle2, Flame, PenLine } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { AnimatedContent } from "@/components/animated-content";
import { DashboardInsights } from "@/components/dashboard-insights";
import { HomeRecords } from "@/components/home-records";
import { HabitProgress } from "@/components/habit-progress";
import { MaskedHeroImage } from "@/components/masked-hero-image";
import { TodayEvents } from "@/components/today-events";
import { WeeklyInsights } from "@/components/weekly-insights";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJournalDate, todayKey } from "@/lib/journals";

export default function Home() {
  const today = todayKey();
  return <AppFrame><div className="mx-auto max-w-6xl">
    <AnimatedContent><section className="relative overflow-hidden rounded-xl border border-[#d6e3d9] bg-[#eaf3ed] px-5 py-6 md:px-8 md:py-8">
      <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full border-[18px] border-white/35" />
      <div className="relative flex flex-wrap items-end justify-between gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="max-w-xl"><p className="text-sm font-medium text-[#4b725c]">{formatJournalDate(today)}</p><h1 className="mt-2 text-3xl font-semibold leading-tight text-[#173d2a] md:text-[2.5rem]">把今天，认真地留给自己</h1><p className="mt-3 text-sm leading-6 text-[#527060]">先安排最重要的一件事，再用记录看见每一点真实的进步。</p>
        <div className="flex flex-wrap gap-2"><Button size="lg" render={<Link href={`/journals/${today}`} />}><PenLine data-icon="inline-start" />写今日日记</Button><Button size="lg" variant="outline" className="border-[#bbd0c0] bg-white/70" render={<Link href="/plan" />}><CheckCircle2 data-icon="inline-start" />今日安排</Button></div>
        </div><MaskedHeroImage className="hidden w-full max-w-[19rem] justify-self-end lg:block" />
      </div>
    </section></AnimatedContent>
    <AnimatedContent delay={0.05}><DashboardInsights /></AnimatedContent>
    <AnimatedContent delay={0.1}><HomeRecords /></AnimatedContent>
    <TodayEvents />
    <HabitProgress />
    <WeeklyInsights />
    <AnimatedContent delay={0.05}><section className="mt-6 grid gap-3 md:grid-cols-3"><QuickLink href="/calendar" icon={<CalendarDays size={19} strokeWidth={1.8} />} title="按日期回顾" description="查看每一天的记录、安排与重要日子。" /><QuickLink href="/journals" icon={<Flame size={19} strokeWidth={1.8} />} title="全部日记" description="浏览和继续编辑往日的文字与图片。" /><QuickLink href="/settings#reminders" icon={<Bell size={19} strokeWidth={1.8} />} title="每日提醒" description="设置浏览器与飞书的复盘提醒时间。" /></section></AnimatedContent>
  </div></AppFrame>;
}

function QuickLink({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return <Link href={href} className="group"><Card className="h-full border border-[#dce6de] shadow-none transition-all hover:-translate-y-0.5 hover:border-[#a6c2ae] hover:shadow-[0_8px_20px_rgba(35,75,51,0.08)]"><CardHeader><div className="flex items-center justify-between"><span className="text-primary">{icon}</span><ArrowRight size={17} className="text-[#8aa293] transition-transform group-hover:translate-x-0.5" /></div><CardTitle className="mt-3">{title}</CardTitle><CardDescription className="leading-6">{description}</CardDescription></CardHeader></Card></Link>;
}
