import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Send, Trash2, Link as LinkIcon,
  FileText, X, Loader2, CheckSquare, Tag, Repeat, Clock, RotateCcw,
  MoreVertical, Check, ExternalLink, Reply, Paperclip, MessageSquare, ChevronLeft, Pencil,
  Circle, Flag, Calendar, User,
} from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { secureFetch } from "@/api/apiClient";
import {
  useTaskDetail,
  type TaskDetail, type TaskChecklist, type TaskPriority, type RecurrenceType, type TaskDeliverable, type TaskComment,
} from "@/hooks/useTaskDetail";
import { MentionDropdown, type MentionMember } from "@/components/messaging/MentionDropdown";

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
  planning:      { label: "Planning",    cls: "bg-orange-100 text-orange-700 border-orange-300", dot: "bg-orange-500" },
  "in-progress": { label: "In Progress", cls: "bg-yellow-100 text-yellow-700 border-yellow-300", dot: "bg-yellow-500" },
  completed:     { label: "Completed",   cls: "bg-green-100 text-green-700 border-green-300",    dot: "bg-green-500" },
} as const;

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; badge: string }> = {
  highest: { label: "Highest",  dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-300" },
  high:    { label: "High",     dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-300" },
  medium:  { label: "Medium",   dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  low:     { label: "Low",      dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700 border-blue-300" },
  lowest:  { label: "Lowest",   dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600 border-gray-300" },
  not_sure:{ label: "Not Sure", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700 border-purple-300" },
};

const ADD_MENU_ITEMS: { id: string; icon: typeof CheckSquare; label: string; sub: string; soon?: boolean }[] = [
  { id: "checklist",   icon: CheckSquare, label: "Checklist",   sub: "Add subtasks" },
  { id: "Attachment", icon: Paperclip,   label: "Attachment", sub: "Add links, files to tasks" },
  // { id: "labels",      icon: Tag,         label: "Labels",      sub: "Organise and prioritise", soon: true },
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

// ── Comment thread sub-component ───────────────────────────────────────────
// Recursive — a comment can be replied to at any depth, the creator decides how deep
// a thread goes rather than the UI capping it. Visual indent stops compounding past
// a few levels so very deep threads stay readable in the narrow comments panel.

const MAX_INDENT_DEPTH = 4;

function CommentThread({
  comment, repliesByParent, depth, currentUserId, isCreator,
  replyingToCommentId, onToggleReply, onDelete,
}: {
  comment: TaskComment;
  repliesByParent: Map<string, TaskComment[]>;
  depth: number;
  currentUserId: string;
  isCreator: boolean;
  replyingToCommentId: string | null;
  onToggleReply: (commentId: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const replies = repliesByParent.get(comment.id) ?? [];
  const isReply = depth > 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 group/comment">
        <Avatar className={cn("shrink-0 mt-0.5", isReply ? "h-6 w-6" : "h-7 w-7")}>
          <AvatarImage src={comment.author_avatar ?? undefined} />
          <AvatarFallback className={cn("bg-primary/15 text-primary", isReply ? "text-[9px]" : "text-[10px]")}>
            {comment.author_name?.charAt(0) ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-foreground truncate">{comment.author === currentUserId ? "You" : comment.author_name}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(comment.created_at)}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed mt-0.5 break-words">{comment.content}</p>
          <button
            onClick={() => onToggleReply(comment.id)}
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-[11px] transition-colors",
              replyingToCommentId === comment.id ? "text-primary" : "text-muted-foreground hover:text-primary",
            )}
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
        </div>
        {(comment.author === currentUserId || isCreator) && (
          <button onClick={() => onDelete(comment.id)} className="opacity-0 group-hover/comment:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 mt-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {replies.length > 0 && (
        <div className={depth < MAX_INDENT_DEPTH ? "ml-8 pl-3 border-l-2 border-border/60 space-y-3" : "space-y-3"}>
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              repliesByParent={repliesByParent}
              depth={depth + 1}
              currentUserId={currentUserId}
              isCreator={isCreator}
              replyingToCommentId={replyingToCommentId}
              onToggleReply={onToggleReply}
              onDelete={onDelete}
            />
          ))}
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
    task, isLoading, fetchTask, updateTask, requestTaskRevision, deleteTask,
    addComment, deleteComment,
    createChecklist, deleteChecklist,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    patchDeliverableLocal, removeDeliverableLocal, patchDeliverableLinkLocal,
    addDeliverableLinkLocal, removeDeliverableLinkLocal, addDeliverableFileLocal, removeDeliverableFileLocal,
    markTaskCompletedLocal,
    clearTask,
  } = useTaskDetail();

  const [editingTitle, setEditingTitle]     = useState(false);
  const [titleDraft, setTitleDraft]         = useState("");
  const [descDraft, setDescDraft]           = useState("");
  const [commentDraft, setCommentDraft]     = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [commentMentions, setCommentMentions] = useState<MentionMember[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [recurringDaysDraft, setRecurringDaysDraft] = useState<number>(2);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRequestingRevision, setIsRequestingRevision] = useState(false);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [addMenuOpen, setAddMenuOpen]       = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [showChecklistInput, setShowChecklistInput] = useState(false);
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);

  // ── Deliverable row actions ──
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const [revisionForDeliverableId, setRevisionForDeliverableId] = useState<string | null>(null);
  const [deliverableRevisionFeedback, setDeliverableRevisionFeedback] = useState("");
  const [deliverableActionBusyId, setDeliverableActionBusyId] = useState<string | null>(null);
  const [deliverableToDelete, setDeliverableToDelete] = useState<TaskDeliverable | null>(null);
  const [isDeletingDeliverable, setIsDeletingDeliverable] = useState(false);
  const [attachmentsModalDeliverable, setAttachmentsModalDeliverable] = useState<TaskDeliverable | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkUrlDraft, setEditingLinkUrlDraft] = useState("");
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [newAttachmentLinkDraft, setNewAttachmentLinkDraft] = useState("");
  const [isAddingAttachmentLink, setIsAddingAttachmentLink] = useState(false);
  const [isAddingAttachmentFile, setIsAddingAttachmentFile] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);
  const [editDeliverableTitleDraft, setEditDeliverableTitleDraft] = useState("");
  const [editDeliverableDescriptionDraft, setEditDeliverableDescriptionDraft] = useState("");
  const [isSavingDeliverableEdit, setIsSavingDeliverableEdit] = useState(false);

  // ── New deliverable form ──
  const [showDeliverableInput, setShowDeliverableInput] = useState(false);
  const [newDeliverableTitle, setNewDeliverableTitle] = useState("");
  const [newDeliverableDescription, setNewDeliverableDescription] = useState("");
  const [newDeliverableUrls, setNewDeliverableUrls] = useState<string[]>([]);
  const [newDeliverableUrlDraft, setNewDeliverableUrlDraft] = useState("");
  const [newDeliverableFiles, setNewDeliverableFiles] = useState<File[]>([]);
  const [isCreatingDeliverable, setIsCreatingDeliverable] = useState(false);

  // ── Mobile split-view (details <-> comments) ──
  const [mobileCommentsOpen, setMobileCommentsOpen] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const deliverableFileInputRef = useRef<HTMLInputElement>(null);
  const attachmentModalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && taskId) fetchTask(taskId);
    else if (!open) {
      clearTask();
      setEditingTitle(false);
      setCommentDraft("");
      setCommentMentions([]);
      setShowMentionDropdown(false);
      setShowChecklistInput(false);
      setShowDeleteConfirm(false);
      setSelectedDeliverableId(null);
      setRevisionForDeliverableId(null);
      setDeliverableRevisionFeedback("");
      setDeliverableToDelete(null);
      setReplyingToCommentId(null);
      setShowDeliverableInput(false);
      setNewDeliverableTitle("");
      setNewDeliverableDescription("");
      setNewDeliverableUrls([]);
      setNewDeliverableUrlDraft("");
      setNewDeliverableFiles([]);
      setMobileCommentsOpen(false);
      setAttachmentsModalDeliverable(null);
      setEditingLinkId(null);
      setEditingLinkUrlDraft("");
      setEditingDeliverableId(null);
      setNewAttachmentLinkDraft("");
      setRemovingAttachmentId(null);
    }
  }, [open, taskId]);

  useEffect(() => {
    if (task) {
      setTitleDraft(task.name);
      setDescDraft(task.description ?? "");
      setRecurringDaysDraft(task.recurrence_days ?? 2);
    }
    setSelectedDeliverableId(null);
    setRevisionForDeliverableId(null);
    setReplyingToCommentId(null);
    setMobileCommentsOpen(false);
    setAttachmentsModalDeliverable(null);
    setEditingLinkId(null);
    setEditingLinkUrlDraft("");
    setEditingDeliverableId(null);
    setNewAttachmentLinkDraft("");
    setRemovingAttachmentId(null);
  }, [task?.id]);

  useEffect(() => {
    if (task?.comments?.length) commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task?.comments?.length]);

  const selectedDeliverable = selectedDeliverableId
    ? ((task?.deliverables ?? []).find((d) => d.id === selectedDeliverableId) ?? null)
    : null;

  const replyingToComment = replyingToCommentId
    ? ((task?.comments ?? []).find((c) => c.id === replyingToCommentId) ?? null)
    : null;

  // Group comments into top-level threads + their direct replies (one level of nesting).
  const topLevelComments = (task?.comments ?? []).filter((c) => !c.parent);
  const repliesByParent = new Map<string, TaskComment[]>();
  (task?.comments ?? []).forEach((c) => {
    if (c.parent) repliesByParent.set(c.parent, [...(repliesByParent.get(c.parent) ?? []), c]);
  });

  // Who can be @mentioned in this task's comments: the project creator + this
  // task's current assignees — exactly who already has access to this thread.
  const mentionMembers: MentionMember[] = task ? (() => {
    const candidates: MentionMember[] = [
      { id: task.project_creator_id, name: task.project_creator_name, avatar: task.project_creator_avatar, role: "creator" },
      ...task.assignees.map((id, i) => ({
        id,
        name: task.assignee_names[i],
        avatar: task.assignee_avatars[i] ?? null,
        role: "assignee",
      })),
    ];
    const seen = new Set<string>();
    return candidates.filter((m) => m.id !== currentUserId && !seen.has(m.id) && seen.add(m.id));
  })() : [];

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

  // Creator approves a task an assignee flagged: completing it clears awaiting_approval server-side.
  const handleApprove = async () => {
    if (!task) return;
    setIsApproving(true);
    try {
      const u = await updateTask(task.id, { status: "completed" });
      onTaskUpdated?.(u);
      toast.success("Task approved");
    } catch { toast.error("Failed to approve task"); }
    finally { setIsApproving(false); }
  };

  // Creator sends the task back to the assignee with feedback instead of approving.
  const handleRequestRevision = async () => {
    if (!task) return;
    setIsRequestingRevision(true);
    try {
      await requestTaskRevision(task.id, revisionFeedback.trim());
      onTaskUpdated?.({ ...task, awaiting_approval: false });
      toast.success("Revision requested");
      setShowRevisionInput(false);
      setRevisionFeedback("");
    } catch { toast.error("Failed to request revision"); }
    finally { setIsRequestingRevision(false); }
  };

  const handleSendComment = async () => {
    if (!task || !commentDraft.trim()) return;
    setIsSendingComment(true);
    try {
      const raw = commentDraft.trim();
      const content = selectedDeliverable ? `Re: ${selectedDeliverable.title} : ${raw}` : raw;
      await addComment(task.id, content, replyingToCommentId, commentMentions.map((m) => m.id));
      setCommentDraft("");
      setReplyingToCommentId(null);
      setCommentMentions([]);
    }
    catch { toast.error("Failed to post comment"); }
    finally { setIsSendingComment(false); }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCommentDraft(value);
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const charBeforeAt = textBeforeCursor[lastAtIndex - 1];
      if (lastAtIndex === 0 || charBeforeAt === " ") {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes(" ")) {
          setMentionQuery(query);
          setShowMentionDropdown(true);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setShowMentionDropdown(false);
  };

  const handleMentionSelect = (member: MentionMember) => {
    const cursorPos = commentTextareaRef.current?.selectionStart || 0;
    const textBeforeCursor = commentDraft.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const beforeMention = commentDraft.slice(0, lastAtIndex);
      const afterMention = commentDraft.slice(cursorPos);
      setCommentDraft(`${beforeMention}@${member.name} ${afterMention}`);
      if (!commentMentions.some((m) => m.id === member.id)) setCommentMentions((prev) => [...prev, member]);
    }
    setShowMentionDropdown(false);
    commentTextareaRef.current?.focus();
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && mentionMembers.length > 0) {
      const filtered = mentionMembers.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()));
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedMentionIndex((p) => (p < filtered.length - 1 ? p + 1 : 0)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedMentionIndex((p) => (p > 0 ? p - 1 : filtered.length - 1)); }
      else if (e.key === "Enter" && filtered.length > 0) { e.preventDefault(); handleMentionSelect(filtered[selectedMentionIndex]); }
      else if (e.key === "Escape") setShowMentionDropdown(false);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const handleAddMenuSelect = (id: string) => {
    setAddMenuOpen(false);
    if (id === "checklist") setShowChecklistInput(true);
    else if (id === "Attachment") setShowDeliverableInput(true);
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

  const handleAddDeliverableUrl = () => {
    if (!newDeliverableUrlDraft.trim()) return;
    setNewDeliverableUrls((prev) => [...prev, newDeliverableUrlDraft.trim()]);
    setNewDeliverableUrlDraft("");
  };

  const handleDeliverableFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setNewDeliverableFiles((prev) => [...prev, ...Array.from(files)]);
    if (deliverableFileInputRef.current) deliverableFileInputRef.current.value = "";
  };

  const resetDeliverableForm = () => {
    setShowDeliverableInput(false);
    setNewDeliverableTitle("");
    setNewDeliverableDescription("");
    setNewDeliverableUrls([]);
    setNewDeliverableUrlDraft("");
    setNewDeliverableFiles([]);
  };

  // Same multipart POST /api/v2/deliverables/ shape DeliverablesPanel.handleUploadDeliverable uses.
  const handleCreateDeliverable = async () => {
    if (!task || !newDeliverableTitle.trim()) return;
    setIsCreatingDeliverable(true);
    try {
      const formData = new FormData();
      formData.append("task", task.id);
      formData.append("title", newDeliverableTitle.trim());
      formData.append("description", newDeliverableDescription.trim());
      newDeliverableUrls.forEach((url) => formData.append("urls", url));
      newDeliverableFiles.forEach((file) => formData.append("files", file));
      const res = await secureFetch("/api/v2/deliverables/", {
        method: "POST",
        body: formData,
        headers: {}, // Let browser set multipart content-type/boundary
      });
      if (!res.ok) { toast.error("Failed to add attachment"); return; }
      await fetchTask(task.id);
      resetDeliverableForm();
      toast.success("Attachment added");
    } catch { toast.error("Failed to add attachment"); }
    finally { setIsCreatingDeliverable(false); }
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

  // ── Deliverable actions ──────────────────────────────────────────────────

  // Shared worker for Approve / Request Revision — both hit the same review endpoint.
  const handleReviewDeliverable = async (deliverableId: string, status: "approved" | "revision", feedback?: string) => {
    if (!task) return;
    setDeliverableActionBusyId(deliverableId);
    try {
      const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/review/`, {
        method: "PATCH",
        body: JSON.stringify({ status, feedback }),
      });
      if (!res.ok) { toast.error("Failed to update deliverable"); return; }
      patchDeliverableLocal(deliverableId, { status, feedback: feedback ?? null });
      if (status === "approved") {
        markTaskCompletedLocal();
        onTaskUpdated?.({ ...task, status: "completed", awaiting_approval: false });
      }
      toast.success(status === "approved" ? "Deliverable approved" : "Revision requested");
    } catch { toast.error("Failed to update deliverable"); }
    finally { setDeliverableActionBusyId(null); }
  };

  const handleApproveDeliverable = async (del: TaskDeliverable) => {
    setRevisionForDeliverableId(null);
    await handleReviewDeliverable(del.id, "approved");
  };

  const handleSubmitDeliverableRevision = async (deliverableId: string) => {
    if (!deliverableRevisionFeedback.trim()) { toast.error("Please provide revision feedback"); return; }
    await handleReviewDeliverable(deliverableId, "revision", deliverableRevisionFeedback.trim());
    setRevisionForDeliverableId(null);
    setDeliverableRevisionFeedback("");
  };

  const handleDeleteDeliverableConfirmed = async () => {
    if (!deliverableToDelete) return;
    const deliverableId = deliverableToDelete.id;
    setIsDeletingDeliverable(true);
    try {
      const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        removeDeliverableLocal(deliverableId);
        setSelectedDeliverableId((prev) => (prev === deliverableId ? null : prev));
        setRevisionForDeliverableId((prev) => (prev === deliverableId ? null : prev));
        toast.success("Deliverable deleted");
      } else {
        toast.error("Failed to delete deliverable");
      }
    } catch { toast.error("Failed to delete deliverable"); }
    finally { setIsDeletingDeliverable(false); setDeliverableToDelete(null); }
  };

  const handleOpenDeliverable = (del: TaskDeliverable) => {
    const totalItems = del.links.length + del.files.length;
    if (totalItems === 0) { toast.info("No files or links attached"); setSelectedDeliverableId(del.id); return; }
    if (totalItems === 1) {
      const target = del.links[0]?.url ?? del.files.find((f) => f.url)?.url ?? null;
      if (target) window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    setAttachmentsModalDeliverable(del);
  };

  const handleStartEditLink = (linkId: string, currentUrl: string) => {
    setEditingLinkId(linkId);
    setEditingLinkUrlDraft(currentUrl);
  };

  const handleSaveLinkEdit = async (deliverableId: string, linkId: string) => {
    if (!editingLinkUrlDraft.trim()) return;
    setIsSavingLink(true);
    try {
      const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/links/${linkId}/`, {
        method: "PATCH",
        body: JSON.stringify({ url: editingLinkUrlDraft.trim() }),
      });
      if (!res.ok) { toast.error("Failed to update link"); return; }
      patchDeliverableLinkLocal(deliverableId, linkId, editingLinkUrlDraft.trim());
      setAttachmentsModalDeliverable((prev) => prev && prev.id === deliverableId
        ? { ...prev, links: prev.links.map((l) => l.id === linkId ? { ...l, url: editingLinkUrlDraft.trim() } : l) }
        : prev);
      setEditingLinkId(null);
      setEditingLinkUrlDraft("");
      toast.success("Link updated");
    } catch { toast.error("Failed to update link"); }
    finally { setIsSavingLink(false); }
  };

  const handleStartEditDeliverable = (del: TaskDeliverable) => {
    setEditingDeliverableId(del.id);
    setEditDeliverableTitleDraft(del.title);
    setEditDeliverableDescriptionDraft(del.description ?? "");
  };

  const handleCancelEditDeliverable = () => {
    setEditingDeliverableId(null);
    setEditDeliverableTitleDraft("");
    setEditDeliverableDescriptionDraft("");
  };

  const handleSaveDeliverableEdit = async (deliverableId: string) => {
    if (!editDeliverableTitleDraft.trim()) { toast.error("Title can't be empty"); return; }
    setIsSavingDeliverableEdit(true);
    try {
      const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/`, {
        method: "PATCH",
        body: JSON.stringify({ title: editDeliverableTitleDraft.trim(), description: editDeliverableDescriptionDraft.trim() || null }),
      });
      if (!res.ok) { toast.error("Failed to update deliverable"); return; }
      patchDeliverableLocal(deliverableId, {
        title: editDeliverableTitleDraft.trim(),
        description: editDeliverableDescriptionDraft.trim() || null,
      });
      handleCancelEditDeliverable();
      toast.success("Deliverable updated");
    } catch { toast.error("Failed to update deliverable"); }
    finally { setIsSavingDeliverableEdit(false); }
  };

  const handleAddAttachmentLink = async (deliverableId: string) => {
    if (!newAttachmentLinkDraft.trim()) return;
    setIsAddingAttachmentLink(true);
    try {
      const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/links/`, {
        method: "POST",
        body: JSON.stringify({ url: newAttachmentLinkDraft.trim() }),
      });
      if (!res.ok) { toast.error("Failed to add link"); return; }
      const link = await res.json();
      addDeliverableLinkLocal(deliverableId, link);
      setAttachmentsModalDeliverable((prev) => prev && prev.id === deliverableId
        ? { ...prev, links: [...prev.links, link] }
        : prev);
      setNewAttachmentLinkDraft("");
      toast.success("Link added");
    } catch { toast.error("Failed to add link"); }
    finally { setIsAddingAttachmentLink(false); }
  };

  const handleRemoveAttachmentLink = async (deliverableId: string, linkId: string) => {
    setRemovingAttachmentId(linkId);
    try {
      const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/links/${linkId}/`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to remove link"); return; }
      removeDeliverableLinkLocal(deliverableId, linkId);
      setAttachmentsModalDeliverable((prev) => prev && prev.id === deliverableId
        ? { ...prev, links: prev.links.filter((l) => l.id !== linkId) }
        : prev);
      toast.success("Link removed");
    } catch { toast.error("Failed to remove link"); }
    finally { setRemovingAttachmentId(null); }
  };

  const handleAddAttachmentFiles = async (deliverableId: string, files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setIsAddingAttachmentFile(true);
    try {
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/files/`, {
          method: "POST",
          body: formData,
          headers: {}, // Let browser set multipart content-type/boundary
        });
        if (!res.ok) { toast.error(`Failed to add ${file.name}`); continue; }
        const uploaded = await res.json();
        addDeliverableFileLocal(deliverableId, uploaded);
        setAttachmentsModalDeliverable((prev) => prev && prev.id === deliverableId
          ? { ...prev, files: [...prev.files, uploaded] }
          : prev);
      }
      toast.success(fileArray.length > 1 ? "Files added" : "File added");
    } catch { toast.error("Failed to add file"); }
    finally {
      setIsAddingAttachmentFile(false);
      if (attachmentModalFileInputRef.current) attachmentModalFileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachmentFile = async (deliverableId: string, fileId: string) => {
    setRemovingAttachmentId(fileId);
    try {
      const res = await secureFetch(`/api/v2/deliverables/${deliverableId}/files/${fileId}/`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to remove file"); return; }
      removeDeliverableFileLocal(deliverableId, fileId);
      setAttachmentsModalDeliverable((prev) => prev && prev.id === deliverableId
        ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) }
        : prev);
      toast.success("File removed");
    } catch { toast.error("Failed to remove file"); }
    finally { setRemovingAttachmentId(null); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isMobile = useIsMobile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-none h-screen max-h-screen rounded-none sm:rounded-none left-0 top-0 translate-x-0 translate-y-0 md:max-w-[90vw] md:h-[90vh] md:max-h-[90vh] md:rounded-lg md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%] p-0 gap-0 overflow-hidden flex flex-col">
        {isLoading || !task ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (() => {
          // Shared field controls — computed once, reused by both the mobile row-list
          // layout and the untouched desktop fields row, so there's one source of truth
          // per control rather than two copies of the same Select/Popover/DateTimePicker.
          const statusControl = isCreator ? (
            <Select value={task.status} onValueChange={(v) => handleField({ status: v as TaskDetail["status"] })}>
              <SelectTrigger className="w-36 h-8 text-xs font-medium rounded-lg px-3 border hover:border-purple-400 hover:text-purple-700 transition-colors">
                <SelectValue>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_CONFIG[task.status].dot)} />
                    {STATUS_CONFIG[task.status].label}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={cn("text-xs font-medium rounded-full px-3", STATUS_CONFIG[task.status].cls)}>
              <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5 inline-block", STATUS_CONFIG[task.status].dot)} />
              {STATUS_CONFIG[task.status].label}
            </Badge>
          );

          const recurrenceControl = (
            <Select
              value={task.recurrence_type ?? "off"}
              onValueChange={(v) => handleField(
                v === "off" ? { recurrence_type: null, recurrence_days: null } : { recurrence_type: v as RecurrenceType },
              )}
            >
              <SelectTrigger className="h-8 w-auto min-w-[9.5rem] text-xs font-medium rounded-lg px-3 border hover:border-purple-400 hover:text-purple-700 transition-colors">
                <SelectValue placeholder="Set recurrence">
                  <div className="flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    {task.recurrence_type
                      ? { daily: "Daily", weekly: "Weekly", monthly: "Monthly", custom: "Custom interval" }[task.recurrence_type]
                      : "Set recurrence"}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">
                  <span className="text-muted-foreground">No recurrence</span>
                </SelectItem>
                <SelectItem value="daily">Daily (every 24 hrs)</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom interval</SelectItem>
              </SelectContent>
            </Select>
          );

          const assignedToControl = isCreator ? (
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
          );

          const dueDateControl = isCreator ? (
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
          );

          const priorityControl = isCreator ? (
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
          );

          const descriptionControl = isCreator ? (
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
          );

          const createdAtLabel = (() => {
            try { return format(parseISO(task.created_at), "MMM d, yyyy 'at' h:mm a"); }
            catch { return "—"; }
          })();

          const leftPanelContent = (
            <div className="h-full overflow-y-auto scrollbar-thin-purple p-10 space-y-7">

              {/* ══ Mobile (< md): title + chat/kebab row, then a bordered label-left/value-right row list ══ */}
              <div className="md:hidden space-y-5">
                <div className="flex items-start justify-between gap-3">
                  {editingTitle && isCreator ? (
                    <Input
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(task.name); setEditingTitle(false); } }}
                      className="text-xl font-bold h-auto py-1 px-2"
                    />
                  ) : (
                    <h2
                      className={cn("text-xl font-bold text-foreground leading-tight", isCreator && "cursor-pointer hover:text-primary transition-colors")}
                      onClick={() => isCreator && setEditingTitle(true)}
                      title={isCreator ? "Click to edit" : undefined}
                    >
                      {task.name}
                    </h2>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setMobileCommentsOpen(true)}
                      className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Open comments"
                    >
                      <MessageSquare className="h-5 w-5" />
                      {(task.comments ?? []).length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                          {task.comments.length}
                        </span>
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ADD_MENU_ITEMS.map((item) => (
                          <DropdownMenuItem key={item.id} onClick={() => handleAddMenuSelect(item.id)}>
                            <item.icon className="h-4 w-4 mr-2" />
                            Add {item.label}
                          </DropdownMenuItem>
                        ))}
                        {isCreator && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Task
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 divide-y divide-border/50">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Circle className="h-4 w-4 shrink-0" />
                      <span className="text-sm">Status</span>
                    </div>
                    <div className="shrink-0">{statusControl}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Flag className="h-4 w-4 shrink-0" />
                      <span className="text-sm">Priority</span>
                    </div>
                    <div className="shrink-0">{priorityControl}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="text-sm">Created at</span>
                    </div>
                    <span className="text-sm text-foreground shrink-0">{createdAtLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="text-sm">Due at</span>
                    </div>
                    <div className="shrink-0">{dueDateControl}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="text-sm">Assignee</span>
                    </div>
                    <div className="shrink-0">{assignedToControl}</div>
                  </div>
                  {isCreator && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Repeat className="h-4 w-4 shrink-0" />
                        <span className="text-sm">Recurrence</span>
                      </div>
                      <div className="shrink-0">{recurrenceControl}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ══ Desktop (md+): unchanged title + spaced fields row ══ */}
              <div className="hidden md:block space-y-7">
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

                {/* Fields: Status · Recurrence · Assigned to · Due date · Priority — spaced apart, plus Add/Delete at the row's end */}
                <div className="flex flex-wrap items-end gap-8 text-sm">
                  <div className="space-y-2.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                    {statusControl}
                  </div>

                  {isCreator && (
                    <div className="space-y-2.5">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recurrence</p>
                      {recurrenceControl}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Assigned to</p>
                    {assignedToControl}
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Due date</p>
                    {dueDateControl}
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Priority</p>
                    {priorityControl}
                  </div>

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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => setShowDeleteConfirm(true)}
                      title="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Custom recurrence interval — only when Custom interval is selected */}
              {isCreator && task.recurrence_type === "custom" && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Repeats every</p>
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

              {/* Pending-approval banner — shown to both roles; creator gets Approve / Request revision. */}
              {task.awaiting_approval && (
                <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        {isCreator ? "Pending your approval" : "Pending creator approval"}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                        {isCreator
                          ? "The assignee marked this task as ready. Approve it, or request a revision."
                          : "You've marked this task as ready. Awaiting your creator's approval..."}
                      </p>
                    </div>
                    {isCreator && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={handleApprove}
                          disabled={isApproving || isRequestingRevision}
                          className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
                        >
                          {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRevisionInput((v) => !v)}
                          disabled={isApproving || isRequestingRevision}
                          className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Request revision
                        </Button>
                      </div>
                    )}
                  </div>

                  {isCreator && showRevisionInput && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={revisionFeedback}
                        onChange={(e) => setRevisionFeedback(e.target.value)}
                        placeholder="What needs changing?"
                        className="min-h-[72px] text-sm bg-white dark:bg-background"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setShowRevisionInput(false); setRevisionFeedback(""); }}
                          disabled={isRequestingRevision}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleRequestRevision}
                          disabled={isRequestingRevision}
                          className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
                        >
                          {isRequestingRevision ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Send request
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

              {/* Description */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Description</p>
                <div className="md:hidden rounded-xl border border-border/50 p-3">{descriptionControl}</div>
                <div className="hidden md:block">{descriptionControl}</div>
              </div>

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

              {/* Deliverables & Files — the single canonical list of submitted work */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Attachments</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
                    onClick={() => setShowDeliverableInput(true)}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                {(task.deliverables ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {(task.deliverables ?? []).map((del: TaskDeliverable) => (
                      <div
                        key={del.id}
                        onClick={() => setSelectedDeliverableId((prev) => (prev === del.id ? null : del.id))}
                        className={cn(
                          "rounded-lg border px-4 py-3 space-y-2 cursor-pointer transition-colors",
                          selectedDeliverableId === del.id
                            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                            : "border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-border",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground leading-snug flex-1 min-w-0">{del.title}</span>
                          <div className="flex items-center gap-1 shrink-0">
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1.5 text-muted-foreground">
                                  {deliverableActionBusyId === del.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={deliverableActionBusyId === del.id}
                                  onClick={(e) => { e.stopPropagation(); handleOpenDeliverable(del); }}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={deliverableActionBusyId === del.id}
                                  onClick={(e) => { e.stopPropagation(); setSelectedDeliverableId(del.id); setMobileCommentsOpen(true); }}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Comment
                                </DropdownMenuItem>
                                {(isCreator || del.submitted_by === currentUserId) && (
                                  <>
                                    <DropdownMenuItem
                                      disabled={deliverableActionBusyId === del.id}
                                      onClick={(e) => { e.stopPropagation(); handleStartEditDeliverable(del); }}
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={deliverableActionBusyId === del.id}
                                      onClick={(e) => { e.stopPropagation(); setAttachmentsModalDeliverable(del); }}
                                    >
                                      <Paperclip className="h-4 w-4 mr-2" />
                                      Manage Attachments
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {isCreator && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {del.status !== "approved" && (
                                      <DropdownMenuItem
                                        disabled={deliverableActionBusyId === del.id}
                                        onClick={(e) => { e.stopPropagation(); handleApproveDeliverable(del); }}
                                      >
                                        <Check className="h-4 w-4 mr-2" />
                                        Approve
                                      </DropdownMenuItem>
                                    )}
                                    {del.status !== "approved" && (
                                      <DropdownMenuItem
                                        disabled={deliverableActionBusyId === del.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRevisionForDeliverableId(del.id);
                                          setDeliverableRevisionFeedback("");
                                          setSelectedDeliverableId(del.id);
                                        }}
                                      >
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                        Request Revision
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setDeliverableToDelete(del); }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Deliverable
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {del.submitted_by_name && (
                          <p className="text-xs text-muted-foreground">By {del.submitted_by_name}</p>
                        )}
                        {del.status === "revision" && del.feedback && (
                          <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                            {del.feedback}
                          </p>
                        )}
                        {del.links.length > 0 && (
                          <div className="space-y-1">
                            {del.links.map((link) => (
                              <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
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
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {isCreator && revisionForDeliverableId === del.id && (
                          <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                            <Textarea
                              autoFocus
                              value={deliverableRevisionFeedback}
                              onChange={(e) => setDeliverableRevisionFeedback(e.target.value)}
                              placeholder="What needs changing?"
                              className="min-h-[64px] text-sm bg-background"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setRevisionForDeliverableId(null); setDeliverableRevisionFeedback(""); }}
                                disabled={deliverableActionBusyId === del.id}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSubmitDeliverableRevision(del.id)}
                                disabled={!deliverableRevisionFeedback.trim() || deliverableActionBusyId === del.id}
                                className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
                              >
                                {deliverableActionBusyId === del.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                Send request
                              </Button>
                            </div>
                          </div>
                        )}
                        {(isCreator || del.submitted_by === currentUserId) && editingDeliverableId === del.id && (
                          <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              autoFocus
                              value={editDeliverableTitleDraft}
                              onChange={(e) => setEditDeliverableTitleDraft(e.target.value)}
                              placeholder="Deliverable title"
                              className="h-8 text-sm"
                            />
                            <Textarea
                              value={editDeliverableDescriptionDraft}
                              onChange={(e) => setEditDeliverableDescriptionDraft(e.target.value)}
                              placeholder="Description (optional)"
                              className="min-h-[64px] text-sm bg-background"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEditDeliverable}
                                disabled={isSavingDeliverableEdit}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveDeliverableEdit(del.id)}
                                disabled={!editDeliverableTitleDraft.trim() || isSavingDeliverableEdit}
                              >
                                {isSavingDeliverableEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !showDeliverableInput && <p className="text-sm text-muted-foreground italic">No attachments/deliverables yet.</p>
                )}

                {showDeliverableInput && (
                  <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/10 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">New deliverable</p>
                    <Input
                      autoFocus
                      placeholder="Deliverable title"
                      value={newDeliverableTitle}
                      onChange={(e) => setNewDeliverableTitle(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Textarea
                      placeholder="Description (optional)"
                      value={newDeliverableDescription}
                      onChange={(e) => setNewDeliverableDescription(e.target.value)}
                      className="min-h-[56px] text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Paste a link (optional)"
                        value={newDeliverableUrlDraft}
                        onChange={(e) => setNewDeliverableUrlDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddDeliverableUrl(); } }}
                        className="h-8 text-sm flex-1"
                      />
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddDeliverableUrl} disabled={!newDeliverableUrlDraft.trim()}>
                        Add link
                      </Button>
                    </div>
                    {newDeliverableUrls.length > 0 && (
                      <div className="space-y-1">
                        {newDeliverableUrls.map((url, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 rounded bg-secondary/40 px-2 py-1">
                            <span className="text-xs text-primary truncate">{url}</span>
                            <button onClick={() => setNewDeliverableUrls((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive shrink-0">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      ref={deliverableFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleDeliverableFilesSelected(e.target.files)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => deliverableFileInputRef.current?.click()}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Choose files
                    </Button>
                    {newDeliverableFiles.length > 0 && (
                      <div className="space-y-1">
                        {newDeliverableFiles.map((file, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 rounded bg-secondary/40 px-2 py-1">
                            <span className="text-xs text-foreground truncate">{file.name}</span>
                            <button onClick={() => setNewDeliverableFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive shrink-0">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="h-7 text-xs" onClick={handleCreateDeliverable} disabled={!newDeliverableTitle.trim() || isCreatingDeliverable}>
                        {isCreatingDeliverable ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetDeliverableForm}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

          const rightPanelContent = (
            <div className="h-full flex flex-col">
              <div className="px-6 py-5 border-b border-border/50 shrink-0 flex items-center">
                <button
                  onClick={() => setMobileCommentsOpen(false)}
                  className="md:hidden p-1 -ml-1 mr-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                  aria-label="Back to task details"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Comments</h3>
                  <p className="text-xs text-muted-foreground mt-1">{(task.comments ?? []).length} comment{(task.comments ?? []).length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin-purple px-6 py-5 space-y-5">
                {(task.comments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Start the conversation!</p>
                ) : (
                  topLevelComments.map((c) => (
                    <CommentThread
                      key={c.id}
                      comment={c}
                      repliesByParent={repliesByParent}
                      depth={0}
                      currentUserId={currentUserId}
                      isCreator={isCreator}
                      replyingToCommentId={replyingToCommentId}
                      onToggleReply={(id) => setReplyingToCommentId((prev) => (prev === id ? null : id))}
                      onDelete={(id) => deleteComment(task.id, id).catch(() => toast.error("Failed to delete"))}
                    />
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              <div className="px-6 py-5 border-t border-border/50 space-y-3 shrink-0">
                {selectedDeliverable && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5">
                    <FileText className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[11px] text-primary truncate flex-1">Add comments to: {selectedDeliverable.title}</span>
                    <button onClick={() => setSelectedDeliverableId(null)} aria-label="Clear deliverable context" className="text-primary/70 hover:text-primary shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {replyingToComment && (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5">
                    <Reply className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] text-foreground truncate flex-1">
                      Replying to {replyingToComment.author === currentUserId ? "yourself" : replyingToComment.author_name}: "
                      {replyingToComment.content.length > 60 ? `${replyingToComment.content.slice(0, 60)}…` : replyingToComment.content}"
                    </span>
                    <button onClick={() => setReplyingToCommentId(null)} aria-label="Cancel reply" className="text-muted-foreground hover:text-foreground shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {commentMentions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">Mentioning:</span>
                    {commentMentions.map((m) => (
                      <span key={m.id} className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">@{m.name}</span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Textarea
                    ref={commentTextareaRef}
                    placeholder={
                      replyingToComment
                        ? `Reply to ${replyingToComment.author === currentUserId ? "yourself" : replyingToComment.author_name}…`
                        : selectedDeliverable ? `Reply about "${selectedDeliverable.title}"…` : "Write a comment... (Enter to send)"
                    }
                    value={commentDraft}
                    onChange={handleCommentChange}
                    onKeyDown={handleCommentKeyDown}
                    className="min-h-[64px] resize-none text-sm"
                  />
                  <MentionDropdown
                    members={mentionMembers}
                    searchQuery={mentionQuery}
                    selectedIndex={selectedMentionIndex}
                    onSelect={handleMentionSelect}
                    onClose={() => setShowMentionDropdown(false)}
                    visible={showMentionDropdown}
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" className="gap-1.5" disabled={!commentDraft.trim() || isSendingComment} onClick={handleSendComment}>
                    {isSendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          );

          return isMobile ? (
            <div className="flex flex-col flex-1 min-h-0">
              {mobileCommentsOpen ? rightPanelContent : leftPanelContent}
            </div>
          ) : (
            <ResizablePanelGroup direction="horizontal" autoSaveId="task-detail-modal-panels" className="flex-1 min-h-0">
              <ResizablePanel defaultSize={70} minSize={45}>{leftPanelContent}</ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={22} maxSize={55}>{rightPanelContent}</ResizablePanel>
            </ResizablePanelGroup>
          );
        })()}
      </DialogContent>

      {/* Delete task confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{task?.name}". This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleDeleteConfirmed(); }}
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete deliverable confirmation */}
      <AlertDialog open={!!deliverableToDelete} onOpenChange={(o) => { if (!o) setDeliverableToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deliverableToDelete?.title}" and all its files and links. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDeliverable}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingDeliverable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleDeleteDeliverableConfirmed(); }}
            >
              {isDeletingDeliverable ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attachments modal — view, add, and remove a deliverable's links/files */}
      <Dialog open={!!attachmentsModalDeliverable} onOpenChange={(o) => { if (!o) { setAttachmentsModalDeliverable(null); setEditingLinkId(null); setNewAttachmentLinkDraft(""); } }}>
        <DialogContent overlayClassName="backdrop-blur-sm" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{attachmentsModalDeliverable?.title}</DialogTitle>
            <DialogDescription>Add, edit, or remove files and links attached to this deliverable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin-purple">
            {attachmentsModalDeliverable?.links.map((link) => (
              <div key={link.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                <LinkIcon className="h-4 w-4 text-primary shrink-0" />
                {editingLinkId === link.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editingLinkUrlDraft}
                      onChange={(e) => setEditingLinkUrlDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveLinkEdit(attachmentsModalDeliverable.id, link.id); if (e.key === "Escape") setEditingLinkId(null); }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={isSavingLink || !editingLinkUrlDraft.trim()} onClick={() => handleSaveLinkEdit(attachmentsModalDeliverable.id, link.id)}>
                      {isSavingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={isSavingLink} onClick={() => setEditingLinkId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm text-primary hover:underline truncate">
                      {link.url}
                    </a>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => handleStartEditLink(link.id, link.url)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={removingAttachmentId === link.id}
                      onClick={() => handleRemoveAttachmentLink(attachmentsModalDeliverable.id, link.id)}
                    >
                      {removingAttachmentId === link.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            ))}
            {attachmentsModalDeliverable?.files.map((file) => (
              <div key={file.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                <a
                  href={file.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 flex items-center gap-2 hover:underline"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-foreground truncate">{file.name}</span>
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={removingAttachmentId === file.id}
                  onClick={() => handleRemoveAttachmentFile(attachmentsModalDeliverable.id, file.id)}
                >
                  {removingAttachmentId === file.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
          {attachmentsModalDeliverable && (
            <div className="space-y-2 border-t border-border/50 pt-3">
              <div className="flex items-center gap-2">
                <Input
                  value={newAttachmentLinkDraft}
                  onChange={(e) => setNewAttachmentLinkDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddAttachmentLink(attachmentsModalDeliverable.id); }}
                  placeholder="Paste a link to add"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1 shrink-0"
                  disabled={isAddingAttachmentLink || !newAttachmentLinkDraft.trim()}
                  onClick={() => handleAddAttachmentLink(attachmentsModalDeliverable.id)}
                >
                  {isAddingAttachmentLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add Link
                </Button>
              </div>
              <input
                ref={attachmentModalFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) handleAddAttachmentFiles(attachmentsModalDeliverable.id, e.target.files); }}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 gap-1"
                disabled={isAddingAttachmentFile}
                onClick={() => attachmentModalFileInputRef.current?.click()}
              >
                {isAddingAttachmentFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                Add File
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
