import { useState, useRef, useCallback } from "react";
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
import { Upload, X, FileText, Image, Video, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

// Mock data
const projects = [
  { id: "1", name: "Brand Collaboration" },
  { id: "2", name: "Content Series" },
  { id: "3", name: "Product Launch" },
];

const tasksByProject: Record<string, { id: string; name: string }[]> = {
  "1": [
    { id: "t1", name: "Design mockups" },
    { id: "t2", name: "Logo concepts" },
  ],
  "2": [
    { id: "t3", name: "Video editing" },
    { id: "t4", name: "Thumbnail designs" },
  ],
  "3": [
    { id: "t5", name: "Social media assets" },
    { id: "t6", name: "Promo video" },
  ],
};

const teamMembers = [
  { id: "1", name: "Alia Vance" },
  { id: "2", name: "Ben Carter" },
  { id: "3", name: "Clara Dane" },
];

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
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDescription(value);

    // Check for @ mentions
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
    const lastAtIndex = description.lastIndexOf("@");
    const newDescription = description.slice(0, lastAtIndex) + `@${name} `;
    setDescription(newDescription);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(mentionFilter)
  );

  const handleSubmit = () => {
    if (!projectId || !taskId || !title) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Extract mentioned user IDs from description
    const mentionedUserIds = teamMembers
      .filter((m) => description.includes(`@${m.name}`))
      .map((m) => m.id);

    onSubmit({
      projectId,
      taskId,
      title,
      description,
      files,
      mentionedUserIds,
    });

    // Reset form
    setProjectId("");
    setTaskId("");
    setTitle("");
    setDescription("");
    setFiles([]);
    onOpenChange(false);
    toast.success("Deliverable submitted successfully!");
  };

  const tasks = projectId ? tasksByProject[projectId] || [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Deliverable</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setTaskId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Task *</Label>
              <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Description with @mention */}
          <div className="relative space-y-2">
            <Label>Description / Notes</Label>
            <Textarea
              ref={textareaRef}
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Add notes or tag team members using @"
              rows={3}
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
            <Button onClick={handleSubmit}>Submit Deliverable</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
