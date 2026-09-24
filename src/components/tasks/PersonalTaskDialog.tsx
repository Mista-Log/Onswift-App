import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { secureFetch } from "@/api/apiClient";

export interface PersonalTask {
  id: string;
  name: string;
  description?: string | null;
  status: "planning" | "in-progress" | "completed";
  deadline?: string | null;
  linked_projects: { id: string; name: string }[];
  is_personal: true;
}

interface PersonalTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: PersonalTask | null;
  linkableProjects: { id: string; name: string }[];
  onSaved: (task: PersonalTask) => void;
  onDeleted: (id: string) => void;
}

export function PersonalTaskDialog({
  open,
  onOpenChange,
  task,
  linkableProjects,
  onSaved,
  onDeleted,
}: PersonalTaskDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(task?.name ?? "");
    setDescription(task?.description ?? "");
    setDeadline(task?.deadline ?? "");
    setProjectIds(task?.linked_projects.map((p) => p.id) ?? []);
  }, [open, task]);

  const toggleProject = (id: string) =>
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await secureFetch(
        task ? `/api/v2/personal-tasks/${task.id}/` : "/api/v2/personal-tasks/",
        {
          method: task ? "PATCH" : "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            deadline: deadline || null,
            linked_project_ids: projectIds,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.detail || "Couldn't save the task. Please try again.");
        return;
      }
      onSaved(data as PersonalTask);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save the task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!task || saving) return;
    setSaving(true);
    try {
      const res = await secureFetch(`/api/v2/personal-tasks/${task.id}/`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Couldn't delete the task. Please try again.");
        return;
      }
      onDeleted(task.id);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't delete the task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit personal task" : "Add a task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="personal-task-name">Task</Label>
            <Input
              id="personal-task-name"
              autoFocus
              value={name}
              placeholder="What do you need to get done?"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personal-task-description">Notes (optional)</Label>
            <Textarea
              id="personal-task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="personal-task-deadline">Due date (optional)</Label>
            <Input
              id="personal-task-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {linkableProjects.length > 0 && (
            <div className="space-y-1.5">
              <Label>Link to projects (optional)</Label>
              <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                {linkableProjects.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={projectIds.includes(p.id)}
                      onCheckedChange={() => toggleProject(p.id)}
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {task ? (
            <Button variant="ghost" className="text-destructive" onClick={remove} disabled={saving}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {task ? "Save" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
