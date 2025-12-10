import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface FreelancerCardProps {
  id: string;
  name: string;
  role: string;
  avatar: string;
  skills: string[];
  bio: string;
  portfolioUrl?: string;
  className?: string;
  onHire?: () => void;
  onClick?: () => void;
}

export function FreelancerCard({
  name,
  role,
  avatar,
  skills,
  bio,
  portfolioUrl,
  className,
  onHire,
  onClick,
}: FreelancerCardProps) {
  return (
    <div
      className={cn(
        "glass-card-hover flex flex-col p-6 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-14 w-14 border-2 border-primary/30">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback className="bg-primary/20 text-primary text-lg">
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{name}</h3>
          <p className="text-sm text-primary">{role}</p>
        </div>
      </div>

      {/* Skills */}
      <div className="mt-4 flex flex-wrap gap-2">
        {skills.slice(0, 3).map((skill) => (
          <Badge
            key={skill}
            variant="secondary"
            className="border-border/50 bg-secondary/50 text-muted-foreground"
          >
            {skill}
          </Badge>
        ))}
      </div>

      {/* Bio */}
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{bio}</p>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        {portfolioUrl && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => window.open(portfolioUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
            Portfolio
          </Button>
        )}
        <Button
          variant="glow"
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
            onHire?.();
          }}
        >
          Hire
        </Button>
      </div>
    </div>
  );
}
