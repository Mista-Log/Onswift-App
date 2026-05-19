import { useMemo, useState } from "react";
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
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useCRM, CRMFieldType } from "@/hooks/useCRM";
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
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const PRESET_COLUMNS = [
  { name: "Name", field_type: "text" as CRMFieldType, options: [] },
  { name: "Email", field_type: "email" as CRMFieldType, options: [] },
  { name: "Status", field_type: "single_select" as CRMFieldType, options: ["New", "Active", "Paused", "Won"] },
  { name: "Last Contact", field_type: "date" as CRMFieldType, options: [] },
  { name: "Deal Value", field_type: "number" as CRMFieldType, options: [] },
  { name: "Priority", field_type: "checkbox" as CRMFieldType, options: [] },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CRMBuilder() {
  const { user } = useAuth();
  const { teamMembers } = useTeam();
  const crm = useCRM();

  // Setup dialog
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupCols, setSetupCols] = useState(6);

  // Add-column dialog
  const [isAddColOpen, setIsAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<CRMFieldType>("text");
  const [newColOptions, setNewColOptions] = useState("");

  // Rename dialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sheetToRename, setSheetToRename] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<{ id: string; name: string } | null>(null);

  // Inline column-header editing
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState("");

  const canManageTools = user?.role === "creator";
  const { activeSheet } = crm;

  const totalValue = useMemo(() => {
    if (!activeSheet) return 0;
    const dealValueCol = activeSheet.columns.find(
      (c) => c.name.toLowerCase().replace(/\s+/g, "_") === "deal_value" || c.name === "Deal Value"
    );
    if (!dealValueCol) return 0;
    return activeSheet.rows.reduce((sum, row) => {
      const raw = row.values[dealValueCol.id];
      if (typeof raw === "number") return sum + raw;
      if (typeof raw === "string") {
        const n = Number(raw);
        return Number.isNaN(n) ? sum : sum + n;
      }
      return sum;
    }, 0);
  }, [activeSheet]);

  // ── Sheet handlers ──────────────────────────────────────────────────────────

  const handleCreateSheet = async () => {
    const name = setupName.trim();
    if (!name) { toast.error("Give your CRM sheet a name"); return; }

    try {
      const created = await crm.createSheet(name);
      // Add preset columns after creation
      const count = Math.max(1, Math.min(20, setupCols));
      const presets = PRESET_COLUMNS.slice(0, Math.min(count, PRESET_COLUMNS.length));
      const extras = count > PRESET_COLUMNS.length
        ? Array.from({ length: count - PRESET_COLUMNS.length }, (_, i) => ({
            name: `Column ${PRESET_COLUMNS.length + i + 1}`,
            field_type: "text" as CRMFieldType,
            options: [],
          }))
        : [];

      // Open the sheet detail, then add columns
      await crm.openSheet(created.id);
      for (let i = 0; i < presets.length + extras.length; i++) {
        const col = i < presets.length ? presets[i] : extras[i - presets.length];
        await crm.addColumn(created.id, { ...col, order: i });
      }
      // Refresh detail to pick up all columns
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

  // ── Column handlers ─────────────────────────────────────────────────────────

  const handleAddColumn = async () => {
    if (!activeSheet) return;
    const name = newColName.trim();
    if (!name) { toast.error("Column name is required"); return; }

    const options =
      newColType === "single_select" || newColType === "multi_select"
        ? newColOptions.split(",").map((v) => v.trim()).filter(Boolean)
        : [];

    if ((newColType === "single_select" || newColType === "multi_select") && options.length === 0) {
      toast.error("Add at least one option for dropdown fields");
      return;
    }

    try {
      await crm.addColumn(activeSheet.id, {
        name,
        field_type: newColType,
        options,
        order: activeSheet.columns.length,
      });
      setNewColName("");
      setNewColType("text");
      setNewColOptions("");
      setIsAddColOpen(false);
      toast.success(`Column "${name}" added`);
    } catch {
      toast.error("Failed to add column");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!activeSheet) return;
    try {
      await crm.deleteColumn(activeSheet.id, columnId);
    } catch {
      toast.error("Failed to delete column");
    }
  };

  const commitColumnRename = async (colId: string) => {
    const trimmed = editingColName.trim();
    setEditingColId(null);
    if (!trimmed || !activeSheet) return;
    const col = activeSheet.columns.find((c) => c.id === colId);
    if (col?.name === trimmed) return;
    try {
      await crm.renameColumn(activeSheet.id, colId, trimmed);
      toast.success("Column renamed");
    } catch {
      toast.error("Failed to rename column");
    }
  };

  // ── Row handlers ────────────────────────────────────────────────────────────

  const handleAddRow = async () => {
    if (!activeSheet) return;
    try {
      await crm.addRow(activeSheet.id, activeSheet.columns);
    } catch {
      toast.error("Failed to add row");
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!activeSheet) return;
    try {
      await crm.deleteRow(activeSheet.id, rowId);
    } catch {
      toast.error("Failed to delete row");
    }
  };

  const handleCellBlur = async (
    rowId: string,
    colId: string,
    nextValue: string | number | boolean | string[]
  ) => {
    if (!activeSheet) return;
    const row = activeSheet.rows.find((r) => r.id === rowId);
    if (!row) return;
    const updated = { ...row.values, [colId]: nextValue };
    try {
      await crm.updateRowValues(activeSheet.id, rowId, updated);
    } catch {
      toast.error("Failed to save cell");
    }
  };

  // ── Export helpers ──────────────────────────────────────────────────────────

  const exportCsv = () => {
    if (!activeSheet) return;
    const header = activeSheet.columns.map((c) => `"${c.name.split('"').join('""')}"`).join(",");
    const body = activeSheet.rows
      .map((row) => activeSheet.columns.map((c) => formatCellForCsv(row.values[c.id])).join(","))
      .join("\n");
    const slug = activeSheet.name.toLowerCase().replace(/\s+/g, "_");
    triggerDownload(`${slug}_export.csv`, `${header}\n${body}`, "text/csv;charset=utf-8;");
    toast.success("CSV exported");
  };

  const exportJson = () => {
    if (!activeSheet) return;
    const payload = {
      sheetName: activeSheet.name,
      columns: activeSheet.columns,
      rows: activeSheet.rows,
      exportedAt: new Date().toISOString(),
    };
    const slug = activeSheet.name.toLowerCase().replace(/\s+/g, "_");
    triggerDownload(
      `${slug}_backup.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8;"
    );
    toast.success("JSON backup exported");
  };

  const openPrintForPdf = () => {
    if (!activeSheet) return;
    toast.message("Use Print → Save as PDF in the next dialog");
    window.print();
  };

  // ── Guard ───────────────────────────────────────────────────────────────────

  if (!canManageTools) {
    return (
      <MainLayout>
        <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">CRM Builder</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This tool is currently available to creator accounts.
          </p>
        </div>
      </MainLayout>
    );
  }

  // ── Detail view (spreadsheet) ───────────────────────────────────────────────

  if (crm.isDetailLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (activeSheet) {
    return (
      <MainLayout>
        <div className="space-y-6 animate-fade-in">

          {/* Detail header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={crm.closeSheet}
              >
                <ArrowLeft className="h-4 w-4" />
                All CRM Sheets
              </Button>
              <span className="text-muted-foreground/40">/</span>
              <h1 className="text-xl font-bold text-foreground">{activeSheet.name}</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setIsAddColOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Column
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportJson}>
                <Download className="h-4 w-4" />
                Backup JSON
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Records</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{activeSheet.rows.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Columns</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{activeSheet.columns.length}</p>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {activeSheet.columns.map((col) => (
                      <th
                        key={col.id}
                        className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap"
                      >
                        <div className="flex items-center justify-between gap-2">
                          {editingColId === col.id ? (
                            <input
                              autoFocus
                              className="w-full rounded border border-primary/50 bg-background px-1.5 py-0.5 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
                              value={editingColName}
                              onChange={(e) => setEditingColName(e.target.value)}
                              onBlur={() => commitColumnRename(col.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitColumnRename(col.id);
                                if (e.key === "Escape") setEditingColId(null);
                              }}
                            />
                          ) : (
                            <span
                              className="cursor-pointer select-none"
                              onDoubleClick={() => {
                                setEditingColId(col.id);
                                setEditingColName(col.name);
                              }}
                              title="Double-click to rename"
                            >
                              {col.name}
                            </span>
                          )}
                          <button
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleDeleteColumn(col.id)}
                            aria-label={`Delete ${col.name} column`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.rows.map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      {activeSheet.columns.map((col) => (
                        <td key={`${row.id}_${col.id}`} className="px-3 py-2 align-top">
                          {col.field_type === "checkbox" ? (
                            <input
                              type="checkbox"
                              checked={Boolean(row.values[col.id])}
                              onChange={(e) =>
                                handleCellBlur(row.id, col.id, e.target.checked)
                              }
                              className="h-4 w-4"
                            />
                          ) : col.field_type === "single_select" ? (
                            <select
                              defaultValue={String(row.values[col.id] || "")}
                              onBlur={(e) => handleCellBlur(row.id, col.id, e.target.value)}
                              onChange={(e) => handleCellBlur(row.id, col.id, e.target.value)}
                              className="h-9 w-full rounded-md border border-input bg-background px-2"
                            >
                              <option value="">Select...</option>
                              {(col.options || []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : col.field_type === "multi_select" ? (
                            <Input
                              defaultValue={
                                Array.isArray(row.values[col.id])
                                  ? (row.values[col.id] as string[]).join(", ")
                                  : ""
                              }
                              onBlur={(e) =>
                                handleCellBlur(
                                  row.id,
                                  col.id,
                                  e.target.value.split(",").map((v) => v.trim()).filter(Boolean)
                                )
                              }
                              placeholder="Comma-separated"
                            />
                          ) : (
                            <Input
                              type={
                                col.field_type === "number" ? "number"
                                : col.field_type === "date" ? "date"
                                : "text"
                              }
                              defaultValue={String(row.values[col.id] ?? "")}
                              onBlur={(e) => {
                                const value = col.field_type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value;
                                handleCellBlur(row.id, col.id, value);
                              }}
                              placeholder={`Enter ${col.name.toLowerCase()}`}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(row.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border/60 p-3">
              <Button variant="outline" className="gap-2" onClick={handleAddRow}>
                <Plus className="h-4 w-4" />
                Add Record
              </Button>
            </div>
          </div>

          {/* Sharing */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Sharing Access</h2>
            </div>

            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No team members found yet. Invite teammates to assign CRM access roles.
              </p>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => {
                  const existing = activeSheet.access_list.find((a) => a.user === member.user_id);
                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <select
                        value={existing?.role ?? "viewer"}
                        onChange={async (e) => {
                          const role = e.target.value as "viewer" | "editor" | "admin";
                          try {
                            await crm.upsertAccess(activeSheet.id, member.user_id, role, existing?.id);
                            toast.success(`${member.name} set as ${role}`);
                          } catch {
                            toast.error("Failed to update access");
                          }
                        }}
                        className="h-9 min-w-36 rounded-md border border-input bg-background px-2 text-sm"
                      >
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
        </div>

        {/* Add column dialog */}
        <Dialog open={isAddColOpen} onOpenChange={setIsAddColOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Column</DialogTitle>
              <DialogDescription>
                Add a new field to <strong>{activeSheet.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="col-name">Column Name</Label>
                  <Input
                    id="col-name"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="e.g. Lead Source"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); }}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-type">Type</Label>
                  <select
                    id="col-type"
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value as CRMFieldType)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="single_select">Dropdown</option>
                    <option value="multi_select">Multi-select</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="col-options">Options (dropdown / multi-select only)</Label>
                <Input
                  id="col-options"
                  value={newColOptions}
                  disabled={newColType !== "single_select" && newColType !== "multi_select"}
                  onChange={(e) => setNewColOptions(e.target.value)}
                  placeholder="Hot, Warm, Cold"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                <Button variant="outline" onClick={() => setIsAddColOpen(false)}>Cancel</Button>
                <Button className="gap-2" onClick={handleAddColumn}>
                  <Plus className="h-4 w-4" />
                  Add Column
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </MainLayout>
    );
  }

  // ── List view (card grid) ───────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 sm:space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              CRM Builder
            </h1>
            <p className="mt-1 text-muted-foreground">
              Manage your CRM sheets — click any card to open it.
            </p>
          </div>

          <Button className="gap-2 w-full sm:w-auto" onClick={() => setIsSetupOpen(true)}>
            <Plus className="h-4 w-4" />
            New CRM Sheet
          </Button>
        </div>

        {/* Loading */}
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
              CRM sheets let you track contacts, deals, and pipelines — fully customised with your own columns and fields.
            </p>
            <Button
              size="lg"
              className="gap-2 text-base px-8"
              onClick={() => setIsSetupOpen(true)}
            >
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
                {/* Card header */}
                <div className="flex justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">{sheet.name}</h3>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); crm.openSheet(sheet.id); }}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Open CRM
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => openRenameDialog(e, { id: sheet.id, name: sheet.name })}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename Sheet
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => openDeleteDialog(e, { id: sheet.id, name: sheet.name })}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Sheet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Stats pills */}
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

                {/* Column preview chips */}
                <div className="flex flex-wrap gap-1.5 mb-5 min-h-[28px]">
                  {sheet.column_names.slice(0, 4).map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {name}
                    </span>
                  ))}
                  {sheet.column_count > 4 && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      +{sheet.column_count - 4} more
                    </span>
                  )}
                </div>

                {/* Footer */}
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

      {/* ── Setup dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Create a CRM Sheet
            </DialogTitle>
            <DialogDescription>
              Name your sheet and choose how many starting columns you want.
            </DialogDescription>
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
                1 – 20 columns. The first {Math.min(setupCols, 6)} use smart defaults (Name, Email, Status…).
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setIsSetupOpen(false)}>Cancel</Button>
              <Button className="gap-2" onClick={handleCreateSheet}>
                <Plus className="h-4 w-4" />
                Create Sheet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rename dialog ────────────────────────────────────────────────────── */}
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

      {/* ── Delete confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sheet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sheetToDelete?.name}"? This cannot be undone and all records will be lost.
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
