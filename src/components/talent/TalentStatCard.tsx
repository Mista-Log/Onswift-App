import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Same fills as the project task cards (ProjectDetail / PersonalTaskCard): light = pastel with a
 * matching border, dark = solid deep tint, so text contrast stays predictable in both themes.
 * Purple has no task-card twin; it follows the same recipe.
 */
const TONES = {
  purple: {
    card: "!bg-purple-200 border border-purple-500 dark:!bg-[hsl(270_40%_13%)]  dark:[--muted-foreground:0_0%_78%]",
    // icon: "bg-white/60 text-purple-700 dark:bg-white/10 dark:text-purple-300",
  },
  yellow: {
    card: "!bg-yellow-100 border border-yellow-400 dark:!bg-[hsl(45_45%_12%)]  dark:[--muted-foreground:0_0%_78%]",
    // icon: "bg-white/60 text-yellow-700 dark:bg-white/10 dark:text-yellow-300",
  },
  green: {
    card: "!bg-green-100 border border-green-400 dark:!bg-[hsl(150_40%_11%)]  dark:[--muted-foreground:0_0%_78%]",
    // icon: "bg-white/60 text-green-700 dark:bg-white/10 dark:text-green-300",
  },
} as const;

interface TalentStatCardProps {
  title: string;
  value: string | number;
  
  trend?: {
    value: string;
    positive: boolean;
  };
  subValue?: string;
  colorClass?: string;
  /** Tints the whole card like a task card. Without it the card keeps the plain glass look. */
  tone?: keyof typeof TONES;
}

export function TalentStatCard({
  title,
  value,
  
  trend,
  subValue,
  colorClass = "text-primary",
  tone
}: TalentStatCardProps) {
  const t = tone ? TONES[tone] : undefined;
  return (
    <div className={cn("glass-card-hover p-6", t?.card)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs",
              trend.positive ? "text-success" : "text-destructive"
            )}>
              {trend.positive ? "+" : ""}{trend.value}
            </p>
          )}
          {subValue && (
            <p className="text-xs text-muted-foreground">{subValue}</p>
          )}
        </div>
        {/* <div className={cn("p-3 rounded-lg", t ? t.icon : cn("bg-secondary", colorClass))}>
          
        </div> */}
      </div>
    </div>
  );
}
