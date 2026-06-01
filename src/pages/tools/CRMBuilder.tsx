import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCRM, CRMFieldType, CRMColumn, CRMRow, SharableUser, AccessRole } from "@/hooks/useCRM";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Download,
  Share2,
  FileSpreadsheet,
  MoreVertical,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Rows3,
  Columns3,
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  BarChart2,
  Image as ImageIcon,
  PenLine,
  CheckSquare,
  List,
  Link2,
  MessageSquare,
  StickyNote,
  Tag,
  LayoutGrid,
  Sheet,
  Eye,
  Users,
} from "lucide-react";

// ── Field type options ─────────────────────────────────────────────────────────

const FIELD_TYPES: { value: CRMFieldType; label: string }[] = [
  { value: "text",          label: "Text" },
  { value: "email",         label: "Email" },
  { value: "phone",         label: "Phone Number" },
  { value: "url",           label: "URL" },
  { value: "number",        label: "Number" },
  { value: "date",          label: "Date" },
  { value: "single_select", label: "Dropdown" },
  { value: "multi_select",  label: "Multi-select" },
  { value: "checkbox",      label: "Checkbox" },
];

// ── Insert menu structure ──────────────────────────────────────────────────────

type InsertItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: { id: string; label: string }[];
};
type InsertSection = { items: InsertItem[] };

