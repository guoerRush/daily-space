import { FitnessModule } from "@/components/fitness-module";
import { AppFrame } from "@/components/app-frame";
import { todayKey } from "@/lib/journals";

export const dynamic = "force-dynamic";

export default function FitnessPage() {
  return (
    <AppFrame>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">三天训练、一天休息，按日期自动切换</p>
          <h1 className="mt-1 text-2xl font-semibold md:text-3xl">健身计划</h1>
        </div>
        <FitnessModule initialDate={todayKey()} />
      </div>
    </AppFrame>
  );
}
