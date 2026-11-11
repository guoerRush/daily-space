import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Bell, CalendarDays, Flame } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { AnimatedContent } from "@/components/animated-content";
import { DashboardInsights } from "@/components/dashboard-insights";
import { DailyHeroMessage } from "@/components/daily-hero-message";
import { DailyPersonStory } from "@/components/daily-person-story";
import { HomeTodayActions, HomeTodayDate } from "@/components/home-today-actions";
import { HomeRecords } from "@/components/home-records";
import { HabitProgress } from "@/components/habit-progress";
import { DailyCultureCard } from "@/components/daily-culture-card";
import { FitnessModule } from "@/components/fitness-module";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { todayKey } from "@/lib/journals";

// The dashboard includes the current day, so it must be rendered per request
// instead of being frozen into the static build at deployment time.
export const dynamic = "force-dynamic";

export default function Home() {
  const today = todayKey();

  return (
    <AppFrame>
      <div className="mx-auto max-w-6xl">
        <AnimatedContent>
          <section className="healing-hero relative overflow-hidden rounded-lg border px-5 py-6 md:px-8 md:py-8">
            <div className="relative flex flex-wrap items-end justify-between gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="max-w-xl">
                <DailyPersonStory initialDate={today} />
                <HomeTodayDate initialDate={today} />
                <DailyHeroMessage />
                <HomeTodayActions initialDate={today} />
              </div>
              <DailyCultureCard initialDate={today} />
            </div>
          </section>
        </AnimatedContent>
        <AnimatedContent delay={0.05}><DashboardInsights /></AnimatedContent>
        <FitnessModule initialDate={today} />
        <AnimatedContent delay={0.1}><HomeRecords /></AnimatedContent>
        <HabitProgress />
        <AnimatedContent delay={0.05}>
          <section className="hidden">
            <QuickLink href="/calendar" icon={<CalendarDays size={19} strokeWidth={1.8} />} title="按日期回顾" description="查看每一天的记录、安排与重要日子。" />
            <QuickLink href="/journals" icon={<Flame size={19} strokeWidth={1.8} />} title="全部日记" description="浏览和继续编辑往日的文字与图片。" />
            <QuickLink href="/settings#reminders" icon={<Bell size={19} strokeWidth={1.8} />} title="每日提醒" description="设置浏览器与飞书的复盘提醒时间。" />
          </section>
        </AnimatedContent>
      </div>
    </AppFrame>
  );
}

function QuickLink({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="group">
      <Card className="h-full border border-[#dce6de] shadow-none transition-all hover:-translate-y-0.5 hover:border-[#a6c2ae] hover:shadow-[0_8px_20px_rgba(35,75,51,0.08)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-primary">{icon}</span>
            <ArrowRight size={17} className="text-[#8aa293] transition-transform group-hover:translate-x-0.5" />
          </div>
          <CardTitle className="mt-3">{title}</CardTitle>
          <CardDescription className="leading-6">{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