const INSERT_SECTIONS: InsertSection[] = [
  {
    items: [
      { id: "rows",    label: "Rows",    icon: Rows3,       sub: [{ id: "row-above", label: "Above" }, { id: "row-below", label: "Below" }] },
      { id: "columns", label: "Columns", icon: Columns3,    sub: [{ id: "col-left",  label: "Left"  }, { id: "col-right", label: "Right" }] },
      { id: "cells",   label: "Cells",   icon: LayoutGrid,  sub: [{ id: "cell-shift-right", label: "Shift right" }, { id: "cell-shift-down", label: "Shift down" }] },
    ],
  },
  {
    items: [
      { id: "chart",   label: "Chart",   icon: BarChart2 },
      { id: "image",   label: "Image",   icon: ImageIcon, sub: [{ id: "image-in-cell", label: "In cell" }, { id: "image-over-cells", label: "Over cells" }] },
    ],
  },
  {
    items: [
      { id: "checkbox", label: "Checkbox", icon: CheckSquare },
      { id: "dropdown", label: "Dropdown", icon: List },
      {
        id: "smart-chips", label: "Smart chips", icon: Tag,
        sub: [
          { id: "chip-people",   label: "People"         },
          { id: "chip-file",     label: "File"           },
          { id: "chip-calendar", label: "Calendar event" },
          { id: "chip-finance",  label: "Finance"        },
        ],
      },
      { id: "link", label: "Link", icon: Link2 },
    ],
  },
  {
    items: [
      { id: "comment", label: "Comment", icon: MessageSquare },
      { id: "note",    label: "Note",    icon: StickyNote },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCellForCsv(value: string | number | boolean | string[] | undefined) {
  if (Array.isArray(value)) return `"${value.join(", ").split('"').join('""')}"`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null) return "";
  return `"${String(value).split('"').join('""')}"`;
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Auto-resize a textarea to fit its content
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ColPanelState {
  open: boolean;
  columnId: string | null;
  name: string;
  type: CRMFieldType;
  options: string[];
  anchor: { top: number; left: number; width: number } | null;
  insertAtIndex: number | null;
}

const CLOSED_PANEL: ColPanelState = {
  open: false, columnId: null, name: "", type: "text", options: [], anchor: null, insertAtIndex: null,
};

interface MultiSelectEdit {
  rowId: string;
  colId: string;
  colOptions: string[];
  selected: string[];
  anchor: { top: number; left: number; width: number };
}

// ── Auto-resize textarea cell ──────────────────────────────────────────────────

function AutoTextarea({
  defaultValue,
  onBlur,
  placeholder,
  type = "text",
  onEnter,
  readOnly = false,
}: {
  defaultValue: string;
  onBlur: (value: string) => void;
  placeholder?: string;
  type?: string;
  onEnter?: () => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) autoResize(ref.current);
  }, []);

  // For non-text types (email, phone, url, number, date) use a plain input
  if (type !== "text") {
    return (
      <input
        type={type}
        defaultValue={defaultValue}
        readOnly={readOnly}
        onBlur={readOnly ? undefined : (e) => onBlur(e.target.value)}
        onKeyDown={readOnly ? undefined : (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onBlur((e.target as HTMLInputElement).value);
            onEnter?.();
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full min-w-[100px] rounded border-0 bg-transparent px-0 py-0.5 text-sm text-foreground outline-none focus:ring-0 placeholder:text-muted-foreground/50",
          readOnly && "cursor-default select-text"
        )}
      />
    );
  }

  return (
    <textarea
      ref={ref}
      defaultValue={defaultValue}
      rows={1}
      readOnly={readOnly}
      onBlur={readOnly ? undefined : (e) => onBlur(e.target.value)}
      onChange={readOnly ? undefined : (e) => autoResize(e.target)}
      onKeyDown={readOnly ? undefined : (e) => {
        // Shift+Enter → normal newline; plain Enter → save & move down
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onBlur((e.target as HTMLTextAreaElement).value);
          onEnter?.();
        }
      }}
      placeholder={placeholder}
      className={cn(
        "w-full min-w-[100px] resize-none overflow-hidden rounded border-0 bg-transparent px-0 py-0.5 text-sm text-foreground outline-none focus:ring-0 placeholder:text-muted-foreground/50",
        readOnly && "cursor-default select-text"
      )}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CRMBuilder() {
  const { user } = useAuth();
  const crm = useCRM();

  // Setup dialog
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupName, setSetupName]     = useState("");
  const [setupCols, setSetupCols]     = useState(6);

  // Sharable users for the Share popover
  const [sharableUsers, setSharableUsers] = useState<SharableUser[]>([]);
  const [sharableLoading, setSharableLoading] = useState(false);

  // Rename dialog
  const [renameDialogOpen, setRenameDialogOpen]   = useState(false);
  const [sheetToRename, setSheetToRename]         = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue]             = useState("");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen]   = useState(false);
  const [sheetToDelete, setSheetToDelete]         = useState<{ id: string; name: string } | null>(null);

  // Column popover
  const [colPanel, setColPanel] = useState<ColPanelState>(CLOSED_PANEL);
  const [newOption, setNewOption] = useState("");

  // Multi-select cell popover
  const [multiSelectEdit, setMultiSelectEdit] = useState<MultiSelectEdit | null>(null);

  // Horizontal scroll
  const scrollRef   = useRef<HTMLDivElement>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [canScroll, setCanScroll] = useState(false);

  // Column resize
  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Row-number column sticky toggle
  const [stickyRowNum, setStickyRowNum] = useState(true);

  // Column drag-to-reorder
  const [localColOrder, setLocalColOrder] = useState<string[] | null>(null);
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const dragDidMoveRef = useRef(false);

  // Row selection (for Ctrl+X cut)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Insert popover
  const [insertMenuOpen, setInsertMenuOpen]   = useState(false);
  const [insertMenuPos,  setInsertMenuPos]    = useState<{ top: number; left: number } | null>(null);
  const [insertSubMenu,  setInsertSubMenu]    = useState<string | null>(null);
  const [insertSubTop,   setInsertSubTop]     = useState(0);

  // Undo / redo
  type HistoryEntry =
    | { type: "reorder_cols"; prevOrder: string[] }
    | { type: "delete_row"; row: CRMRow }
    | { type: "delete_col"; col: CRMColumn; valuesPerRow: Record<string, CRMRow["values"][string]> };
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const isOwner = user?.role === "creator";
  // write access: owner/admin/editor on the active sheet (or list-level for the creator)
  const sheetRole = crm.activeSheet?.user_role ?? null;
  const canWrite = isOwner
    ? (sheetRole === "owner" || sheetRole === "admin" || sheetRole === "editor" || sheetRole === null)
    : (sheetRole === "admin" || sheetRole === "editor");
  const { activeSheet } = crm;

  // Reset per-sheet local state when a different sheet is opened
  useEffect(() => {
    setColumnWidths({});
    setLocalColOrder(null);
    setSelectedRowId(null);
    setUndoStack([]);
    setRedoStack([]);
  }, [activeSheet?.id]);

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScroll(max > 0);
    setScrollPct(max > 0 ? el.scrollLeft / max : 0);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    updateScrollState();
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, activeSheet]);

  const handleScrollSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = Number(e.target.value) / 100;
    el.scrollLeft = pct * (el.scrollWidth - el.clientWidth);
  };

  // ── Column resize ──────────────────────────────────────────────────────────

  const startResize = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[colId] ?? 160;
    resizingRef.current = { colId, startX: e.clientX, startWidth };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { colId: id, startX, startWidth: sw } = resizingRef.current;
      setColumnWidths((p) => ({ ...p, [id]: Math.max(80, sw + ev.clientX - startX) }));
    };

    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [columnWidths]);

  // ── Displayed column order (local drag state) ──────────────────────────────

  const displayedColumns = useMemo(() => {
    if (!activeSheet) return [];
    if (!localColOrder) return activeSheet.columns;
    const inOrder = new Set(localColOrder);
    const ordered = localColOrder
      .map((id) => activeSheet.columns.find((c) => c.id === id))
      .filter(Boolean) as CRMColumn[];
    // Append any columns added after last reorder
    const extras = activeSheet.columns.filter((c) => !inOrder.has(c.id));
    return [...ordered, ...extras];
  }, [activeSheet, localColOrder]);

  // ── History helpers ────────────────────────────────────────────────────────

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setUndoStack((prev) => [...prev.slice(-19), entry]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!activeSheet || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    if (last.type === "reorder_cols") {
      const current = localColOrder ?? activeSheet.columns.map((c) => c.id);
      setRedoStack((prev) => [...prev, { type: "reorder_cols", prevOrder: current }]);
      setLocalColOrder(last.prevOrder);
      toast.success("Undo: column order restored");
    } else if (last.type === "delete_row") {
      try {
        const newRow = await crm.addRow(activeSheet.id, activeSheet.columns);
        await crm.updateRowValues(activeSheet.id, newRow.id, last.row.values);
        setRedoStack((prev) => [...prev, { type: "delete_row", row: { ...last.row, id: newRow.id } }]);
        toast.success("Undo: row restored");
      } catch { toast.error("Undo failed"); }
    } else if (last.type === "delete_col") {
      try {
        const col = await crm.addColumn(activeSheet.id, {
          name: last.col.name, field_type: last.col.field_type,
          options: last.col.options, order: last.col.order,
        });
        for (const [rowId, value] of Object.entries(last.valuesPerRow)) {
          const row = activeSheet.rows.find((r) => r.id === rowId);
          if (row) await crm.updateRowValues(activeSheet.id, rowId, { ...row.values, [col.id]: value });
        }
        setRedoStack((prev) => [...prev, { type: "delete_col", col: { ...last.col, id: col.id }, valuesPerRow: last.valuesPerRow }]);
        toast.success("Undo: column restored");
      } catch { toast.error("Undo failed"); }
    }
  }, [activeSheet, undoStack, localColOrder, crm]);

  const handleRedo = useCallback(async () => {
    if (!activeSheet || redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    if (last.type === "reorder_cols") {
      const current = localColOrder ?? activeSheet.columns.map((c) => c.id);
      setUndoStack((prev) => [...prev, { type: "reorder_cols", prevOrder: current }]);
      setLocalColOrder(last.prevOrder);
      toast.success("Redo: column order re-applied");
    } else if (last.type === "delete_row") {
      try {
        await crm.deleteRow(activeSheet.id, last.row.id);
        setUndoStack((prev) => [...prev, { type: "delete_row", row: last.row }]);
        toast.success("Redo: row re-deleted");
      } catch { toast.error("Redo failed"); }
    } else if (last.type === "delete_col") {
      try {
        await crm.deleteColumn(activeSheet.id, last.col.id);
        setUndoStack((prev) => [...prev, { type: "delete_col", col: last.col, valuesPerRow: last.valuesPerRow }]);
        toast.success("Redo: column re-deleted");
      } catch { toast.error("Redo failed"); }
    }
  }, [activeSheet, redoStack, localColOrder, crm]);

  const handleCut = useCallback(async () => {
    if (!activeSheet) return;
    if (selectedRowId) {
      const row = activeSheet.rows.find((r) => r.id === selectedRowId);
      if (!row) return;
      pushHistory({ type: "delete_row", row });
      try {
        await crm.deleteRow(activeSheet.id, selectedRowId);
        setSelectedRowId(null);
        toast.success("Row cut — Ctrl+Z to undo");
      } catch {
        toast.error("Failed to cut row");
        setUndoStack((prev) => prev.slice(0, -1));
      }
    } else if (colPanel.open && colPanel.columnId) {
      const col = activeSheet.columns.find((c) => c.id === colPanel.columnId);
      if (!col) return;
      const valuesPerRow: Record<string, CRMRow["values"][string]> = {};
      activeSheet.rows.forEach((r) => { valuesPerRow[r.id] = r.values[colPanel.columnId!]; });
      pushHistory({ type: "delete_col", col, valuesPerRow });
      try {
        await crm.deleteColumn(activeSheet.id, colPanel.columnId);
        closeColPanel();
        toast.success("Column cut — Ctrl+Z to undo");
      } catch {
        toast.error("Failed to cut column");
        setUndoStack((prev) => prev.slice(0, -1));
      }
    }
  }, [activeSheet, selectedRowId, colPanel, pushHistory, crm]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeSheet) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") { e.preventDefault(); handleUndo(); }
      else if (ctrl && e.key === "y") { e.preventDefault(); handleRedo(); }
      else if (ctrl && e.key === "x") { e.preventDefault(); handleCut(); }
      else if (e.key === "Escape") { setSelectedRowId(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeSheet, handleUndo, handleRedo, handleCut]);

  // ── Column drag-to-reorder ─────────────────────────────────────────────────

  const handleColDragStart = useCallback((e: React.DragEvent, colId: string) => {
    dragDidMoveRef.current = false;
    setDragColId(colId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleColDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    dragDidMoveRef.current = true;
    e.dataTransfer.dropEffect = "move";
    setDragOverColId(colId);
  }, []);

  const handleColDrop = useCallback((e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!dragColId || dragColId === targetColId || !activeSheet) return;
    const current = localColOrder ?? activeSheet.columns.map((c) => c.id);
    const from = current.indexOf(dragColId);
    const to = current.indexOf(targetColId);
    if (from === -1 || to === -1) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, dragColId);
    pushHistory({ type: "reorder_cols", prevOrder: current });
    setLocalColOrder(next);
    setDragColId(null);
    setDragOverColId(null);
  }, [dragColId, localColOrder, activeSheet, pushHistory]);

  const handleColDragEnd = useCallback(() => {
    setDragColId(null);
    setDragOverColId(null);
    dragDidMoveRef.current = false;
  }, []);

  // ── Panel helpers ──────────────────────────────────────────────────────────

  const openColPanel = (
    col: CRMColumn | null,
    event: React.MouseEvent<HTMLTableCellElement>
  ) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setNewOption("");
    setColPanel({
      open: true,
      columnId: col?.id ?? null,
      name: col?.name ?? "",
      type: col?.field_type ?? "text",
      options: col?.options ?? [],
      anchor: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width },
      insertAtIndex: null,
    });
  };

  const closeColPanel = () => { setColPanel(CLOSED_PANEL); setNewOption(""); };

  const openMultiSelectEdit = (
    e: React.MouseEvent<HTMLDivElement>,
    rowId: string,
    colId: string,
    col: CRMColumn,
    currentValue: string[]
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMultiSelectEdit({
      rowId, colId,
      colOptions: col.options ?? [],
      selected: currentValue,
      anchor: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width },
    });
  };

  const closeMultiSelectEdit = async () => {
    if (!multiSelectEdit || !activeSheet) { setMultiSelectEdit(null); return; }
    await handleCellBlur(multiSelectEdit.rowId, multiSelectEdit.colId, multiSelectEdit.selected);
    setMultiSelectEdit(null);
  };

  // ── Sheet handlers ─────────────────────────────────────────────────────────

  const handleCreateSheet = async () => {
    const name = setupName.trim();
    if (!name) { toast.error("Give your CRM sheet a name"); return; }

    try {
      const created = await crm.createSheet(name);
      const count = Math.max(1, Math.min(20, setupCols));

      await crm.openSheet(created.id);
      const addedCols: CRMColumn[] = [];
      for (let i = 0; i < count; i++) {
        const col = await crm.addColumn(created.id, {
          name: `Column ${i + 1}`,
          field_type: "text" as CRMFieldType,
          options: [],
          order: i,
        });
        addedCols.push(col);
      }
      // Add 2 default empty rows using the columns we just created
      for (let r = 0; r < 2; r++) {
        await crm.addRow(created.id, addedCols);
      }
      await crm.openSheet(created.id);

      setIsSetupOpen(false);
      setSetupName("");
      setSetupCols(6);
      toast.success(`"${name}" created`);
    } catch {
      toast.error("Failed to create sheet");
    }
  };

  const openRenameDialog = (e: React.MouseEvent, sheet: { id: string; name: string }) => {
    e.stopPropagation();
    setSheetToRename(sheet);
    setRenameValue(sheet.name);
    setRenameDialogOpen(true);
  };

  const handleRenameSheet = async () => {
    if (!sheetToRename || !renameValue.trim()) return;
    try {
      await crm.renameSheet(sheetToRename.id, renameValue.trim());
      toast.success("Sheet renamed");
    } catch {
      toast.error("Failed to rename sheet");
    }
    setRenameDialogOpen(false);
    setSheetToRename(null);
  };

  const openDeleteDialog = (e: React.MouseEvent, sheet: { id: string; name: string }) => {
    e.stopPropagation();
    setSheetToDelete(sheet);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSheet = async () => {
    if (!sheetToDelete) return;
    try {
      await crm.deleteSheet(sheetToDelete.id);
      toast.success("Sheet deleted");
    } catch {
      toast.error("Failed to delete sheet");
    }
    setDeleteDialogOpen(false);
    setSheetToDelete(null);
  };

  // ── Column handlers ────────────────────────────────────────────────────────

  const handleSaveColPanel = async () => {
    if (!activeSheet) return;
    const name = colPanel.name.trim();
    if (!name) { toast.error("Column name is required"); return; }

    const options =
      colPanel.type === "single_select" || colPanel.type === "multi_select"
        ? colPanel.options
        : [];

    if ((colPanel.type === "single_select" || colPanel.type === "multi_select") && options.length === 0) {
      toast.error("Add at least one option for dropdown fields");
      return;
    }

    try {
      if (colPanel.columnId) {
        await crm.updateColumn(activeSheet.id, colPanel.columnId, { name, field_type: colPanel.type, options });
        toast.success("Column updated");
      } else if (colPanel.insertAtIndex !== null && colPanel.insertAtIndex < activeSheet.columns.length) {
        await crm.insertColumnAt(
          activeSheet.id,
          { name, field_type: colPanel.type, options },
          activeSheet.columns,
          colPanel.insertAtIndex,
        );
        toast.success(`Column "${name}" added`);
      } else {
        await crm.addColumn(activeSheet.id, {
          name, field_type: colPanel.type, options, order: activeSheet.columns.length,
        });
        toast.success(`Column "${name}" added`);
      }
      closeColPanel();
    } catch {
      toast.error("Failed to save column");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!activeSheet) return;
    try {
      await crm.deleteColumn(activeSheet.id, columnId);
      if (colPanel.columnId === columnId) closeColPanel();
    } catch {
      toast.error("Failed to delete column");
    }
  };

  // ── Row handlers ───────────────────────────────────────────────────────────

  const handleAddRow = async () => {
    if (!activeSheet) return;
    try { await crm.addRow(activeSheet.id, activeSheet.columns); }
    catch { toast.error("Failed to add row"); }
  };

  const closeInsertMenu = () => {
    setInsertMenuOpen(false);
    setInsertSubMenu(null);
  };

  const handleInsertAction = async (actionId: string) => {
    closeInsertMenu();
    if (!activeSheet) return;

    switch (actionId) {
      case "row-above": {
        const idx = selectedRowId
          ? activeSheet.rows.findIndex((r) => r.id === selectedRowId)
          : -1;
        const insertIndex = idx >= 0 ? idx : 0;
        try {
          await crm.insertRowAt(activeSheet.id, activeSheet.columns, activeSheet.rows, insertIndex);
          toast.success("Row added above");
        } catch { toast.error("Failed to add row"); }
        break;
      }
      case "row-below": {
        const idx = selectedRowId
          ? activeSheet.rows.findIndex((r) => r.id === selectedRowId)
          : -1;
        const insertIndex = idx >= 0 ? idx + 1 : activeSheet.rows.length;
        try {
          await crm.insertRowAt(activeSheet.id, activeSheet.columns, activeSheet.rows, insertIndex);
          toast.success("Row added below");
        } catch { toast.error("Failed to add row"); }
        break;
      }
      case "col-left":
      case "col-right": {
        const refIdx = colPanel.columnId
          ? activeSheet.columns.findIndex((c) => c.id === colPanel.columnId)
          : -1;
        const insertIndex = actionId === "col-left"
          ? (refIdx >= 0 ? refIdx : 0)
          : (refIdx >= 0 ? refIdx + 1 : activeSheet.columns.length);
        const anchor = insertMenuPos
          ? { top: insertMenuPos.top, left: insertMenuPos.left, width: 208 }
          : null;
        setColPanel({ open: true, columnId: null, name: "", type: "text", options: [], anchor, insertAtIndex: insertIndex });
        break;
      }
      case "checkbox": {
        try {
          await crm.addColumn(activeSheet.id, {
            name: "Checkbox",
            field_type: "checkbox",
            options: [],
            order: activeSheet.columns.length,
          });
          toast.success("Checkbox column added");
        } catch { toast.error("Failed to add column"); }
        break;
      }
      case "dropdown": {
        setColPanel({
          open: true,
          columnId: null,
          name: "",
          type: "single_select",
          options: [],
          anchor: insertMenuPos
            ? { top: insertMenuPos.top, left: insertMenuPos.left, width: 208 }
            : null,
          insertAtIndex: null,
        });
        break;
      }
      default:
        toast.info("Coming soon");
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!activeSheet) return;
    try { await crm.deleteRow(activeSheet.id, rowId); }
    catch { toast.error("Failed to delete row"); }
  };

  const handleCellBlur = async (rowId: string, colId: string, nextValue: string | number | boolean | string[]) => {
    if (!activeSheet) return;
    const row = activeSheet.rows.find((r) => r.id === rowId);
    if (!row) return;
    try { await crm.updateRowValues(activeSheet.id, rowId, { ...row.values, [colId]: nextValue }); }
    catch { toast.error("Failed to save cell"); }
  };

  const handleCellEnter = useCallback((rowIdx: number, colIdx: number) => {
    const nextTd = document.querySelector<HTMLElement>(
      `[data-rowidx="${rowIdx + 1}"][data-colidx="${colIdx}"]`
    );
    if (!nextTd) return;
    const focusable = nextTd.querySelector<HTMLElement>("input, textarea, select");
    if (!focusable) return;
    focusable.focus();
    if (focusable instanceof HTMLInputElement || focusable instanceof HTMLTextAreaElement) {
      focusable.select();
    }
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportCsv = () => {
    if (!activeSheet) return;
    const header = activeSheet.columns.map((c) => `"${c.name.split('"').join('""')}"`).join(",");
    const body = activeSheet.rows
      .map((row) => activeSheet.columns.map((c) => formatCellForCsv(row.values[c.id])).join(","))
      .join("\n");
    triggerDownload(
      `${activeSheet.name.toLowerCase().replace(/\s+/g, "_")}_export.csv`,
      `${header}\n${body}`,
      "text/csv;charset=utf-8;"
    );
    toast.success("CSV exported");
  };

  const exportJson = () => {
    if (!activeSheet) return;
    triggerDownload(
      `${activeSheet.name.toLowerCase().replace(/\s+/g, "_")}_backup.json`,
      JSON.stringify({ sheetName: activeSheet.name, columns: activeSheet.columns, rows: activeSheet.rows, exportedAt: new Date().toISOString() }, null, 2),
      "application/json;charset=utf-8;"
    );
    toast.success("JSON backup exported");
  };

  // ── Guard: non-creators with no shared sheets ──────────────────────────────

  if (!isOwner && !crm.isLoading && crm.sheets.length === 0) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[480px] text-center p-8">
          <div className="rounded-2xl bg-muted/50 p-5 mb-5">
            <Lock className="h-14 w-14 text-muted-foreground/60" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">No sheets shared with you yet</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
            Once your creator shares a CRM sheet with you, it'll show up right here.
          </p>
        </div>
      </MainLayout>
    );
  }

  if (crm.isDetailLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────

  if (activeSheet) {
    return (
      <MainLayout>
        <div className="space-y-5 animate-fade-in w-full min-w-0">

          {/* Header row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                onClick={crm.closeSheet}
              >
                <ArrowLeft className="h-4 w-4" />
                All Sheets
              </Button>
              <span className="text-muted-foreground/40">/</span>
              <h1 className="text-lg font-bold text-foreground truncate">{activeSheet.name}</h1>
              {!canWrite && (
                <Badge variant="secondary" className="gap-1 shrink-0">
                  <Eye className="h-3 w-3" />
                  View only
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Share — owner only */}
              {activeSheet.user_role === "owner" && (
                <Popover onOpenChange={async (open) => {
                  if (open && sharableUsers.length === 0) {
                    setSharableLoading(true);
                    try {
                      const users = await crm.fetchSharableUsers();
                      setSharableUsers(users);
                    } finally {
                      setSharableLoading(false);
                    }
                  }
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5" title="Manage access">
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-0">
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="font-semibold text-sm text-foreground">Manage Access</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Share with your team members and clients
                      </p>
                    </div>
                    <div className="px-4 py-3 max-h-72 overflow-y-auto">
                      {sharableLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : sharableUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No team members or clients found. Hire talent or onboard clients first.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {sharableUsers.map((u) => {
                            const existing = activeSheet.access_list.find((a) => a.user === u.user_id);
                            return (
                              <div key={u.user_id} className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
                                        {u.type === "team" ? "Team" : "Client"}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <select
                                  value={existing?.role ?? "none"}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    try {
                                      if (val === "none") {
                                        if (existing) {
                                          await crm.revokeAccess(activeSheet.id, existing.id);
                                          toast.success(`Access removed for ${u.name}`);
                                        }
                                      } else {
                                        await crm.upsertAccess(activeSheet.id, u.user_id, val as AccessRole, existing?.id);
                                        toast.success(`${u.name} set as ${val}`);
                                      }
                                    } catch {
                                      toast.error("Failed to update access");
                                    }
                                  }}
                                  className="h-8 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                                >
                                  <option value="none">No access</option>
                                  <option value="viewer">Viewer</option>
                                  <option value="editor">Editor</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Insert button — write access only */}
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setInsertMenuPos({ top: rect.bottom + 4, left: rect.left });
                    setInsertMenuOpen((v) => !v);
                    setInsertSubMenu(null);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Insert
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              )}

              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportJson}>
                <Download className="h-3.5 w-3.5" />
                JSON
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden w-full min-w-0">

            {/* Horizontal-only scroll area */}
            <div
              ref={scrollRef}
              className="overflow-x-auto overflow-y-hidden w-full max-w-full min-w-0"
              style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
            >
              <table
                className="text-sm border-collapse"
                style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}
              >
                {/* colgroup drives exact column widths for table-layout:fixed */}
                <colgroup>
                  {/* row-number col */}
                  <col style={{ width: 44 }} />
                  {displayedColumns.map((col) => (
                    <col key={col.id} style={{ width: columnWidths[col.id] ?? 160 }} />
                  ))}
                  {/* add-column col */}
                  <col style={{ width: 44 }} />
                  {/* delete-row col */}
                  <col style={{ width: 36 }} />
                </colgroup>

                <thead className="bg-secondary/50">
                  <tr>
                    {/* Row-number header — padlock toggles column stickiness */}
                    <th className={cn(
                      "bg-secondary/50 border border-border px-2 py-2.5 text-center select-none",
                      stickyRowNum && "sticky left-0 z-10"
                    )}>
                      <button
                        onClick={() => setStickyRowNum((v) => !v)}
                        title={stickyRowNum ? "Unpin row numbers" : "Pin row numbers"}
                        className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        {stickyRowNum
                          ? <Lock className="h-3 w-3" />
                          : <LockOpen className="h-3 w-3" />
                        }
                      </button>
                    </th>

                    {displayedColumns.map((col) => (
                      <th
                        key={col.id}
                        draggable={canWrite}
                        onDragStart={canWrite ? (e) => handleColDragStart(e, col.id) : undefined}
                        onDragOver={canWrite ? (e) => handleColDragOver(e, col.id) : undefined}
                        onDrop={canWrite ? (e) => handleColDrop(e, col.id) : undefined}
                        onDragEnd={canWrite ? handleColDragEnd : undefined}
                        onClick={canWrite ? (e) => openColPanel(col, e) : undefined}
                        className={cn(
                          "relative bg-secondary/50 border border-border py-2.5 text-left font-semibold text-foreground group/th transition-colors select-none overflow-hidden",
                          canWrite && "cursor-grab active:cursor-grabbing hover:bg-secondary",
                          !canWrite && "cursor-default",
                          dragColId === col.id && "opacity-40 bg-primary/5",
                          dragOverColId === col.id && dragColId !== col.id && "bg-primary/15 border-primary/50",
                          colPanel.open && colPanel.columnId === col.id && "bg-primary/10"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 px-3">
                          <span className="text-sm truncate">{col.name}</span>
                          {canWrite && (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover/th:opacity-70 text-muted-foreground transition-opacity" />
                          )}
                        </div>
                        {/* Drag-to-resize handle (right edge) */}
                        <div
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
                          onMouseDown={(e) => startResize(e, col.id)}
                          onClick={(e) => e.stopPropagation()}
                          onDragStart={(e) => e.stopPropagation()}
                        />
                      </th>
                    ))}

                    {/* Add-column — write access only */}
                    {canWrite ? (
                      <th
                        onClick={(e) => openColPanel(null, e)}
                        title="Add column"
                        className="bg-secondary/50 border border-border px-2 py-2.5 text-center cursor-pointer text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="h-4 w-4 mx-auto" />
                      </th>
                    ) : (
                      <th className="bg-secondary/50 border border-border" />
                    )}

                    {/* Delete-row col header */}
                    <th className="bg-secondary/50 border border-border" />
                  </tr>
                </thead>

                <tbody>
                  {activeSheet.rows.map((row, rowIdx) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "group/row hover:bg-secondary/10 transition-colors",
                        selectedRowId === row.id && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                      )}
                    >

                      {/* Sticky row number — click to select row for Ctrl+X */}
                      <td
                        className={cn(
                          "border border-border px-2 py-1.5 text-center text-xs text-muted-foreground select-none transition-colors cursor-pointer hover:bg-primary/10",
                          stickyRowNum
                            ? "sticky left-0 z-[5] bg-card group-hover/row:bg-secondary/10"
                            : "bg-secondary/20",
                          selectedRowId === row.id && "bg-primary/15 text-primary font-semibold"
                        )}
                        onClick={() => setSelectedRowId((prev) => prev === row.id ? null : row.id)}
                        title="Click to select • Ctrl+X to cut"
                      >
                        {rowIdx + 1}
                      </td>

                      {displayedColumns.map((col, colIdx) => (
                        <td
                          key={`${row.id}_${col.id}`}
                          data-rowidx={rowIdx}
                          data-colidx={colIdx}
                          className="border border-border px-3 py-1.5 align-top overflow-hidden"
                        >
                          {col.field_type === "checkbox" ? (
                            <div className="flex items-center h-7">
                              <input
                                type="checkbox"
                                checked={Boolean(row.values[col.id])}
                                disabled={!canWrite}
                                onChange={canWrite ? (e) => handleCellBlur(row.id, col.id, e.target.checked) : undefined}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCellEnter(rowIdx, colIdx); } }}
                                className="h-4 w-4 accent-primary disabled:opacity-60"
                              />
                            </div>
                          ) : col.field_type === "single_select" ? (
                            <select
                              defaultValue={String(row.values[col.id] || "")}
                              disabled={!canWrite}
                              onBlur={canWrite ? (e) => handleCellBlur(row.id, col.id, e.target.value) : undefined}
                              onChange={canWrite ? (e) => handleCellBlur(row.id, col.id, e.target.value) : undefined}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCellEnter(rowIdx, colIdx); } }}
                              className="h-7 w-full rounded border border-input bg-background px-2 text-sm disabled:opacity-60 disabled:cursor-default"
                            >
                              <option value="">Select…</option>
                              {(col.options || []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : col.field_type === "multi_select" ? (
                            <div
                              className={cn(
                                "min-h-[28px] flex flex-wrap gap-1 items-center py-0.5",
                                canWrite && "cursor-pointer"
                              )}
                              onClick={canWrite ? (e) => {
                                const current = Array.isArray(row.values[col.id])
                                  ? (row.values[col.id] as string[])
                                  : [];
                                openMultiSelectEdit(e, row.id, col.id, col, current);
                              } : undefined}
                            >
                              {Array.isArray(row.values[col.id]) && (row.values[col.id] as string[]).length > 0 ? (
                                (row.values[col.id] as string[]).map((v) => (
                                  <span key={v} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                                    {v}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground/50">{canWrite ? "Select…" : "—"}</span>
                              )}
                            </div>
                          ) : (
                            <AutoTextarea
                              type={
                                col.field_type === "number" ? "number"
                                : col.field_type === "date"   ? "date"
                                : col.field_type === "url"    ? "url"
                                : col.field_type === "email"  ? "email"
                                : "text"
                              }
                              defaultValue={String(row.values[col.id] ?? "")}
                              readOnly={!canWrite}
                              onBlur={canWrite ? (v) => {
                                const value = col.field_type === "number" ? Number(v) : v;
                                handleCellBlur(row.id, col.id, value);
                              } : () => {}}
                              onEnter={() => handleCellEnter(rowIdx, colIdx)}
                              placeholder={canWrite ? col.name : ""}
                            />
                          )}
                        </td>
                      ))}

                      {/* Spacer under add-column header */}
                      <td className="border border-border" />

                      {/* Delete row — write access only */}
                      <td className="border border-border px-1 py-1 text-center align-middle">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity"
                            onClick={() => handleDeleteRow(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Horizontal scroll slider — tracks scrollRef.scrollLeft */}
            {canScroll && (
              <div className="border-t border-border/40 px-3 py-1.5 flex items-center gap-2 bg-secondary/20">
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(scrollPct * 100)}
                  onChange={handleScrollSlider}
                  className="flex-1 h-1 accent-primary cursor-pointer"
                />
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            )}

            {/* Add record — write access only */}
            {canWrite && (
              <div className="border-t border-border p-3">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleAddRow}>
                  <Plus className="h-3.5 w-3.5" />
                  Add row
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Multi-select cell popover ─────────────────────────────────────── */}
        {multiSelectEdit && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeMultiSelectEdit} />
            <div
              className="fixed z-50 w-52 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
              style={{
                top: multiSelectEdit.anchor.top + 4,
                left: Math.min(
                  multiSelectEdit.anchor.left,
                  window.innerWidth - 220
                ),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Select Options
                </span>
                <button
                  onClick={closeMultiSelectEdit}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-1.5 space-y-0.5 max-h-52 overflow-y-auto">
                {multiSelectEdit.colOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                    No options defined. Edit the column header to add some.
                  </p>
                ) : (
                  multiSelectEdit.colOptions.map((opt) => {
                    const isSelected = multiSelectEdit.selected.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() =>
                          setMultiSelectEdit((p) =>
                            p && {
                              ...p,
                              selected: isSelected
                                ? p.selected.filter((v) => v !== opt)
                                : [...p.selected, opt],
                            }
                          )
                        }
                        className={cn(
                          "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-secondary text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center transition-colors",
                            isSelected ? "bg-primary border-primary" : "border-border"
                          )}
                        >
                          {isSelected && (
                            <span className="text-primary-foreground text-[8px] font-bold leading-none">✓</span>
                          )}
                        </div>
                        <span className="truncate">{opt}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {multiSelectEdit.selected.length > 0 && (
                <div className="px-2 py-1.5 border-t border-border/60 flex flex-wrap gap-1">
                  {multiSelectEdit.selected.map((v) => (
                    <span key={v} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Insert menu ───────────────────────────────────────────────────── */}
        {insertMenuOpen && insertMenuPos && (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-40" onClick={closeInsertMenu} />

            {/* Primary popover */}
            <div
              className="fixed z-50 w-52 rounded-xl border border-border bg-card shadow-xl overflow-hidden py-1"
              style={{
                top:  insertMenuPos.top,
                left: Math.min(insertMenuPos.left, window.innerWidth - 220),
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseLeave={() => setInsertSubMenu(null)}
            >
              {INSERT_SECTIONS.map((section, si) => (
                <div key={si}>
                  {si > 0 && <div className="my-1 mx-2 border-t border-border/50" />}
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const hasSub = !!(item.sub && item.sub.length > 0);
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                          insertSubMenu === item.id
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-secondary"
                        )}
                        onMouseEnter={(e) => {
                          if (hasSub) {
                            setInsertSubMenu(item.id);
                            setInsertSubTop(e.currentTarget.getBoundingClientRect().top);
                          } else {
                            setInsertSubMenu(null);
                          }
                        }}
                        onClick={() => {
                          if (!hasSub) handleInsertAction(item.id);
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1">{item.label}</span>
                        {hasSub && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Nested sub-menu */}
            {insertSubMenu && (() => {
              const parentItem = INSERT_SECTIONS.flatMap((s) => s.items).find((i) => i.id === insertSubMenu);
              if (!parentItem?.sub) return null;
              const menuLeft = Math.min(insertMenuPos.left, window.innerWidth - 220);
              const subLeft  = Math.min(menuLeft + 212, window.innerWidth - 192);
              return (
                <div
                  className="fixed z-50 w-44 rounded-xl border border-border bg-card shadow-xl overflow-hidden py-1"
                  style={{ top: insertSubTop, left: subLeft }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={() => setInsertSubMenu(insertSubMenu)}
                >
                  {parentItem.sub.map((sub) => (
                    <button
                      key={sub.id}
                      className="w-full flex items-center px-3 py-2 text-sm text-left text-foreground hover:bg-secondary transition-colors"
                      onClick={() => handleInsertAction(sub.id)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ── Inline column popover (Notion-style) ──────────────────────────── */}
        {colPanel.open && colPanel.anchor && (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-40" onClick={closeColPanel} />

            {/* Popover box */}
            <div
              className="fixed z-50 w-64 rounded-xl border border-border bg-card shadow-xl"
              style={{
                top:  colPanel.anchor.top + 4,
                left: Math.min(
                  colPanel.anchor.left,
                  window.innerWidth - 272
                ),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {colPanel.columnId ? "Edit Column" : "New Column"}
                </span>
                <button
                  onClick={closeColPanel}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-3 space-y-3">
                {/* Column name */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Column Name
                  </label>
                  <input
                    autoFocus
                    value={colPanel.name}
                    onChange={(e) => setColPanel((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveColPanel();
                      if (e.key === "Escape") closeColPanel();
                    }}
                    placeholder="e.g. Lead Source"
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Field type */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Field Type
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {FIELD_TYPES.map((ft) => (
                      <button
                        key={ft.value}
                        onClick={() => setColPanel((p) => ({ ...p, type: ft.value }))}
                        className={cn(
                          "px-2 py-1.5 rounded-md text-xs text-left transition-colors",
                          colPanel.type === ft.value
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-foreground hover:bg-secondary border border-border/50"
                        )}
                      >
                        {ft.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options — dropdown / multi-select only */}
                {(colPanel.type === "single_select" || colPanel.type === "multi_select") && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Options
                    </label>
                    {/* Tag chips */}
                    {colPanel.options.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {colPanel.options.map((opt, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground border border-border/60"
                          >
                            {opt}
                            <button
                              type="button"
                              onClick={() =>
                                setColPanel((p) => ({ ...p, options: p.options.filter((_, j) => j !== i) }))
                              }
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Add input */}
                    <div className="flex items-stretch gap-1">
                      <input
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newOption.trim()) {
                            e.preventDefault();
                            setColPanel((p) => ({ ...p, options: [...p.options, newOption.trim()] }));
                            setNewOption("");
                          }
                        }}
                        placeholder="Type option, press Enter"
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newOption.trim()) {
                            setColPanel((p) => ({ ...p, options: [...p.options, newOption.trim()] }));
                            setNewOption("");
                          }
                        }}
                        className="shrink-0 rounded-md border border-input bg-background px-2 py-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                <Button size="sm" className="w-full gap-1.5" onClick={handleSaveColPanel}>
                  {colPanel.columnId ? "Update Column" : <><Plus className="h-3.5 w-3.5" />Add Column</>}
                </Button>
                {colPanel.columnId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => colPanel.columnId && handleDeleteColumn(colPanel.columnId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Column
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </MainLayout>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 sm:space-y-8">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">CRM Builder</h1>
            <p className="mt-1 text-muted-foreground">
              {isOwner
                ? "Manage your CRM sheets, click any card to open it."
                : "Sheets shared with you — click any card to open it."}
            </p>
          </div>
          {isOwner && (
            <Button className="gap-2 w-full sm:w-auto" onClick={() => setIsSetupOpen(true)}>
              <Plus className="h-4 w-4" />
              New CRM Sheet
            </Button>
          )}
        </div>

        {crm.isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : crm.sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 sm:p-14 text-center min-h-[420px] border-2 border-dashed border-border/60 rounded-2xl bg-secondary/20">
            <div className="rounded-2xl bg-primary/10 p-5 mb-5">
              <FileSpreadsheet className="h-14 w-14 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Create your first CRM sheet</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
              Track contacts, deals, and pipelines — fully customised with your own columns and fields.
            </p>
            <Button size="lg" className="gap-2 text-base px-8" onClick={() => setIsSetupOpen(true)}>
              <Sparkles className="h-5 w-5" />
              Create My First CRM
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Takes less than a minute</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {crm.sheets.map((sheet) => (
              <div
                key={sheet.id}
                onClick={() => crm.openSheet(sheet.id)}
                className="cursor-pointer p-6 rounded-lg border group hover:border-primary/50 transition-colors"
              >
                <div className="flex justify-between mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{sheet.name}</h3>
                      {sheet.user_role !== "owner" && (
                        <Badge variant="secondary" className="gap-1 text-[10px] mt-0.5">
                          <Users className="h-2.5 w-2.5" />
                          Shared · {sheet.user_role}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); crm.openSheet(sheet.id); }}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />Open CRM
                      </DropdownMenuItem>
                      {sheet.user_role === "owner" && (
                        <>
                          <DropdownMenuItem onClick={(e) => openRenameDialog(e, { id: sheet.id, name: sheet.name })}>
                            <Pencil className="h-4 w-4 mr-2" />Rename Sheet
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => openDeleteDialog(e, { id: sheet.id, name: sheet.name })}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Delete Sheet
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Rows3 className="h-3.5 w-3.5" />
                    <span>{sheet.row_count} record{sheet.row_count !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-border">·</span>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Columns3 className="h-3.5 w-3.5" />
                    <span>{sheet.column_count} column{sheet.column_count !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-5 min-h-[28px]">
                  {sheet.column_names.slice(0, 4).map((name) => (
                    <span key={name} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{name}</span>
                  ))}
                  {sheet.column_count > 4 && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">+{sheet.column_count - 4} more</span>
                  )}
                </div>

                <div className="flex items-center justify-end pt-2 mt-1 border-t border-border/40">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    Open CRM
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Setup dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Create a CRM Sheet
            </DialogTitle>
            <DialogDescription>Name your sheet and choose how many columns to start with.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="setup-name">Sheet Name</Label>
              <Input
                id="setup-name"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="e.g. Agency CRM, Q3 Pipeline…"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateSheet(); }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-cols">Starting Columns</Label>
              <Input
                id="setup-cols"
                type="number"
                min={1}
                max={20}
                value={setupCols}
                onChange={(e) => setSetupCols(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                1 – 20 empty columns. Click any column header to set its name and type. Starts with 2 empty rows.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setIsSetupOpen(false)}>Cancel</Button>
              <Button className="gap-2" onClick={handleCreateSheet}>
                <Plus className="h-4 w-4" />Create Sheet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rename dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Sheet</DialogTitle>
            <DialogDescription>Enter a new name for "{sheetToRename?.name}".</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input">Sheet Name</Label>
            <Input
              id="rename-input"
              className="mt-2"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSheet()}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameSheet} disabled={!renameValue.trim()}>Rename</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ────────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sheetToDelete?.name}"? All records will be permanently lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSheet}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
