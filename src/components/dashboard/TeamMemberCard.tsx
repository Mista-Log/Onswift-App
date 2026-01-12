import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, UserMinus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMemberCardProps {
  id?: string;
  name: string;
  role: string;
  avatar: string;
  className?: string;
  onClick?: () => void;
  onRemove?: (id: string) => void;
  onMessage?: (id: string) => void;
  showActions?: boolean;
}

export function TeamMemberCard({
  id,
  name,
  role,
  avatar,
  className,
  onClick,
  onRemove,
  onMessage,
  showActions = false,
}: TeamMemberCardProps) {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRemoveDialog(true);
  };

  const confirmRemove = () => {
    if (id && onRemove) {
      onRemove(id);
    }
    setShowRemoveDialog(false);
  };

  return (
    <>
      <div
        onClick={onClick}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all duration-200 hover:bg-secondary/50 group",
          className
        )}
      >
        <Avatar className="h-10 w-10 border border-border/50">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback className="bg-primary/20 text-primary">
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col flex-1">
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-sm text-muted-foreground">{role}</span>
        </div>

        {showActions && id && (onRemove || onMessage) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMessage && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMessage(id); }}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message
                </DropdownMenuItem>
              )}
              {onRemove && (
                <DropdownMenuItem
                  onClick={handleRemove}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove from team
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {name} from your team? They will no longer have access to your projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
