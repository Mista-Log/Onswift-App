import { useState, useEffect } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, FileText, Image, Video, File, Check, RotateCcw, Upload, X, Link, Trash2 } from "lucide-react";
import { Deliverable, DeliverableFile } from "./DeliverableCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeliverableDetailModalProps {
  deliverable: Deliverable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreator?: boolean;
  onApprove?: (deliverableId: string) => void;
  onUnapprove?: (deliverableId: string) => void;
  onRequestRevision?: (deliverableId: string, feedback: string) => void;
  onResubmit?: (taskId: string, title: string, description: string, urls: string[]) => void;
  onDelete?: (deliverableId: string) => void;
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
  onUnapprove,
  onRequestRevision,
  onResubmit,
  onDelete,
}: DeliverableDetailModalProps) {
  useEffect(() => {
    if (deliverable && open) {
      setResubmitUrls([]);
      setResubmitNewUrl("");
      setResubmitTitle(deliverable.title);
      setResubmitDescription("");
    }
  }, [deliverable, open]);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [resubmitUrls, setResubmitUrls] = useState<string[]>([]);
  const [resubmitNewUrl, setResubmitNewUrl] = useState("");
  const [resubmitTitle, setResubmitTitle] = useState("");
  const [resubmitDescription, setResubmitDescription] = useState("");

  if (!deliverable) return null;

  const canRequestRevision = deliverable.status !== "approved";

  const handleApprove = () => {
    if (onApprove && deliverable) {
      onApprove(deliverable.id);
    } else {
      toast.success("Attachment approved!");
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

          {/* Files & Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">
                Attachments ({deliverable.files.length + (deliverable.urls?.length ?? 0)})
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
            {/* File attachments */}
            {deliverable.files.length > 0 && (
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
            )}

            {/* URL attachments */}
            {deliverable.urls && deliverable.urls.length > 0 && (
              <div className="mt-3 space-y-2">
                {deliverable.urls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-primary underline-offset-2 hover:underline"
                  >
                    <Link className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Empty state */}
            {deliverable.files.length === 0 && (!deliverable.urls || deliverable.urls.length === 0) && (
              <p className="text-sm text-muted-foreground py-2">No attachments</p>
            )}
          </div>

          {/* Revision Counter */}
          {deliverable.revisionCount > 0 && (
            <div className="rounded-lg bg-secondary/50 p-3 text-sm">
              Revisions requested: <span className="font-medium">{deliverable.revisionCount}</span>
            </div>
          )}

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
          {/* Creator revision feedback — high contrast */}
          {deliverable.feedback && (
            <div className="rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950 p-4 text-sm">
              <p className="mb-1 font-semibold text-orange-800 dark:text-orange-200">Revision Feedback</p>
              <p className="text-orange-900 dark:text-orange-100 leading-relaxed">{deliverable.feedback}</p>
            </div>
          )}

          {/* Talent: revision resubmission form */}
          {!isCreator && deliverable.status === "revision" && onResubmit && (
            <div className="space-y-3 rounded-lg border border-border/50 p-4">
              <p className="text-sm font-semibold text-foreground">Your Revision</p>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input
                  type="text"
                  value={resubmitTitle}
                  onChange={(e) => setResubmitTitle(e.target.value)}
                  placeholder="Revision title…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                <Textarea
                  value={resubmitDescription}
                  onChange={(e) => setResubmitDescription(e.target.value)}
                  placeholder="Describe what you changed…"
                  rows={2}
                />
              </div>

              {/* URLs */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Attach URLs</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="url"
                      value={resubmitNewUrl}
                      onChange={(e) => setResubmitNewUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && resubmitNewUrl.trim()) {
                          e.preventDefault();
                          setResubmitUrls((prev) => [...prev, resubmitNewUrl.trim()]);
                          setResubmitNewUrl("");
                        }
                      }}
                      placeholder="https://drive.google.com/…"
                      className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!resubmitNewUrl.trim()}
                    onClick={() => {
                      if (resubmitNewUrl.trim()) {
                        setResubmitUrls((prev) => [...prev, resubmitNewUrl.trim()]);
                        setResubmitNewUrl("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {resubmitUrls.length > 0 && (
                  <div className="space-y-1.5 mt-1">
                    {resubmitUrls.map((url, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-primary underline-offset-2 hover:underline max-w-xs">
                          {url}
                        </a>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setResubmitUrls((prev) => prev.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Talent resubmit CTA */}
        {!isCreator && deliverable.status === "revision" && onResubmit && (
          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button
              disabled={!resubmitTitle.trim()}
              onClick={() => onResubmit(deliverable.taskId, resubmitTitle.trim(), resubmitDescription.trim(), resubmitUrls)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Submit Revision
            </Button>
          </div>
        )}

        {/* Actions (Creator only) — pending/revision state */}
        {isCreator && deliverable.status !== "approved" && !showRevisionInput && (
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

        {/* Unapprove (Creator only) — approved state */}
        {isCreator && deliverable.status === "approved" && onUnapprove && (
          <div className="flex justify-end pt-4 border-t border-border/50">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 text-muted-foreground hover:text-foreground">
                  <RotateCcw className="h-4 w-4" />
                  Unapprove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unapprove this attachment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{deliverable.title}" will be set back to pending review and the associated task will reopen. The talent will be notified.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onUnapprove(deliverable.id)}>
                    Yes, Unapprove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Delete */}
        {onDelete && (
          <div className="flex justify-start pt-3 border-t border-border/50">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Attachment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this attachment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove "{deliverable.title}" and all its attachments. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onDelete(deliverable.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
