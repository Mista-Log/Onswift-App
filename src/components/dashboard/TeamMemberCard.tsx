import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TeamMemberCardProps {
  name: string;
  role: string;
  avatar: string;
  className?: string;
  onClick?: () => void;
}

export function TeamMemberCard({
  name,
  role,
  avatar,
  className,
  onClick,
}: TeamMemberCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all duration-200 hover:bg-secondary/50",
        className
      )}
    >
      <Avatar className="h-10 w-10 border border-border/50">
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="bg-primary/20 text-primary">
          {name.charAt(0)}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col">
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-sm text-muted-foreground">{role}</span>
      </div>
    </div>
  );
}
