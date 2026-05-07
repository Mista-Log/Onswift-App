import { useState, useRef, useEffect } from "react";
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
import type { Deliverable } from "@/components/team/DeliverableCard";


export interface DeliverableFormData {
  projectId: string;
  taskId: string;
  title: string;
  description: string;
  urls: string[];
  mentionedUserIds: string[];
}

interface UploadDeliverableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DeliverableFormData) => void;
  // Optional: parent can pass deliverables to derive revision tasks (recommended)
  revisionDeliverables?: Deliverable[];
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
  revisionDeliverables,
}: UploadDeliverableModalProps) {
  const { projects } = useProjects();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build revision tasks list. We'll fetch from the API on open, with fallbacks.
  type MinimalTask = { id: string; project: string; name: string; status?: string };
  const [revisionTasks, setRevisionTasks] = useState<MinimalTask[]>([]);

  // Merge myTasks and revisionTasks, avoiding duplicates
  const allTasks = [
    ...myTasks,
    ...revisionTasks.filter((rt) => !myTasks.some((mt) => mt.id === rt.id)),
  ];

  // Fetch my tasks when modal opens
  useEffect(() => {
    if (open) {
      fetchMyTasks();
      fetchRevisionDeliverables();
    }
  }, [open]);

  const fetchRevisionDeliverables = async () => {
    try {
      setIsLoadingTasks(true);
      const response = await secureFetch('/api/v2/deliverables/');
      if (response.ok) {
        const data = await response.json();
        const revs = data
          .filter((d: any) => d.status === 'revision')
          .map((d: any) => ({
            id: d.task || d.taskId || d.task_id,
            name: d.task_name || d.taskName,
            project: d.project_id || d.projectId,
            status: 'revision',
          }));
        setRevisionTasks(revs);
        return;
      }
    } catch (error) {
      console.error('Error fetching deliverables for revisions:', error);
    } finally {
      setIsLoadingTasks(false);
    }

    // Fallback: use prop if provided, else localStorage
    if (revisionDeliverables && Array.isArray(revisionDeliverables)) {
      const revs = revisionDeliverables
        .filter((d) => d.status === 'revision')
        .map((d) => ({ id: d.taskId, name: d.taskName, project: d.projectId, status: 'revision' }));
      setRevisionTasks(revs);
      return;
    }

    try {
      const deliverables = JSON.parse(localStorage.getItem('deliverables') || '[]');
      const revs = deliverables
        .filter((d: any) => d.status === 'revision')
        .map((d: any) => ({ id: d.taskId, name: d.taskName, project: d.projectId, status: 'revision' }));
      setRevisionTasks(revs);
    } catch {}
  };

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

  // URL Attachments
  const handleAddUrl = () => {
    if (!newUrl.trim()) return;
    setUrls((prev) => [...prev, newUrl.trim()]);
    setNewUrl("");
  };
  const removeUrl = (index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!taskId || !title) {
      toast.error("Please fill in all required fields");
      return;
    }


    // Find the selected task from allTasks (not just myTasks)
    const selectedTask = allTasks.find(t => t.id === taskId);
    const projectId = selectedTask?.project || "";

    onSubmit({
      projectId,
      taskId,
      title,
      description,
      urls,
      mentionedUserIds: [],
    });


    // If this was a revision task, update localStorage to remove it (simulate completion)
    try {
      const deliverables = JSON.parse(localStorage.getItem("deliverables") || "[]");
      const updated = deliverables.filter((d: any) => d.taskId !== taskId);
      localStorage.setItem("deliverables", JSON.stringify(updated));
    } catch {}

    // Reset form
    setTaskId("");
    setTitle("");
    setDescription("");
    setUrls([]);
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
            ) : allTasks.length > 0 ? (
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a task" />
                </SelectTrigger>
                <SelectContent>
                  {allTasks.map((task) => (
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

          {/* URL Attachments */}
          <div className="space-y-2">
            <Label>Attachment URLs</Label>
            <div className="flex gap-2">
              <Input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="Paste a link (e.g. Google Drive, Dropbox, etc.)"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
              />
              <Button type="button" onClick={handleAddUrl} disabled={!newUrl.trim()}>
                Add
              </Button>
            </div>
            {urls.length > 0 && (
              <div className="mt-3 space-y-2">
                {urls.map((url, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate max-w-xs">
                      {url}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUrl(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!taskId || !title}>
              Submit Deliverable
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
