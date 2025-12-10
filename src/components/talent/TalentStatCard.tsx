import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TalentStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  subValue?: string;
  colorClass?: string;
}

export function TalentStatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  subValue,
  colorClass = "text-primary"
}: TalentStatCardProps) {
  return (
    <div className="glass-card-hover p-6">
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
        <div className={cn("p-3 rounded-lg bg-secondary", colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
