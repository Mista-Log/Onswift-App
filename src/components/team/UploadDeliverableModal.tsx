import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, FileText, Image, Video, File, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { secureFetch } from "@/api/apiClient";
import { useProjects, type Task } from "@/contexts/ProjectContext";

interface UploadDeliverableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DeliverableFormData) => void;
}

export interface DeliverableFormData {
  projectId: string;
  taskId: string;
  title: string;
  description: string;
  files: File[];
  mentionedUserIds: string[];
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

export function UploadDeliverableModal({
  open,
  onOpenChange,
  onSubmit,
}: UploadDeliverableModalProps) {
  const { projects } = useProjects();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch my tasks when modal opens
  useEffect(() => {
    if (open) {
      fetchMyTasks();
    }
  }, [open]);

  const fetchMyTasks = async () => {
    try {
      setIsLoadingTasks(true);
      const response = await secureFetch('/api/v2/my-tasks/');
      if (response.ok) {
        const data = await response.json();
        // Only show non-completed tasks
        setMyTasks(data.filter((t: Task) => t.status !== "completed"));
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Unknown Project";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!taskId || !title) {
      toast.error("Please fill in all required fields");
      return;
    }

    const selectedTask = myTasks.find(t => t.id === taskId);
    const projectId = selectedTask?.project || "";

    onSubmit({
      projectId,
      taskId,
      title,
      description,
      files,
      mentionedUserIds: [],
    });

    // Reset form
    setTaskId("");
    setTitle("");
    setDescription("");
    setFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Deliverable</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Task Selection */}
          <div className="space-y-2">
            <Label>Select Task *</Label>
            {isLoadingTasks ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading tasks...</span>
              </div>
            ) : myTasks.length > 0 ? (
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task" />
                </SelectTrigger>
                <SelectContent>
                  {myTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      <div className="flex flex-col items-start">
                        <span>{task.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {getProjectName(task.project)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No active tasks assigned to you.
              </p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Deliverable Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Final Logo Design"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description / Notes</Label>
            <Textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this deliverable..."
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>File Attachments</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all",
                isDragging
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-primary/50 hover:bg-secondary/30"
              )}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-foreground font-medium">
                Drag files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max 50MB per file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => {
                  const FileIcon = getFileIcon(file.type);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!taskId || !title || myTasks.length === 0}>
              Submit Deliverable
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
