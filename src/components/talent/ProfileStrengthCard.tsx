import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileTip {
  text: string;
  completed: boolean;
  action?: string;
}

interface ProfileStrengthCardProps {
  percentage: number;
  tips: ProfileTip[];
}

export function ProfileStrengthCard({ percentage, tips }: ProfileStrengthCardProps) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold text-foreground mb-4">Profile Strength</h3>
      
      <div className="flex justify-center mb-6">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="hsl(var(--primary))"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-foreground">{percentage}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Boost your profile:</p>
        {tips.map((tip, index) => (
          <div key={index} className="flex items-center gap-2">
            {tip.completed ? (
              <Check className="h-4 w-4 text-success flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className={cn(
              "text-sm",
              tip.completed ? "text-foreground" : "text-muted-foreground"
            )}>
              {tip.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
