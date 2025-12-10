import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { Link } from "react-router-dom";

interface ProfileCompletionBannerProps {
  completionPercentage: number;
}

export function ProfileCompletionBanner({ completionPercentage }: ProfileCompletionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || completionPercentage >= 100) return null;

  return (
    <div className="relative p-5 rounded-xl border border-primary/50 bg-gradient-to-r from-secondary to-transparent">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-primary/20">
          <Info className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1">
          <p className="font-medium text-foreground mb-2">
            Complete your profile to increase your chances of getting hired!
          </p>
          
          <div className="flex items-center gap-3 mb-3">
            <Progress value={completionPercentage} className="h-2 flex-1" />
            <span className="text-sm font-medium text-primary">{completionPercentage}%</span>
          </div>
          
          <Button variant="outline" size="sm" asChild>
            <Link to="/profile/edit">Complete Profile</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
