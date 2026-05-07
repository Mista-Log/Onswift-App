import { useState, useRef, useEffect } from "react";
import { useTeam } from "@/contexts/TeamContext";
// import { useMessaging } from "@/contexts/MessagingContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileText, Image, Video, File, Send, Check, RotateCcw } from "lucide-react";
import { Deliverable, DeliverableFile } from "./DeliverableCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: string;
}

interface DeliverableDetailModalProps {
  deliverable: Deliverable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreator?: boolean;
  onApprove?: (deliverableId: string) => void;
  onRequestRevision?: (deliverableId: string, feedback: string) => void;
}

// Mock comments
// Use real team members from TeamContext

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

async function downloadFile(file: DeliverableFile) {
  try {
    const response = await fetch(file.url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(`Downloaded ${file.name}`);
  } catch (error) {
    toast.error(`Failed to download ${file.name}`);
    console.error('Download error:', error);
  }
}

async function downloadAllFiles(files: DeliverableFile[]) {
  toast.info(`Downloading ${files.length} files...`);
  for (const file of files) {
    await downloadFile(file);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  toast.success('All files downloaded!');
}

export function DeliverableDetailModal({
  deliverable,
  open,
  onOpenChange,
  isCreator = true,
  onApprove,
  onRequestRevision,
}: DeliverableDetailModalProps) {
  const { teamMembers } = useTeam();
  // const { fetchComments, sendComment } = useMessaging();
  const [comments, setComments] = useState<Comment[]>([]);
  // Local-only comments for now
  useEffect(() => {
    if (deliverable && open) {
      setComments([]); // Reset comments when modal opens
    }
  }, [deliverable, open]);
  const [newComment, setNewComment] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!deliverable) return null;

  const canRequestRevision = deliverable.revisionCount < 3;

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(textAfterAt.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const lastAtIndex = newComment.lastIndexOf("@");
    const updated = newComment.slice(0, lastAtIndex) + `@${name} `;
    setNewComment(updated);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(mentionFilter)
  );

  const handleSendComment = () => {
    if (!newComment.trim() || !deliverable) return;
    const comment: Comment = {
      id: crypto.randomUUID(),
      userId: "current-user",
      userName: "You",
      userAvatar: "",
      content: newComment,
      timestamp: new Date().toLocaleTimeString(),
    };
    setComments((prev) => [...prev, comment]);
    setNewComment("");
    toast.success("Comment added");
  };

  const handleApprove = () => {
    if (onApprove && deliverable) {
      onApprove(deliverable.id);
    } else {
      toast.success("Deliverable approved!");
      onOpenChange(false);
    }
  };

  const handleRequestRevision = () => {
    if (!revisionFeedback.trim()) {
      toast.error("Please provide revision feedback");
      return;
    }
    if (onRequestRevision && deliverable) {
      onRequestRevision(deliverable.id, revisionFeedback);
    } else {
      toast.success("Revision requested");
      onOpenChange(false);
    }
    setShowRevisionInput(false);
    setRevisionFeedback("");
  };

  function formatDateTime(dateString: string): import("react").ReactNode {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {deliverable.projectName} / {deliverable.taskName}
              </p>
              <DialogTitle>{deliverable.title}</DialogTitle>
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
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Submitted By */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={deliverable.submittedBy.avatar} />
              <AvatarFallback>{deliverable.submittedBy.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{deliverable.submittedBy.name}</p>
              <p className="text-xs text-muted-foreground">
                Submitted {formatDateTime(deliverable.submittedAt)}
              </p>
            </div>
          </div>

          {/* Description */}
          {deliverable.description && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">
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
            </div>
          )}

          {/* Files */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">
                Attachments ({deliverable.files.length})
              </h4>
              {deliverable.files.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAllFiles(deliverable.files)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {deliverable.files.map((file, index) => {
                const FileIcon = getFileIcon(file.type);
                const isImage = file.type.startsWith("image/");
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3"
                  >
                    {isImage ? (
                      <div className="h-12 w-12 rounded-lg bg-secondary overflow-hidden">
                        <img
                          src={file.url}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadFile(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Discussion</h4>
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.userAvatar} />
                    <AvatarFallback className="text-xs">
                      {comment.userName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {comment.userName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {comment.timestamp}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-1">
                      {comment.content.split(/(@\w+)/g).map((part, i) =>
                        part.startsWith("@") ? (
                          <span key={i} className="text-primary font-medium">
                            {part}
                          </span>
                        ) : (
                          part
                        )
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* New Comment */}
            <div className="relative mt-4">
              <Textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => handleCommentChange(e.target.value)}
                placeholder="Add a comment... Use @ to mention"
                rows={2}
              />
              {showMentions && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg z-50">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => insertMention(member.name)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-primary/20"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/30 flex items-center justify-center text-xs">
                        {member.name.charAt(0)}
                      </div>
                      {member.name}
                    </button>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                className="absolute right-2 bottom-2"
                onClick={handleSendComment}
                disabled={!newComment.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Revision Counter */}
          <div className="rounded-lg bg-secondary/50 p-3 text-sm">
            Revisions: <span className="font-medium">{deliverable.revisionCount} of 3</span>
            {deliverable.revisionCount >= 3 && (
              <span className="ml-2 text-warning">(Maximum reached)</span>
            )}
          </div>

          {/* Revision Feedback Input */}
          {showRevisionInput && (
            <div className="space-y-3">
              <Textarea
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Describe what changes are needed..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowRevisionInput(false)}>
                  Cancel
                </Button>
                <Button variant="warning" onClick={handleRequestRevision}>
                  Submit Revision Request
                </Button>
              </div>
            </div>
          )}
                  {deliverable.feedback && (
                    <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning mt-4">
                      <strong>Revision Feedback:</strong> {deliverable.feedback}
                    </div>
                  )}
        </div>

        {/* Actions (Creator only) */}
        {isCreator && deliverable.status === "pending" && !showRevisionInput && (
          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button
              variant="warning"
              onClick={() => setShowRevisionInput(true)}
              disabled={!canRequestRevision}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Request Revision
            </Button>
            <Button variant="success" onClick={handleApprove}>
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
