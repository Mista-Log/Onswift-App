import { StatusBadge } from "./StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
}

interface ProjectCardProps {
  name: string;
  dueDate: string;
  status: "in-progress" | "planning" | "completed";
  teamMembers: TeamMember[];
  className?: string;
  onClick?: () => void;
}

export function ProjectCard({
  name,
  dueDate,
  status,
  teamMembers,
  className,
  onClick,
}: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-card-hover flex cursor-pointer items-center justify-between p-4",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground">
          {status === "completed" ? "Completed:" : "Due:"} {dueDate}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* Team Avatars */}
        <div className="flex -space-x-2">
          {teamMembers.slice(0, 4).map((member) => (
            <Avatar
              key={member.id}
              className="h-8 w-8 border-2 border-card"
            >
              <AvatarImage src={member.avatar} alt={member.name} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                {member.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ))}
          {teamMembers.length > 4 && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-medium text-muted-foreground">
              +{teamMembers.length - 4}
            </div>
          )}
        </div>

        <StatusBadge status={status} />
      </div>
    </div>
  );
}
