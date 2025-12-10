import { cn } from "@/lib/utils";
import { Upload, CheckCircle, MessageSquare, ClipboardList, LucideIcon } from "lucide-react";

type ActivityType = 'upload' | 'approval' | 'message' | 'task';

interface ActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const iconMap: Record<ActivityType, LucideIcon> = {
  upload: Upload,
  approval: CheckCircle,
  message: MessageSquare,
  task: ClipboardList,
};

const colorMap: Record<ActivityType, string> = {
  upload: 'bg-primary/20 text-primary',
  approval: 'bg-success/20 text-success',
  message: 'bg-accent/20 text-accent',
  task: 'bg-warning/20 text-warning',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => {
        const Icon = iconMap[activity.type];
        const colorClass = colorMap[activity.type];
        
        return (
          <div key={activity.id} className="flex gap-3">
            <div className="relative flex flex-col items-center">
              <div className={cn("p-2 rounded-full", colorClass)}>
                <Icon className="h-4 w-4" />
              </div>
              {index < activities.length - 1 && (
                <div className="w-px h-full bg-border absolute top-10" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <p className="text-sm text-foreground">{activity.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
