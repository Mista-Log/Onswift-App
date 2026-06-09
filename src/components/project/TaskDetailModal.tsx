import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus, Paperclip, Send, Trash2, Link as LinkIcon,
  FileText, X, Loader2, ExternalLink, CheckSquare, Tag, Repeat,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useTaskDetail,
  type TaskDetail, type TaskChecklist, type TaskPriority, type RecurrenceType, type TaskDeliverable,
} from "@/hooks/useTaskDetail";

interface Assignee { id: string; name: string }

interface TaskDetailModalProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: (task: TaskDetail) => void;
  onTaskDeleted?: () => void;
  availableAssignees: Assignee[];
  currentUserId: string;
  isCreator: boolean;
}

// ── Config ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  planning:      { label: "Planning",    cls: "bg-orange-100 text-orange-700 border-orange-300" },
  "in-progress": { label: "In Progress", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  completed:     { label: "Completed",   cls: "bg-green-100 text-green-700 border-green-300" },
} as const;

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; badge: string }> = {
  highest: { label: "Highest",  dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-300" },
  high:    { label: "High",     dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-300" },
  medium:  { label: "Medium",   dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  low:     { label: "Low",      dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700 border-blue-300" },
  lowest:  { label: "Lowest",   dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600 border-gray-300" },
  not_sure:{ label: "Not Sure", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700 border-purple-300" },
};

const ADD_MENU_ITEMS = [
  { id: "checklist",  icon: CheckSquare, label: "Checklist",  sub: "Add subtasks" },
  { id: "labels",     icon: Tag,         label: "Labels",     sub: "Organise and prioritise", soon: true },
  { id: "attachment", icon: Paperclip,   label: "Attachment", sub: "Add files or links", soon: true },
];

function formatRelative(iso: string) {
  try {
    const diffMs = Date.now() - parseISO(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return format(parseISO(iso), "MMM d");
  } catch { return ""; }
}

// ── Checklist sub-component ────────────────────────────────────────────────

function ChecklistBlock({
  checklist, taskId, isCreator, currentUserId,
  onToggle, onAddItem, onDeleteItem, onDelete,
}: {
  checklist: TaskChecklist;
  taskId: string;
  isCreator: boolean;
  currentUserId: string;
  onToggle: (checklistId: string, itemId: string, val: boolean) => void;
  onAddItem: (checklistId: string, content: string) => void;
  onDeleteItem: (checklistId: string, itemId: string) => void;
  onDelete: (checklistId: string) => void;
}) {
  const [addingItem, setAddingItem] = useState(false);
  const [itemDraft, setItemDraft] = useState("");
  const [hideChecked, setHideChecked] = useState(false);

  const visibleItems = hideChecked
    ? checklist.items.filter((it) => !it.is_checked)
    : checklist.items;

  const submit = () => {
    if (!itemDraft.trim()) return;
    onAddItem(checklist.id, itemDraft.trim());
    setItemDraft("");
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-foreground shrink-0" />
        <span className="font-semibold text-sm text-foreground flex-1">{checklist.title}</span>
        {checklist.items.some((i) => i.is_checked) && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setHideChecked((v) => !v)}>
            {hideChecked ? "Show checked" : "Hide checked"}
          </Button>
        )}
        {isCreator && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive" onClick={() => onDelete(checklist.id)}>
            Delete
          </Button>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground w-7 shrink-0">{checklist.progress}%</span>
        <Progress value={checklist.progress} className="h-2 flex-1" />
      </div>

      {/* Items */}
      <div className="space-y-2.5 pl-6">
        {visibleItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group/item">
            <Checkbox
              id={item.id}
              checked={item.is_checked}
              onCheckedChange={(v) => onToggle(checklist.id, item.id, Boolean(v))}
            />
            <label
              htmlFor={item.id}
              className={cn("text-sm flex-1 cursor-pointer", item.is_checked && "line-through text-muted-foreground")}
            >
              {item.content}
            </label>
            {isCreator && (
              <button
                onClick={() => onDeleteItem(checklist.id, item.id)}
                className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add item */}
      {isCreator && (
        <div className="pl-6">
          {addingItem ? (
            <div className="space-y-2">
              <Input
                autoFocus
                placeholder="Add an item"
                value={itemDraft}
                onChange={(e) => setItemDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setAddingItem(false); }}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={submit} disabled={!itemDraft.trim()}>Add</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingItem(false); setItemDraft(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground px-2" onClick={() => setAddingItem(true)}>
              + Add an item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function TaskDetailModal({
  taskId, open, onOpenChange, onTaskUpdated, onTaskDeleted,
  availableAssignees, currentUserId, isCreator,
}: TaskDetailModalProps) {
  const {
    task, isLoading, fetchTask, updateTask, deleteTask,
    addComment, deleteComment,
    addAttachment, deleteAttachment,
    createChecklist, deleteChecklist,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    clearTask,
  } = useTaskDetail();

  const [editingTitle, setEditingTitle]     = useState(false);
  const [titleDraft, setTitleDraft]         = useState("");
  const [descDraft, setDescDraft]           = useState("");
  const [commentDraft, setCommentDraft]     = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isAddingLink, setIsAddingLink]     = useState(false);
  const [linkDraft, setLinkDraft]           = useState("");
  const [linkNameDraft, setLinkNameDraft]   = useState("");
  const [isSavingLink, setIsSavingLink]     = useState(false);
  const [recurringDaysDraft, setRecurringDaysDraft] = useState<number>(2);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addMenuOpen, setAddMenuOpen]       = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [showChecklistInput, setShowChecklistInput] = useState(false);
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && taskId) fetchTask(taskId);
    else if (!open) {
      clearTask();
      setEditingTitle(false);
      setCommentDraft("");
      setIsAddingLink(false);
      setShowChecklistInput(false);
      setShowDeleteConfirm(false);
    }
  }, [open, taskId]);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.name);
      setDescDraft(task.description ?? "");
      setRecurringDaysDraft(task.recurrence_days ?? 2);
    }
  }, [task?.id]);

  useEffect(() => {
    if (task?.comments?.length) commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task?.comments?.length]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const saveTitle = async () => {
    if (!task || !titleDraft.trim() || titleDraft === task.name) { setEditingTitle(false); return; }
    try { const u = await updateTask(task.id, { name: titleDraft.trim() }); onTaskUpdated?.(u); }
    catch { toast.error("Failed to update title"); }
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    if (!task || descDraft === (task.description ?? "")) return;
    try { const u = await updateTask(task.id, { description: descDraft }); onTaskUpdated?.(u); }
    catch { toast.error("Failed to update description"); }
  };

  const handleField = async (updates: Partial<Pick<TaskDetail, "status" | "priority" | "deadline" | "task_time" | "recurrence_type" | "recurrence_days" | "assignees">>) => {
    if (!task) return;
    try { const u = await updateTask(task.id, updates); onTaskUpdated?.(u); }
    catch { toast.error("Failed to update task"); }
  };

  const handleSendComment = async () => {
    if (!task || !commentDraft.trim()) return;
    setIsSendingComment(true);
    try { await addComment(task.id, commentDraft.trim()); setCommentDraft(""); }
    catch { toast.error("Failed to post comment"); }
    finally { setIsSendingComment(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const fd = new FormData();
    fd.append("file", file); fd.append("name", file.name);
    try { await addAttachment(task.id, fd); toast.success("File attached"); }
    catch { toast.error("Failed to upload file"); }
    e.target.value = "";
  };

  const handleSaveLink = async () => {
    if (!task || !linkDraft.trim()) return;
    setIsSavingLink(true);
    const fd = new FormData();
    fd.append("url", linkDraft.trim());
    fd.append("name", linkNameDraft.trim() || linkDraft.trim());
    try {
      await addAttachment(task.id, fd);
      toast.success("Link added");
      setLinkDraft(""); setLinkNameDraft(""); setIsAddingLink(false);
    } catch { toast.error("Failed to add link"); }
    finally { setIsSavingLink(false); }
  };

  const handleAddMenuSelect = (id: string) => {
    setAddMenuOpen(false);
    if (id === "checklist") setShowChecklistInput(true);
    else toast.info("Coming soon");
  };

  const handleCreateChecklist = async () => {
    if (!task || !newChecklistTitle.trim()) return;
    setIsCreatingChecklist(true);
    try {
      await createChecklist(task.id, newChecklistTitle.trim());
      setNewChecklistTitle("");
      setShowChecklistInput(false);
      toast.success("Checklist added");
    } catch { toast.error("Failed to create checklist"); }
    finally { setIsCreatingChecklist(false); }
  };

  const handleDeleteConfirmed = async () => {
    if (!task) return;
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      toast.success("Task deleted");
      onOpenChange(false);
      onTaskDeleted?.();
    } catch { toast.error("Failed to delete task"); }
    finally { setIsDeleting(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full p-0 gap-0 overflow-hidden max-h-[92vh]">
        {isLoading || !task ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full max-h-[90vh]">

            {/* ── Left panel ──────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-10 space-y-7 border-b md:border-b-0 md:border-r border-border/50">

              {/* Recurring reminder banner — visible to all roles */}
              {task.recurrence_type && (() => {
                const labels: Record<string, string> = {
                  daily: "every 24 hours",
                  weekly: "every week",
                  monthly: "every month",
                  custom: `every ${task.recurrence_days ?? "?"} days`,
                };
                const nextLabel = task.deadline
                  ? (() => {
                      try {
                        const base = parseISO(task.deadline);
                        const next =
                          task.recurrence_type === "daily"   ? new Date(base.setDate(base.getDate() + 1)) :
                          task.recurrence_type === "weekly"  ? new Date(base.setDate(base.getDate() + 7)) :
                          task.recurrence_type === "monthly" ? new Date(base.setMonth(base.getMonth() + 1)) :
                          new Date(base.setDate(base.getDate() + (task.recurrence_days ?? 1)));
                        return format(next, "MMM d, yyyy");
                      } catch { return null; }
                    })()
                  : null;
                return (
                  <div className="flex items-start gap-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 px-4 py-3">
                    <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        Recurring task resets {labels[task.recurrence_type]}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                        {task.status === "completed"
                          ? "This task has been completed. A new occurrence has been scheduled."
                          : nextLabel
                            ? `When completed, the next occurrence will appear on ${nextLabel}${task.task_time ? ` at ${task.task_time.slice(0, 5)}` : ""}.`
                            : "When completed, the next occurrence will automatically appear in Planning."}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Title */}
              {editingTitle && isCreator ? (
                <Input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(task.name); setEditingTitle(false); } }}
                  className="text-2xl font-bold h-auto py-1 px-2"
                />
              ) : (
                <h2
                  className={cn("text-2xl font-bold text-foreground leading-tight", isCreator && "cursor-pointer hover:text-primary transition-colors")}
                  onClick={() => isCreator && setEditingTitle(true)}
                  title={isCreator ? "Click to edit" : undefined}
                >
                  {task.name}
                </h2>
              )}

              {/* Meta: Assignee + Deadline + Priority */}
              <div className="flex flex-wrap gap-8 text-sm">
                {/* Assignees */}
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Assigned to</p>
                  {isCreator ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 min-w-[11rem] justify-start text-sm font-normal gap-1.5">
                          {task.assignees.length === 0 ? (
                            <span className="text-muted-foreground">Unassigned</span>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {task.assignee_names.map((name, i) => (
                                <span key={i} className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs">{name}</span>
                              ))}
                            </div>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <p className="text-xs text-muted-foreground mb-2 px-1">Select assignees</p>
                        <div className="space-y-1">
                          {availableAssignees.map((a) => {
                            const checked = task.assignees.includes(a.id);
                            const toggle = () => {
                              const next = checked
                                ? task.assignees.filter((id) => id !== a.id)
                                : [...task.assignees, a.id];
                              handleField({ assignees: next });
                            };
                            return (
                              <button
                                key={a.id}
                                onClick={toggle}
                                className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm text-left"
                              >
                                <div className={cn("h-4 w-4 rounded border flex items-center justify-center flex-shrink-0", checked ? "bg-primary border-primary" : "border-border")}>
                                  {checked && <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                {a.id === currentUserId ? "Self" : a.name}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {task.assignees.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      ) : task.assignees.map((id, i) => (
                        <div key={id} className="flex items-center gap-1.5">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={task.assignee_avatars?.[i] ?? undefined} />
                            <AvatarFallback className="text-[10px] bg-primary/15 text-primary">{task.assignee_names[i]?.charAt(0) ?? "?"}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{task.assignee_names[i]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deadline + Time */}
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Due date</p>
                  {isCreator ? (
                    <DateTimePicker
                      date={task.deadline ? parseISO(task.deadline) : undefined}
                      time={task.task_time ? task.task_time.slice(0, 5) : "09:00"}
                      onDateChange={(d) => handleField({ deadline: d ? format(d, "yyyy-MM-dd") : null })}
                      onTimeChange={(t) => handleField({ task_time: t })}
                      placeholder="Set date & time"
                      className="h-8 text-sm font-normal"
                    />
                  ) : (
                    <span className="text-sm">
                      {task.deadline ? format(parseISO(task.deadline), "MMM d, yyyy") : "—"}
                      {task.task_time && <span className="text-muted-foreground ml-1.5">· {task.task_time.slice(0, 5)}</span>}
                    </span>
                  )}
                </div>

                {/* Priority */}
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Priority</p>
                  {isCreator ? (
                    <Select value={task.priority ?? "none"} onValueChange={(v) => handleField({ priority: v === "none" ? null : v as TaskPriority })}>
                      <SelectTrigger className="h-8 w-36 text-sm">
                        <SelectValue placeholder="Set priority">
                          {task.priority ? (
                            <div className="flex items-center gap-1.5">
                              <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_CONFIG[task.priority].dot)} />
                              {PRIORITY_CONFIG[task.priority].label}
                            </div>
                          ) : "Set priority"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">No priority</span>
                        </SelectItem>
                        {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG[TaskPriority]][]).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
                              {cfg.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : task.priority ? (
                    <Badge variant="outline" className={cn("text-xs font-medium rounded-full px-2.5", PRIORITY_CONFIG[task.priority].badge)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5 inline-block", PRIORITY_CONFIG[task.priority].dot)} />
                      {PRIORITY_CONFIG[task.priority].label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Description</p>
                {isCreator ? (
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onBlur={saveDesc}
                    placeholder="Add a more detailed description..."
                    className="min-h-[120px] resize-none text-sm scrollbar-hide"
                  />
                ) : (
                  <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", !task.description && "text-muted-foreground italic")}>
                    {task.description || "No description provided."}
                  </p>
                )}
              </div>

              {/* Recurring */}
              {isCreator && (
                <div className="rounded-xl border border-border/50 bg-secondary/10 px-4 py-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Recurring task</p>
                        <p className="text-xs text-muted-foreground">Auto-respawns when completed</p>
                      </div>
                    </div>
                    <Switch
                      checked={!!task.recurrence_type}
                      onCheckedChange={(v) => handleField({ recurrence_type: v ? "daily" : null, recurrence_days: null })}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>

                  {task.recurrence_type && (
                    <div className="space-y-3 pt-1 border-t border-border/40">
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Repeat every</p>
                        <Select
                          value={task.recurrence_type}
                          onValueChange={(v) => handleField({ recurrence_type: v as RecurrenceType })}
                        >
                          <SelectTrigger className="h-8 text-sm hover:border-purple-400 hover:text-purple-700 transition-colors">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily (every 24 hrs)</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="custom">Custom interval</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {task.recurrence_type === "custom" && (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground whitespace-nowrap">Every</p>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={recurringDaysDraft}
                            onChange={(e) => setRecurringDaysDraft(Math.max(1, parseInt(e.target.value) || 1))}
                            onBlur={() => handleField({ recurrence_days: recurringDaysDraft })}
                            className="w-20 h-8 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      )}

                      <p className="text-xs text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400 rounded-md px-3 py-2">
                        When completed, the next occurrence drops back into Planning at{" "}
                        {task.task_time ? task.task_time.slice(0, 5) : "09:00"}.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action toolbar: Status · File · Link · + Add */}
              <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border/50 bg-secondary/10 px-4 py-3">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                {isCreator ? (
                  <Select value={task.status} onValueChange={(v) => handleField({ status: v as TaskDetail["status"] })}>
                    <SelectTrigger className="w-36 h-8 text-xs font-medium rounded-lg px-3 border hover:border-purple-400 hover:text-purple-700 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={cn("text-xs font-medium rounded-full px-3", STATUS_CONFIG[task.status].cls)}>
                    {STATUS_CONFIG[task.status].label}
                  </Badge>
                )}
                <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />
                {/*This should be hidden for now */}
                {/* <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-3 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-3.5 w-3.5" />File
                </Button> */}
                <Button
                  variant="outline" size="sm"
                  className={cn("gap-1.5 text-xs h-8 px-3 transition-colors", isAddingLink ? "bg-purple-50 border-purple-400 text-purple-700" : "hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700")}
                  onClick={() => setIsAddingLink((v) => !v)}
                >
                  <LinkIcon className="h-3.5 w-3.5" />Link
                </Button>
                <div className="flex-1" />
                <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs rounded-lg px-3 font-medium hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 pb-2">Add to card</p>
                    {ADD_MENU_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAddMenuSelect(item.id)}
                        className="w-full flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-colors text-left"
                      >
                        <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground leading-none">
                            {item.label}
                            {item.soon && <span className="ml-2 text-[10px] text-muted-foreground font-normal">(coming soon)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                        </div>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* Delete task — creator only */}
                {isCreator && (
                  <>
                    <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => setShowDeleteConfirm((v) => !v)}
                      title="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Delete confirmation bar */}
              {showDeleteConfirm && isCreator && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
                  <p className="text-sm text-destructive flex-1">
                    Delete <span className="font-medium">"{task.name}"</span>? This can't be undone.
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-3"
                    onClick={handleDeleteConfirmed}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-3"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Link input form */}
              {isAddingLink && (
                <div className="space-y-2 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                  <Input autoFocus placeholder="https://..." value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Display name (optional)" value={linkNameDraft} onChange={(e) => setLinkNameDraft(e.target.value)} className="h-8 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveLink} disabled={!linkDraft.trim() || isSavingLink}>
                      {isSavingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsAddingLink(false); setLinkDraft(""); setLinkNameDraft(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Checklists */}
              {((task.checklists ?? []).length > 0 || showChecklistInput) && (
                <div className="space-y-8">
                  {(task.checklists ?? []).map((cl) => (
                    <ChecklistBlock
                      key={cl.id}
                      checklist={cl}
                      taskId={task.id}
                      isCreator={isCreator}
                      currentUserId={currentUserId}
                      onToggle={(clId, itemId, val) => toggleChecklistItem(task.id, clId, itemId, val).catch(() => toast.error("Failed to update"))}
                      onAddItem={(clId, content) => addChecklistItem(task.id, clId, content).catch(() => toast.error("Failed to add item"))}
                      onDeleteItem={(clId, itemId) => deleteChecklistItem(task.id, clId, itemId).catch(() => toast.error("Failed to delete item"))}
                      onDelete={(clId) => deleteChecklist(task.id, clId).catch(() => toast.error("Failed to delete checklist"))}
                    />
                  ))}

                  {showChecklistInput && (
                    <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/10 p-3">
                      <p className="text-xs font-semibold text-muted-foreground">New checklist</p>
                      <Input
                        autoFocus
                        placeholder="Checklist title"
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateChecklist(); if (e.key === "Escape") { setShowChecklistInput(false); setNewChecklistTitle(""); } }}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={handleCreateChecklist} disabled={!newChecklistTitle.trim() || isCreatingChecklist}>
                          {isCreatingChecklist ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowChecklistInput(false); setNewChecklistTitle(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Deliverables (read-only sync from Deliverables page) */}
              {(task.deliverables ?? []).length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Deliverables</p>
                  <div className="space-y-2">
                    {(task.deliverables ?? []).map((del: TaskDeliverable) => (
                      <div key={del.id} className="rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground leading-snug">{del.title}</span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "shrink-0 text-[10px] capitalize",
                              del.status === "approved" && "bg-green-500/15 text-green-600 border-green-500/20",
                              del.status === "revision" && "bg-yellow-500/15 text-yellow-600 border-yellow-500/20",
                            )}
                          >
                            {del.status}
                          </Badge>
                        </div>
                        {del.submitted_by_name && (
                          <p className="text-xs text-muted-foreground">By {del.submitted_by_name}</p>
                        )}
                        {del.links.length > 0 && (
                          <div className="space-y-1">
                            {del.links.map((link) => (
                              <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                              >
                                <LinkIcon className="h-3 w-3 shrink-0" />
                                <span className="truncate">{link.url}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {del.files.length > 0 && (
                          <div className="space-y-1">
                            {del.files.map((f) => (
                              <a
                                key={f.id}
                                href={f.url ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Attachments</p>

                {(task.attachments ?? []).length > 0 && (
                  <div className="space-y-2">
                    {(task.attachments ?? []).map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 text-sm">
                        {att.url && !att.file_url
                          ? <LinkIcon className="h-4 w-4 shrink-0 text-primary" />
                          : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        }
                        <span className="flex-1 truncate text-foreground">{att.name}</span>
                        {(att.file_url || att.url) && (
                          <a href={att.file_url ?? att.url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {(isCreator || att.uploaded_by === currentUserId) && (
                          <button onClick={() => deleteAttachment(task.id, att.id).catch(() => toast.error("Failed to delete"))} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(task.attachments ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No attachments yet.</p>
                )}
              </div>
            </div>

            {/* ── Right panel: Comments ──────────────────────────────── */}
            <div className="w-full md:w-96 lg:w-[26rem] flex flex-col shrink-0 max-h-[50vh] md:max-h-[92vh]">
              <div className="px-6 py-5 border-b border-border/50 shrink-0">
                <h3 className="font-semibold text-sm text-foreground">Comments</h3>
                <p className="text-xs text-muted-foreground mt-1">{(task.comments ?? []).length} comment{(task.comments ?? []).length !== 1 ? "s" : ""}</p>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 space-y-5">
                {(task.comments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Start the conversation!</p>
                ) : (
                  (task.comments ?? []).map((c) => (
                    <div key={c.id} className="flex gap-3 group/comment">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarImage src={c.author_avatar ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/15 text-primary">{c.author_name?.charAt(0) ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">{c.author === currentUserId ? "You" : c.author_name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed mt-0.5 break-words">{c.content}</p>
                      </div>
                      {(c.author === currentUserId || isCreator) && (
                        <button onClick={() => deleteComment(task.id, c.id).catch(() => toast.error("Failed to delete"))} className="opacity-0 group-hover/comment:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 mt-0.5">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              <div className="px-6 py-5 border-t border-border/50 space-y-3 shrink-0">
                <Textarea
                  placeholder="Write a comment... (Enter to send)"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                  className="min-h-[64px] resize-none text-sm"
                />
                <div className="flex justify-end">
                  <Button size="sm" className="gap-1.5" disabled={!commentDraft.trim() || isSendingComment} onClick={handleSendComment}>
                    {isSendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
