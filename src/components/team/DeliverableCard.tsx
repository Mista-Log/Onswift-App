import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, Download, Image, Video, File, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeliverableFile {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface Deliverable {
  id: string;
  title: string;
  description: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  submittedBy: {
    id: string;
    name: string;
    avatar: string;
  };
  files: DeliverableFile[];
  status: "pending" | "approved" | "revision";
  revisionCount: number;
  submittedAt: string;
}

interface DeliverableCardProps {
  deliverable: Deliverable;
  onClick?: () => void;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("video/")) return Video;
  if (type.includes("pdf") || type.includes("document")) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DeliverableCard({ deliverable, onClick }: DeliverableCardProps) {
  return (
    <div
      onClick={onClick}
      className="glass-card cursor-pointer p-4 transition-all hover:shadow-glow"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            {deliverable.projectName} / {deliverable.taskName}
          </p>
          <h3 className="mt-1 font-semibold text-foreground">{deliverable.title}</h3>
        </div>
        <StatusBadge
          status={
            deliverable.status === "approved"
              ? "approved"
              : deliverable.status === "revision"
              ? "revision"
              : "pending"
          }
        />
      </div>

      {/* Description with mentions highlighted */}
      {deliverable.description && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {deliverable.description.split(/(@\w+)/g).map((part, i) =>
            part.startsWith("@") ? (
              <span key={i} className="text-primary font-medium">
                {part}
              </span>
            ) : (
              part
            )
          )}
        </p>
      )}

      {/* Files Preview */}
      {deliverable.files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {deliverable.files.slice(0, 3).map((file, index) => {
            const FileIcon = getFileIcon(file.type);
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1"
              >
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                <span className="max-w-[100px] truncate text-xs text-foreground">
                  {file.name}
                </span>
              </div>
            );
          })}
          {deliverable.files.length > 3 && (
            <div className="flex items-center rounded-lg bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">
              +{deliverable.files.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={deliverable.submittedBy.avatar} />
            <AvatarFallback className="text-xs">
              {deliverable.submittedBy.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            {deliverable.submittedBy.name}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{deliverable.submittedAt}</span>
      </div>

      {/* Revision Counter */}
      {deliverable.revisionCount > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          Revision {deliverable.revisionCount} of 3
        </div>
      )}
    </div>
  );
}
