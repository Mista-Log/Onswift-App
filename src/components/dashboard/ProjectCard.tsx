import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
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
import { MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
}

interface ProjectCardProps {
  id?: string;
  name: string;
  dueDate: string;
  status: "in-progress" | "planning" | "completed";
  teamMembers: TeamMember[];
  className?: string;
  onClick?: () => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export function ProjectCard({
  id,
  name,
  dueDate,
  status,
  teamMembers,
  className,
  onClick,
  onDelete,
  showActions = false,
}: ProjectCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (id && onDelete) {
      onDelete(id);
    }
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div
        onClick={onClick}
        className={cn(
          "glass-card-hover flex flex-wrap cursor-pointer items-center justify-between gap-3 p-4 group sm:flex-nowrap",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-semibold text-foreground truncate">{name}</h3>
          <p className="text-sm text-muted-foreground">
            {status === "completed" ? "Completed:" : "Due:"} {dueDate}
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
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

          {showActions && id && onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{name}"? This action cannot be undone and will remove all tasks and deliverables associated with this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
