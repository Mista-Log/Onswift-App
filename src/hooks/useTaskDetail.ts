import { useState, useCallback } from "react";
import { secureFetch } from "@/api/apiClient";

export type TaskPriority = "highest" | "high" | "medium" | "low" | "lowest" | "not_sure";

export interface TaskComment {
  id: string;
  author: string;
  author_name: string;
  author_role: string;
  author_avatar: string | null;
  content: string;
  parent: string | null;
  mentioned_users: string[];
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  uploaded_by: string;
  uploaded_by_name: string;
  name: string;
  file: string | null;
  file_url: string | null;
  url: string | null;
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  content: string;
  is_checked: boolean;
  order: number;
  created_at: string;
}

export interface TaskChecklist {
  id: string;
  title: string;
  items: TaskChecklistItem[];
  progress: number;
  created_at: string;
}

export type RecurrenceType = "daily" | "weekly" | "monthly" | "custom";

export interface TaskDeliverableLink {
  id: string;
  url: string;
}

export interface TaskDeliverableFile {
  id: string;
  name: string;
  url: string | null;
  size: number;
  file_type: string;
}

export interface TaskDeliverable {
  id: string;
  title: string;
  description: string | null;
  submitted_by: string;
  submitted_by_name: string;
  status: "pending" | "approved" | "revision";
  feedback: string | null;
  links: TaskDeliverableLink[];
  files: TaskDeliverableFile[];
  created_at: string;
}

export interface TaskDetail {
  id: string;
  project: string;
  name: string;
  description: string | null;
  assignees: string[];
  assignee_names: string[];
  assignee_avatars: string[];
  status: "planning" | "in-progress" | "completed";
  awaiting_approval: boolean;
  priority: TaskPriority | null;
  deadline: string | null;
  task_time: string | null;
  recurrence_type: RecurrenceType | null;
  recurrence_days: number | null;
  created_at: string;
  project_creator_id: string;
  project_creator_name: string;
  project_creator_avatar: string | null;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  checklists: TaskChecklist[];
  deliverables: TaskDeliverable[];
}

