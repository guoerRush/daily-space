"use client";

import Link from "next/link";
import { CheckCircle2, PenLine } from "lucide-react";
import { TodayEventLabel } from "@/components/today-events";
import { Button } from "@/components/ui/button";
import { useTodayKey } from "@/hooks/use-today-key";
import { formatJournalDate } from "@/lib/journals";

export function HomeTodayDate({ initialDate }: { initialDate: string }) {
  const today = useTodayKey(initialDate);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm font-semibold text-primary">
        {formatJournalDate(today)}
      </p>
      <TodayEventLabel />
    </div>
  );
}

export function HomeTodayActions({ initialDate }: { initialDate: string }) {
  const today = useTodayKey(initialDate);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button size="lg" render={<Link href={`/journals/${today}`} />}>
        <PenLine data-icon="inline-start" />
        写今日日记
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="bg-card/75"
        render={<Link href="/plan" />}
      >
        <CheckCircle2 data-icon="inline-start" />
        今日安排
      </Button>
    </div>
  );
}