export function useTaskDetail() {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTask = useCallback(async (taskId: string) => {
    setIsLoading(true);
    try {
      const res = await secureFetch(`/api/v2/tasks/${taskId}/`);
      if (res.ok) setTask(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Pick<TaskDetail, "name" | "description" | "status" | "priority" | "deadline" | "task_time" | "recurrence_type" | "recurrence_days" | "assignees">>,
  ) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update task");
    // PATCH returns TaskSerializer (no nested arrays) — merge to preserve comments/checklists/attachments
    const partial = await res.json();
    setTask((prev) => prev ? { ...prev, ...partial } : partial as TaskDetail);
    return partial as TaskDetail;
  }, []);

  // Creator bounces a task awaiting approval back to its assignees with feedback.
  const requestTaskRevision = useCallback(async (taskId: string, feedback: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/request-revision/`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    });
    if (!res.ok) throw new Error("Failed to request revision");
    setTask((prev) => prev ? { ...prev, awaiting_approval: false } : prev);
  }, []);

  // ── Comments ──────────────────────────────────────────────────────────────

  const addComment = useCallback(async (taskId: string, content: string, parentId?: string | null, mentionIds?: string[]) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/comments/`, {
      method: "POST",
      body: JSON.stringify({ content, parent: parentId ?? null, mention_ids: mentionIds ?? [] }),
    });
    if (!res.ok) throw new Error("Failed to add comment");
    const comment: TaskComment = await res.json();
    setTask((prev) => prev ? { ...prev, comments: [...prev.comments, comment] } : prev);
    return comment;
  }, []);

  const deleteComment = useCallback(async (taskId: string, commentId: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/comments/${commentId}/`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete comment");
    // Backend FK is on_delete=SET_NULL — mirror that locally so replies to a deleted
    // comment become top-level instead of silently disappearing from the thread.
    setTask((prev) => prev ? {
      ...prev,
      comments: prev.comments
        .filter((c) => c.id !== commentId)
        .map((c) => c.parent === commentId ? { ...c, parent: null } : c),
    } : prev);
  }, []);

  // ── Attachments ───────────────────────────────────────────────────────────

  const addAttachment = useCallback(async (taskId: string, data: FormData) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/attachments/`, { method: "POST", body: data });
    if (!res.ok) throw new Error("Failed to add attachment");
    const attachment: TaskAttachment = await res.json();
    setTask((prev) => prev ? { ...prev, attachments: [attachment, ...prev.attachments] } : prev);
    return attachment;
  }, []);

  const deleteAttachment = useCallback(async (taskId: string, attachmentId: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/attachments/${attachmentId}/`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete attachment");
    setTask((prev) => prev ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) } : prev);
  }, []);

  // ── Checklists ────────────────────────────────────────────────────────────

  const createChecklist = useCallback(async (taskId: string, title: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/checklists/`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Failed to create checklist");
    const checklist: TaskChecklist = await res.json();
    setTask((prev) => prev ? { ...prev, checklists: [...prev.checklists, checklist] } : prev);
    return checklist;
  }, []);

  const deleteChecklist = useCallback(async (taskId: string, checklistId: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/checklists/${checklistId}/`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete checklist");
    setTask((prev) => prev ? { ...prev, checklists: prev.checklists.filter((c) => c.id !== checklistId) } : prev);
  }, []);

  // ── Checklist Items ───────────────────────────────────────────────────────

  const addChecklistItem = useCallback(async (taskId: string, checklistId: string, content: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/checklists/${checklistId}/items/`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to add item");
    const item: TaskChecklistItem = await res.json();
    setTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checklists: prev.checklists.map((cl) =>
          cl.id === checklistId
            ? { ...cl, items: [...cl.items, item] }
            : cl
        ),
      };
    });
    return item;
  }, []);

  const toggleChecklistItem = useCallback(async (
    taskId: string,
    checklistId: string,
    itemId: string,
    is_checked: boolean,
  ) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/checklists/${checklistId}/items/${itemId}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_checked }),
    });
    if (!res.ok) throw new Error("Failed to update item");
    setTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checklists: prev.checklists.map((cl) => {
          if (cl.id !== checklistId) return cl;
          const newItems = cl.items.map((it) => it.id === itemId ? { ...it, is_checked } : it);
          const total = newItems.length;
          const checked = newItems.filter((i) => i.is_checked).length;
          const progress = total === 0 ? 0 : Math.round((checked / total) * 100);
          return { ...cl, items: newItems, progress };
        }),
      };
    });
  }, []);

  const deleteChecklistItem = useCallback(async (taskId: string, checklistId: string, itemId: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/checklists/${checklistId}/items/${itemId}/`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete item");
    setTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checklists: prev.checklists.map((cl) => {
          if (cl.id !== checklistId) return cl;
          const newItems = cl.items.filter((it) => it.id !== itemId);
          const total = newItems.length;
          const checked = newItems.filter((i) => i.is_checked).length;
          const progress = total === 0 ? 0 : Math.round((checked / total) * 100);
          return { ...cl, items: newItems, progress };
        }),
      };
    });
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    const res = await secureFetch(`/api/v2/tasks/${taskId}/`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete task");
    setTask(null);
  }, []);

  // ── Deliverables (local-only patches — review/delete requests are made by the caller) ──

  const patchDeliverableLocal = useCallback((deliverableId: string, updates: Partial<TaskDeliverable>) => {
    setTask((prev) => prev ? {
      ...prev,
      deliverables: prev.deliverables.map((d) => d.id === deliverableId ? { ...d, ...updates } : d),
    } : prev);
  }, []);

  const removeDeliverableLocal = useCallback((deliverableId: string) => {
    setTask((prev) => prev ? {
      ...prev,
      deliverables: prev.deliverables.filter((d) => d.id !== deliverableId),
    } : prev);
  }, []);

  const patchDeliverableLinkLocal = useCallback((deliverableId: string, linkId: string, url: string) => {
    setTask((prev) => prev ? {
      ...prev,
      deliverables: prev.deliverables.map((d) => d.id === deliverableId
        ? { ...d, links: d.links.map((l) => l.id === linkId ? { ...l, url } : l) }
        : d),
    } : prev);
  }, []);

  const addDeliverableLinkLocal = useCallback((deliverableId: string, link: TaskDeliverableLink) => {
    setTask((prev) => prev ? {
      ...prev,
      deliverables: prev.deliverables.map((d) => d.id === deliverableId ? { ...d, links: [...d.links, link] } : d),
    } : prev);
  }, []);

  const removeDeliverableLinkLocal = useCallback((deliverableId: string, linkId: string) => {
    setTask((prev) => prev ? {
      ...prev,
      deliverables: prev.deliverables.map((d) => d.id === deliverableId
        ? { ...d, links: d.links.filter((l) => l.id !== linkId) }
        : d),
    } : prev);
  }, []);

  const addDeliverableFileLocal = useCallback((deliverableId: string, file: TaskDeliverableFile) => {
    setTask((prev) => prev ? {
      ...prev,
      deliverables: prev.deliverables.map((d) => d.id === deliverableId ? { ...d, files: [...d.files, file] } : d),
    } : prev);
  }, []);

  const removeDeliverableFileLocal = useCallback((deliverableId: string, fileId: string) => {
    setTask((prev) => prev ? {
      ...prev,
      deliverables: prev.deliverables.map((d) => d.id === deliverableId
        ? { ...d, files: d.files.filter((f) => f.id !== fileId) }
        : d),
    } : prev);
  }, []);

  // Approving a deliverable completes its parent task server-side — mirror that locally.
  const markTaskCompletedLocal = useCallback(() => {
    setTask((prev) => prev ? { ...prev, status: "completed", awaiting_approval: false } : prev);
  }, []);

  const clearTask = useCallback(() => setTask(null), []);

  return {
    task,
    isLoading,
    fetchTask,
    updateTask,
    requestTaskRevision,
    deleteTask,
    addComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    createChecklist,
    deleteChecklist,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    patchDeliverableLocal,
    removeDeliverableLocal,
    patchDeliverableLinkLocal,
    addDeliverableLinkLocal,
    removeDeliverableLinkLocal,
    addDeliverableFileLocal,
    removeDeliverableFileLocal,
    markTaskCompletedLocal,
    clearTask,
  };
}
